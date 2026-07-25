from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from challenges.models import Challenge
from .base import ChatAuthView
from narratives.models import Segment, Story
from posts.models import PostMedia
from users.models import Follow
from users.privacy import can_dm
from users.social import is_blocked_between

from notifications.utils import create_notification

from .models import ChatRoom, Conversation, ConversationUserState, Message, MessageReaction, RoomMessage, RoomMessageReaction, RoomReadState, ScheduledMessage, UserPresence
from .realtime import broadcast_chat_event, broadcast_room_event, get_ice_servers
from .recap import get_or_build_recap
from .serializers import (
    CHAT_REACTION_EMOJIS,
    ChatRoomSerializer,
    ConversationSerializer,
    MessageSerializer,
    RoomMessageSerializer,
    ScheduledMessageSerializer,
    reaction_counts_for_message,
)
from .ws_utils import (
    create_chat_message,
    create_room_message,
    guess_message_type,
    message_to_payload,
    room_message_to_payload,
    user_in_room,
    vanish_expiry,
)

User = get_user_model()
ONLINE_WINDOW = timedelta(minutes=5)


def _dm_allowed(sender_id: int, peer_id: int):
    peer = User.objects.filter(pk=peer_id).first()
    sender = User.objects.filter(pk=sender_id).first()
    if not peer or not sender:
        return False, 'User not found.'
    if is_blocked_between(sender_id, peer_id):
        return False, 'Messaging unavailable.'
    if not can_dm(sender, peer):
        return False, 'This user does not accept messages.'
    return True, None


def _purge_expired(queryset):
    """Vanish-mode cleanup: hard-delete any message whose TTL has passed.
    Called opportunistically on read since there's no background scheduler —
    the next person to open the thread sweeps it clean."""
    queryset.filter(expires_at__lte=timezone.now()).delete()


def _publish_due_scheduled(user_id, request=None):
    """Materialize any of this user's scheduled messages whose send_at has
    passed. There's no background scheduler here, so this runs opportunistically
    whenever the sender's client touches a chat list/thread endpoint — the
    message goes out the next time their app is open near the target time."""
    due = ScheduledMessage.objects.filter(
        sender_id=user_id, send_at__lte=timezone.now(),
    ).select_related('conversation', 'room')
    for sched in due:
        if sched.conversation_id:
            msg = Message.objects.create(
                conversation_id=sched.conversation_id,
                sender_id=user_id, text=sched.text[:2000],
            )
            Conversation.objects.filter(pk=sched.conversation_id).update(updated_at=timezone.now())
            _mark_conversation_accepted(sched.conversation, user_id)
            broadcast_chat_event(sched.conversation_id, message_to_payload(msg, request=request))
        elif sched.room_id:
            msg = RoomMessage.objects.create(
                room_id=sched.room_id, sender_id=user_id, text=sched.text[:2000],
            )
            broadcast_room_event(sched.room_id, room_message_to_payload(msg, request=request))
        sched.delete()


def _read_receipts_enabled(user_id):
    """Whether this viewer has opted in to letting others see their reads.
    When off, their own act of reading a thread must not mark anyone else's
    messages as read or advance their room watermark."""
    from preferences.models import UserPreferences
    prefs = UserPreferences.objects.filter(user_id=user_id).first()
    return prefs is None or prefs.read_receipts_enabled


def _mark_conversation_accepted(conv, user_id):
    """Sending a message always counts as accepting a conversation from
    your own side — this is how a message-request moves to the primary
    inbox once the recipient replies, without a separate accept click."""
    state, created = ConversationUserState.objects.get_or_create(
        user_id=user_id, conversation=conv, defaults={'accepted': True},
    )
    if not created and not state.accepted:
        state.accepted = True
        state.save(update_fields=['accepted', 'updated_at'])


def _is_valid_channel_type(channel_type):
    return channel_type in {choice[0] for choice in ChatRoom.CHANNEL_TYPE_CHOICES}


def _can_manage_room(user, room):
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if room.created_by_id == user.id:
        return True
    if room.community_id:
        from communities.views import _is_moderator
        return _is_moderator(user, room.community)
    return False


STAGE_ACTIONS = {'join', 'leave', 'raise_hand', 'speak', 'listen', 'promote', 'demote'}
STAGE_CACHE_TTL = 60 * 60


def _stage_cache_key(room_id):
    return f'stage:{room_id}'


def _empty_stage_state(room):
    return {
        'speakers': [],
        'listeners': [],
        'raised_hands': [],
        'host_id': room.created_by_id,
    }


def _normalize_stage_state(room, state):
    state = state if isinstance(state, dict) else {}
    payload = _empty_stage_state(room)
    for key in ('speakers', 'listeners', 'raised_hands'):
        values = state.get(key) or []
        normalized = []
        for value in values:
            try:
                user_id = int(value)
            except (TypeError, ValueError):
                continue
            if user_id not in normalized:
                normalized.append(user_id)
        payload[key] = normalized
    payload['host_id'] = room.created_by_id
    return payload


def _remove_from_stage(state, user_id):
    for key in ('speakers', 'listeners', 'raised_hands'):
        state[key] = [existing for existing in state[key] if existing != user_id]


def _stage_role_to_action(role):
    role = (role or '').strip().lower()
    return {
        'speaker': 'speak',
        'speakers': 'speak',
        'speak': 'speak',
        'listener': 'listen',
        'listeners': 'listen',
        'listen': 'listen',
        'raised_hand': 'raise_hand',
        'raised_hands': 'raise_hand',
        'raise_hand': 'raise_hand',
    }.get(role)


def _stage_joined_to_action(value):
    if isinstance(value, bool):
        return 'join' if value else 'leave'
    value = str(value).strip().lower()
    if value in ('1', 'true', 'yes', 'on', 'join', 'joined'):
        return 'join'
    if value in ('0', 'false', 'no', 'off', 'leave', 'left'):
        return 'leave'
    return None


def _stage_request_action(data):
    action = (data.get('action') or '').strip().lower()
    role_action = _stage_role_to_action(data.get('role'))
    if action:
        return action
    if 'joined' in data:
        joined_action = _stage_joined_to_action(data.get('joined'))
        if joined_action == 'join' and role_action:
            return role_action
        return joined_action or ''
    return role_action or ''


def _stage_user_is_waiting(state, user_id):
    return user_id in state['listeners'] or user_id in state['raised_hands']


def _stage_user_payload(user, request):
    return {
        'id': user.id,
        'username': user.username,
        'name': (
            f"{user.first_name or ''} {user.last_name or ''}".strip()
            or user.username
        ),
        'avatar': _avatar_url(user, request),
    }


def _apply_room_updates(room, data):
    update_fields = []
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return 'name cannot be empty.'
        room.name = name[:120]
        update_fields.append('name')
    if 'category' in data:
        room.category = (data.get('category') or '').strip()[:80]
        update_fields.append('category')
    if 'slowmode_seconds' in data:
        try:
            slowmode = int(data.get('slowmode_seconds') or 0)
        except (TypeError, ValueError):
            return 'slowmode_seconds must be an integer.'
        if slowmode < 0 or slowmode > 600:
            return 'slowmode_seconds must be between 0 and 600.'
        room.slowmode_seconds = slowmode
        update_fields.append('slowmode_seconds')
    if 'channel_type' in data:
        channel_type = (data.get('channel_type') or '').strip().lower()
        if not _is_valid_channel_type(channel_type):
            return 'channel_type must be text, voice, or stage.'
        room.channel_type = channel_type
        update_fields.append('channel_type')
    if update_fields:
        room.save(update_fields=update_fields)
    return None


def _flag_as_request_if_new(conv, created, sender_id):
    """On first contact, if the recipient doesn't already follow the
    sender, park the thread in their Requests inbox instead of primary."""
    if not created:
        return
    recipient_id = conv.peer_id_for(sender_id)
    already_follows = Follow.objects.filter(
        follower_id=recipient_id, following_id=sender_id,
    ).exists()
    if not already_follows:
        ConversationUserState.objects.get_or_create(
            user_id=recipient_id, conversation=conv, defaults={'accepted': False},
        )


def _notify_chat_message(conv, sender_id, text):
    peer_id = conv.peer_id_for(sender_id)
    if not peer_id:
        return
    create_notification(
        recipient_id=peer_id,
        actor_id=sender_id,
        verb='chat_message',
        text=(text or '')[:120],
    )


def _moderate_created_content(*, text, content_type, object_id, user):
    try:
        from moderation.hooks import enforce_moderation_result, soft_moderate_content

        result = soft_moderate_content(
            text=text,
            content_type=content_type,
            object_id=object_id,
            user=user,
        )
        if result.get('hard_block'):
            enforce_moderation_result(
                result,
                content_type=content_type,
                object_id=object_id,
            )
    except Exception:
        pass


def _avatar_url(user, request):
    if getattr(user, 'avatar', None) and user.avatar:
        if request:
            return request.build_absolute_uri(user.avatar.url)
        return user.avatar.url
    return None


def _is_online(presence):
    if not presence:
        return False
    return presence.last_seen >= timezone.now() - ONLINE_WINDOW


def friend_dict(user, viewer_id, request):
    presence = getattr(user, 'presence', None)
    return {
        'id': user.id,
        'username': user.username,
        'name': (
            f"{user.first_name or ''} {user.last_name or ''}".strip()
            or user.username
        ),
        'avatar': _avatar_url(user, request),
        'status_message': (presence.status_message if presence else '') or 'Exploring the cosmos',
        'mood_icon': presence.mood_icon if presence else 'sun',
        'is_online': _is_online(presence),
        'last_seen': presence.last_seen.isoformat() if presence else None,
    }


class PresencePingView(ChatAuthView):

    def post(self, request):
        presence, _ = UserPresence.objects.get_or_create(user=request.user)
        presence.last_seen = timezone.now()
        if 'status_message' in request.data:
            presence.status_message = (request.data.get('status_message') or '')[:120]
        if request.data.get('mood_icon') in ('sun', 'cloud'):
            presence.mood_icon = request.data['mood_icon']
        presence.save()
        return Response({
            'is_online': True,
            'status_message': presence.status_message,
            'mood_icon': presence.mood_icon,
        })


class FriendsListView(ChatAuthView):

    def get(self, request):
        uid = self.uid
        q = request.query_params.get('q', '').strip().lower()

        following_ids = set(
            Follow.objects.filter(follower_id=uid).values_list(
                'following_id', flat=True
            )
        )
        follower_ids = set(
            Follow.objects.filter(following_id=uid).values_list(
                'follower_id', flat=True
            )
        )
        friend_ids = (following_ids | follower_ids) - {uid}
        if not friend_ids:
            friend_ids = set(
                User.objects.exclude(id=uid).values_list('id', flat=True)[:8]
            )

        users = User.objects.filter(id__in=friend_ids).order_by('username')
        if q:
            users = users.filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )

        me = request.user
        users = users.select_related('presence')
        me = User.objects.select_related('presence').filter(pk=request.user.pk).first() or request.user
        results = [friend_dict(u, uid, request) for u in users[:50]]
        payload = {'friends': results, 'me': friend_dict(me, uid, request)}
        return Response(payload)


class ConversationListView(ChatAuthView):

    def get(self, request):
        uid = self.uid
        _publish_due_scheduled(uid, request=request)
        user_state_qs = ConversationUserState.objects.filter(user_id=uid)
        qs = Conversation.objects.filter(
            Q(user_a_id=uid) | Q(user_b_id=uid)
        ).prefetch_related(
            'messages',
            Prefetch('user_states', queryset=user_state_qs, to_attr='prefetched_user_states'),
        )
        pending_ids = ConversationUserState.objects.filter(
            user_id=uid, accepted=False,
        ).values_list('conversation_id', flat=True)
        list_type = request.query_params.get('type', 'primary')
        if list_type == 'requests':
            qs = qs.filter(id__in=pending_ids)
        else:
            qs = qs.exclude(id__in=pending_ids)
        serializer = ConversationSerializer(
            qs, many=True, context={'viewer_id': uid, 'request': request}
        )
        return Response(serializer.data)


class ConversationAcceptView(ChatAuthView):

    def post(self, request, conversation_id):
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        _mark_conversation_accepted(conv, uid)
        return Response({'conversation_id': conv.id, 'accepted': True})


class ConversationStateView(ChatAuthView):

    def patch(self, request, conversation_id):
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        state, _ = ConversationUserState.objects.get_or_create(
            user_id=uid, conversation=conv,
        )
        if 'is_archived' in request.data:
            state.is_archived = bool(request.data['is_archived'])
        if 'is_muted' in request.data:
            state.is_muted = bool(request.data['is_muted'])
        state.save(update_fields=['is_archived', 'is_muted', 'updated_at'])
        return Response({
            'conversation_id': conv.id,
            'is_archived': state.is_archived,
            'is_muted': state.is_muted,
        })


class ConversationMessagesView(ChatAuthView):

    def get(self, request, conversation_id):
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        _publish_due_scheduled(uid, request=request)
        _purge_expired(conv.messages)
        msgs = conv.messages.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        )
        q = request.query_params.get('q', '').strip()
        if q:
            msgs = msgs.filter(is_deleted=False, text__icontains=q)
        msgs = msgs.select_related('sender').prefetch_related(
            'reactions',
        ).order_by('-is_pinned', 'created_at')
        if _read_receipts_enabled(uid):
            Message.objects.filter(conversation=conv, is_read=False).exclude(
                sender_id=uid
            ).update(is_read=True)
        serializer = MessageSerializer(
            msgs, many=True, context={'request': request, 'viewer_id': uid},
        )
        peer_id = conv.peer_id_for(uid)
        peer = User.objects.filter(pk=peer_id).first()
        return Response({
            'conversation_id': conv.id,
            'peer': friend_dict(peer, uid, request) if peer else None,
            'messages': serializer.data,
        })

    def post(self, request, conversation_id):
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=400)
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        peer_id = conv.peer_id_for(uid)
        # A block placed after the conversation already existed must still
        # stop further messages — StartConversationView/SendMessageView only
        # gate the FIRST message, not every send into an existing thread.
        if peer_id and is_blocked_between(uid, peer_id):
            return Response({'error': 'Messaging unavailable.'}, status=403)
        msg = Message.objects.create(
            conversation=conv, sender_id=uid, text=text[:2000],
            expires_at=vanish_expiry(request.data.get('expires_in_seconds')),
        )
        _moderate_created_content(
            text=text,
            content_type='chat_message',
            object_id=msg.id,
            user=request.user,
        )
        conv.save(update_fields=['updated_at'])
        _mark_conversation_accepted(conv, uid)
        broadcast_chat_event(
            conversation_id,
            message_to_payload(msg, request=request),
        )
        _notify_chat_message(conv, uid, text)
        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=201,
        )


class StartConversationView(ChatAuthView):

    def post(self, request):
        peer_id = request.data.get('peer_id')
        if not peer_id:
            return Response({'error': 'peer_id is required.'}, status=400)
        if int(peer_id) == self.uid:
            return Response({'error': 'Invalid peer.'}, status=400)
        ok, err = _dm_allowed(self.uid, int(peer_id))
        if not ok:
            return Response({'error': err}, status=403)
        conv, created = Conversation.for_users_created(self.uid, peer_id)
        _flag_as_request_if_new(conv, created, self.uid)
        serializer = ConversationSerializer(
            conv, context={'viewer_id': self.uid, 'request': request}
        )
        return Response(serializer.data)


class SendMessageView(ChatAuthView):
    """Start or continue chat with peer in one request."""

    def post(self, request):
        peer_id = request.data.get('peer_id')
        text = (request.data.get('text') or '').strip()
        if not peer_id or not text:
            return Response(
                {'error': 'peer_id and text are required.'},
                status=400,
            )
        ok, err = _dm_allowed(self.uid, int(peer_id))
        if not ok:
            return Response({'error': err}, status=403)
        conv, created = Conversation.for_users_created(self.uid, peer_id)
        _flag_as_request_if_new(conv, created, self.uid)
        msg = Message.objects.create(
            conversation=conv,
            sender_id=self.uid,
            text=text[:2000],
            expires_at=vanish_expiry(request.data.get('expires_in_seconds')),
        )
        _moderate_created_content(
            text=text,
            content_type='chat_message',
            object_id=msg.id,
            user=request.user,
        )
        conv.save(update_fields=['updated_at'])
        _mark_conversation_accepted(conv, self.uid)
        broadcast_chat_event(
            conv.id,
            message_to_payload(msg, request=request),
        )
        _notify_chat_message(conv, self.uid, text)
        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=201,
        )


class ChatConfigView(ChatAuthView):
    """WebRTC ICE/TURN + dev server hints."""

    def get(self, request):
        import os
        redis_configured = bool(os.environ.get('REDIS_URL', '').strip())
        return Response({
            'ice_servers': get_ice_servers(),
            'channel_layer': 'redis' if redis_configured else 'memory',
            'websocket': {
                'chat': '/ws/chat/{conversation_id}/?token=',
                'room': '/ws/room/{room_id}/?token=',
                'signal': '/ws/signal/?token=',
                'notifications': '/ws/notifications/?token=',
            },
            'server': {
                'asgi': True,
                'runserver_supports_websocket': True,
                'recommended': (
                    'python manage.py runserver  (daphne is first in INSTALLED_APPS)'
                ),
                'alternative': (
                    'python -m daphne -b 127.0.0.1 -p 8000 outverse.asgi:application'
                ),
            },
        })


class TypingView(ChatAuthView):
    """Typing indicator when WebSocket is unavailable."""

    def post(self, request, conversation_id):
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        broadcast_chat_event(conversation_id, {
            'type': 'chat.typing',
            'user_id': uid,
            'is_typing': bool(request.data.get('is_typing')),
        })
        return Response({'ok': True})


class MessageUploadView(ChatAuthView):

    def post(self, request, conversation_id):
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'error': 'file is required.'}, status=400)
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        msg_type = request.data.get('message_type') or request.POST.get('message_type')
        if msg_type not in ('image', 'voice', 'file'):
            msg_type = guess_message_type(uploaded)
        text = (request.data.get('text') or request.POST.get('text') or '').strip()
        msg = create_chat_message(
            conversation_id,
            uid,
            text=text,
            message_type=msg_type,
            attachment=uploaded,
        )
        _moderate_created_content(
            text=text,
            content_type='chat_message',
            object_id=msg.id,
            user=request.user,
        )
        payload = message_to_payload(msg, request=request)
        broadcast_chat_event(conversation_id, payload)
        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=201,
        )


class RoomListCreateView(ChatAuthView):

    def get(self, request):
        uid = self.uid
        _publish_due_scheduled(uid, request=request)
        qs = ChatRoom.objects.filter(
            Q(created_by_id=uid) | Q(members__id=uid)
        ).distinct().prefetch_related('messages', 'members')
        serializer = ChatRoomSerializer(
            qs, many=True, context={'request': request}
        )
        return Response(serializer.data)

    def post(self, request):
        name = (request.data.get('name') or '').strip()
        member_ids = request.data.get('member_ids') or []
        if not name:
            return Response({'error': 'name is required.'}, status=400)
        room = ChatRoom.objects.create(
            name=name[:120],
            created_by_id=self.uid,
        )
        room.members.add(self.uid)
        for mid in member_ids:
            try:
                room.members.add(int(mid))
            except (TypeError, ValueError):
                continue
        serializer = ChatRoomSerializer(room, context={'request': request})
        return Response(serializer.data, status=201)


class PromptRoomListCreateView(ChatAuthView):
    """Prompt Rooms — 24h temporary rooms centered on a single creative question.

    ``GET /api/chat/prompt-rooms/``
        Active prompt rooms (question != null and not expired), newest first,
        with member counts. Open to authenticated users.

    ``POST /api/chat/prompt-rooms/``
        Create a room from a question. Body: ``{question_id}``. The room name
        is derived from the question text, ``expires_at`` is set to now+24h,
        and the creator is auto-added as a member.
    """

    def get(self, request):
        now = timezone.now()
        qs = (
            ChatRoom.objects
            .filter(question__isnull=False)
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .select_related('question', 'created_by')
            .prefetch_related('members')
            .order_by('-created_at')[:50]
        )
        serializer = ChatRoomSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        from questions.models import Question

        question_id = request.data.get('question_id')
        if not question_id:
            return Response({'error': 'question_id is required.'}, status=400)
        try:
            question = Question.objects.get(pk=int(question_id), is_active=True)
        except (Question.DoesNotExist, ValueError, TypeError):
            return Response({'error': 'Question not found.'}, status=404)

        # One active room per question — reuse if it already exists.
        now = timezone.now()
        room = (
            ChatRoom.objects
            .filter(question=question)
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .select_related('created_by')
            .prefetch_related('members')
            .first()
        )
        if room:
            room.members.add(self.uid)
            serializer = ChatRoomSerializer(room, context={'request': request})
            return Response(serializer.data, status=200)

        room = ChatRoom.objects.create(
            name=question.text[:120],
            created_by_id=self.uid,
            question=question,
            expires_at=now + timedelta(hours=24),
        )
        room.members.add(self.uid)
        serializer = ChatRoomSerializer(room, context={'request': request})
        return Response(serializer.data, status=201)


class RoomDetailView(ChatAuthView):

    def _get_room(self, room_id):
        return (
            ChatRoom.objects
            .filter(pk=room_id)
            .select_related('community')
            .prefetch_related('members')
            .first()
        )

    def patch(self, request, room_id):
        room = self._get_room(room_id)
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        if not _can_manage_room(request.user, room):
            return Response({'error': 'Forbidden.'}, status=403)
        err = _apply_room_updates(room, request.data)
        if err:
            return Response({'error': err}, status=400)
        return Response(ChatRoomSerializer(room, context={'request': request}).data)

    def delete(self, request, room_id):
        room = self._get_room(room_id)
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        if not _can_manage_room(request.user, room):
            return Response({'error': 'Forbidden.'}, status=403)
        room.delete()
        return Response(status=204)


class RoomStagePresenceView(ChatAuthView):
    def _get_stage_room(self, room_id):
        room = ChatRoom.objects.filter(pk=room_id).first()
        if not room:
            return None, Response({'error': 'Not found.'}, status=404)
        if room.channel_type not in ('stage', 'voice'):
            return None, Response({'error': 'Stage presence is only available for stage or voice rooms.'}, status=400)
        if not user_in_room(self.uid, room_id):
            return None, Response({'error': 'Forbidden.'}, status=403)
        return room, None

    def _get_state(self, room):
        return _normalize_stage_state(room, cache.get(_stage_cache_key(room.id)))

    def _serialize_state(self, room, state, request):
        users_by_id = {
            user.id: user
            for user in User.objects.filter(
                id__in=state['speakers'] + state['listeners'] + state['raised_hands']
            )
        }

        def serialize_bucket(key):
            return [
                _stage_user_payload(users_by_id[user_id], request)
                for user_id in state[key]
                if user_id in users_by_id
            ]

        return {
            'speakers': serialize_bucket('speakers'),
            'listeners': serialize_bucket('listeners'),
            'raised_hands': serialize_bucket('raised_hands'),
            'host_id': state['host_id'],
            'counts': {
                'speakers': len(state['speakers']),
                'listeners': len(state['listeners']),
                'raised_hands': len(state['raised_hands']),
                'total': len(set(
                    state['speakers'] + state['listeners'] + state['raised_hands']
                )),
            },
        }

    def _broadcast_stage_update(self, room, state, request):
        payload = {
            'type': 'stage.update',
            'room_id': room.id,
            **self._serialize_state(room, state, request),
        }
        try:
            layer = get_channel_layer()
            if layer:
                async_to_sync(layer.group_send)(
                    f'chat_room_{room.id}',
                    {'type': 'stage.update', 'payload': payload},
                )
        except Exception:
            pass
        return payload

    def get(self, request, room_id):
        room, error = self._get_stage_room(room_id)
        if error:
            return error
        state = self._get_state(room)
        return Response(self._serialize_state(room, state, request))

    def post(self, request, room_id):
        room, error = self._get_stage_room(room_id)
        if error:
            return error
        action = _stage_request_action(request.data)
        if action not in STAGE_ACTIONS:
            return Response({'error': 'action must be join, leave, raise_hand, speak, listen, promote, or demote.'}, status=400)

        user_id = self.uid
        target_user_id = user_id
        state = self._get_state(room)
        if action in ('promote', 'demote'):
            if self.uid not in (room.created_by_id, state['host_id']):
                return Response({'error': 'Forbidden.'}, status=403)
            try:
                target_user_id = int(
                    request.data.get('target_user_id')
                    or request.data.get('user_id')
                    or user_id
                )
            except (TypeError, ValueError):
                return Response({'error': 'target_user_id must be an integer.'}, status=400)
            if not room.members.filter(pk=target_user_id).exists():
                return Response({'error': 'Target user is not in this room.'}, status=400)
            if action == 'promote' and not _stage_user_is_waiting(state, target_user_id):
                return Response({'error': 'Target user must be listening or have a raised hand.'}, status=400)
            if action == 'demote' and target_user_id not in state['speakers']:
                return Response({'error': 'Target user must be a speaker.'}, status=400)

        if action == 'leave':
            _remove_from_stage(state, user_id)
        elif action in ('join', 'listen'):
            _remove_from_stage(state, user_id)
            state['listeners'].append(user_id)
        elif action == 'raise_hand':
            if user_id not in state['listeners'] and user_id not in state['speakers']:
                state['listeners'].append(user_id)
            if user_id not in state['raised_hands']:
                state['raised_hands'].append(user_id)
        elif action == 'speak':
            _remove_from_stage(state, user_id)
            state['speakers'].append(user_id)
        elif action == 'promote':
            _remove_from_stage(state, target_user_id)
            state['speakers'].append(target_user_id)
        elif action == 'demote':
            _remove_from_stage(state, target_user_id)
            state['listeners'].append(target_user_id)

        cache.set(_stage_cache_key(room.id), state, timeout=STAGE_CACHE_TTL)
        payload = self._broadcast_stage_update(room, state, request)
        return Response(payload)


class RoomMembersView(ChatAuthView):

    def _get_room(self, room_id):
        return ChatRoom.objects.filter(pk=room_id).prefetch_related('members').first()

    def post(self, request, room_id):
        room = self._get_room(room_id)
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        if room.created_by_id != self.uid:
            return Response({'error': 'Forbidden.'}, status=403)
        member_ids = request.data.get('member_ids') or []
        added = []
        for member_id in member_ids:
            try:
                member_id = int(member_id)
            except (TypeError, ValueError):
                continue
            if member_id == self.uid:
                continue
            if User.objects.filter(pk=member_id).exists():
                room.members.add(member_id)
                added.append(member_id)
        room.refresh_from_db()
        return Response({
            'added_member_ids': added,
            'room': ChatRoomSerializer(room, context={'request': request}).data,
        })

    def delete(self, request, room_id):
        room = self._get_room(room_id)
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        member_id = request.data.get('member_id')
        try:
            member_id = int(member_id)
        except (TypeError, ValueError):
            return Response({'error': 'member_id is required.'}, status=400)
        if room.created_by_id != self.uid and member_id != self.uid:
            return Response({'error': 'Forbidden.'}, status=403)
        room.members.remove(member_id)
        room.refresh_from_db()
        return Response(ChatRoomSerializer(room, context={'request': request}).data)


class RoomLeaveView(ChatAuthView):

    def post(self, request, room_id):
        room = ChatRoom.objects.filter(pk=room_id).first()
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        room.members.remove(self.uid)
        if room.created_by_id == self.uid:
            next_member = room.members.exclude(pk=self.uid).first()
            if next_member:
                room.created_by = next_member
                room.save(update_fields=['created_by'])
        return Response({'left': True})


class RoomMessagesView(ChatAuthView):

    def get(self, request, room_id):
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        room = ChatRoom.objects.filter(pk=room_id).first()
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        _publish_due_scheduled(self.uid, request=request)
        _purge_expired(room.messages)
        msgs = room.messages.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        ).select_related('sender').prefetch_related(
            'reactions',
        ).order_by('-is_pinned', 'created_at')
        uid = self.uid
        latest_id = room.messages.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        ).order_by('-id').values_list('id', flat=True).first()
        if latest_id and _read_receipts_enabled(uid):
            RoomReadState.objects.update_or_create(
                room=room, user_id=uid, defaults={'last_read_message_id': latest_id},
            )
        member_count = max(room.members.count() - 1, 0)  # exclude the viewer
        read_watermarks = list(
            RoomReadState.objects.filter(room=room).exclude(user_id=uid)
            .values_list('last_read_message_id', flat=True)
        )
        return Response({
            'room_id': room.id,
            'name': room.name,
            'messages': RoomMessageSerializer(
                msgs, many=True, context={
                    'request': request, 'viewer_id': uid,
                    'room_member_count': member_count,
                    'room_read_watermarks': read_watermarks,
                },
            ).data,
        })

    def post(self, request, room_id):
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=400)
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        msg = create_room_message(
            room_id, self.uid, text,
            expires_in_seconds=request.data.get('expires_in_seconds'),
        )
        _moderate_created_content(
            text=text,
            content_type='room_message',
            object_id=msg.id,
            user=request.user,
        )
        payload = room_message_to_payload(msg, request=request)
        broadcast_room_event(room_id, payload)
        return Response(
            RoomMessageSerializer(
                msg, context={'request': request, 'viewer_id': self.uid},
            ).data,
            status=201,
        )


class RoomTypingView(ChatAuthView):

    def post(self, request, room_id):
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        broadcast_room_event(room_id, {
            'type': 'room.typing',
            'user_id': self.uid,
            'is_typing': bool(request.data.get('is_typing')),
        })
        return Response({'ok': True})


class RoomUploadView(ChatAuthView):

    def post(self, request, room_id):
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'error': 'file is required.'}, status=400)
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        msg_type = request.data.get('message_type') or request.POST.get('message_type')
        if msg_type not in ('image', 'voice', 'file'):
            msg_type = guess_message_type(uploaded)
        text = (request.data.get('text') or request.POST.get('text') or '').strip()
        msg = create_room_message(
            room_id,
            self.uid,
            text=text,
            message_type=msg_type,
            attachment=uploaded,
        )
        _moderate_created_content(
            text=text,
            content_type='room_message',
            object_id=msg.id,
            user=request.user,
        )
        payload = room_message_to_payload(msg, request=request)
        broadcast_room_event(room_id, payload)
        return Response(
            RoomMessageSerializer(
                msg, context={'request': request, 'viewer_id': self.uid},
            ).data,
            status=201,
        )


class RoomRecapView(ChatAuthView):
    """Sealed digest of an expired Prompt Room.

    ``GET /api/chat/rooms/<room_id>/recap/``
    Returns the cached recap, or generates one on-demand if the room has
    expired. Live (non-expired) rooms return 409 — the recap is sealed
    until the room closes.
    """

    def get(self, request, room_id):
        room = ChatRoom.objects.filter(pk=room_id).select_related('question').first()
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        if not room.is_expired:
            return Response(
                {'error': 'Room is still live — recap is sealed until it closes.'},
                status=409,
            )
        recap = get_or_build_recap(room)
        return Response({
            'room_id': room.id,
            'question_text': room.question.text if room.question else room.name,
            'question_category': room.question.category if room.question else None,
            'participant_count': recap.participant_count,
            'message_count': recap.message_count,
            'duration_minutes': recap.duration_minutes,
            'top_messages': recap.top_messages,
            'summary': recap.summary,
            'generated_at': recap.generated_at.isoformat(),
        })


class ChatAdminOverviewView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({
            'conversations': Conversation.objects.count(),
            'messages': Message.objects.count(),
            'rooms': ChatRoom.objects.count(),
            'room_messages': RoomMessage.objects.count(),
            'presence_records': UserPresence.objects.count(),
        })


class SharedSpaceView(ChatAuthView):

    def get(self, request):
        challenges = Challenge.objects.filter(is_active=True).order_by(
            '-is_daily', '-created_at'
        )[:4]
        challenge_rows = []
        for ch in challenges[:2]:
            participants = ch.submissions.count() if hasattr(ch, 'submissions') else 0
            progress = min(95, 40 + participants * 5) if participants else 40
            challenge_rows.append({
                'id': ch.id,
                'title': ch.title,
                'description': (ch.description or '')[:80],
                'participants': participants,
                'progress': progress,
                'href': f'/lab?challenge={ch.id}',
            })

        stories = Story.objects.filter(status='open').annotate(
            segment_count=Count('segments')
        ).order_by(
            '-is_featured', '-updated_at'
        )[:4]
        story_rows = []
        for st in stories[:2]:
            segs = st.segment_count
            words = segs * 180
            story_rows.append({
                'id': st.id,
                'title': st.title,
                'subtitle': f'{max(segs, 1)} contributors',
                'words': words or 2500,
                'href': f'/forge?story={st.id}',
            })

        media = []
        for pm in PostMedia.objects.filter(media_type='image').select_related(
            'post'
        ).order_by('-id')[:6]:
            url = pm.media_file.url if pm.media_file else ''
            if request and url:
                url = request.build_absolute_uri(url)
            media.append({'id': pm.id, 'url': url, 'post_id': pm.post_id})

        return Response({
            'challenges': challenge_rows,
            'stories': story_rows,
            'media': media,
        })


class MessageEditDeleteView(ChatAuthView):
    """Edit or soft-delete a DM message — sender only."""

    def patch(self, request, message_id):
        msg = Message.objects.filter(pk=message_id).select_related('conversation').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        if msg.sender_id != self.uid:
            return Response({'error': 'Forbidden.'}, status=403)
        if msg.is_deleted:
            return Response({'error': 'Cannot edit a deleted message.'}, status=400)
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=400)
        msg.text = text[:2000]
        msg.edited_at = timezone.now()
        msg.save(update_fields=['text', 'edited_at'])
        payload = message_to_payload(msg, request=request)
        payload['type'] = 'chat.message_edited'
        broadcast_chat_event(msg.conversation_id, payload)
        return Response(MessageSerializer(msg, context={'request': request}).data)

    def delete(self, request, message_id):
        msg = Message.objects.filter(pk=message_id).select_related('conversation').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        if msg.sender_id != self.uid:
            return Response({'error': 'Forbidden.'}, status=403)
        msg.is_deleted = True
        msg.text = ''
        msg.is_pinned = False
        msg.save(update_fields=['is_deleted', 'text', 'is_pinned'])
        broadcast_chat_event(msg.conversation_id, {
            'type': 'chat.message_deleted',
            'id': msg.id,
        })
        return Response({'id': msg.id, 'is_deleted': True})


class RoomMessageEditDeleteView(ChatAuthView):
    """Edit or soft-delete a room message — sender only."""

    def patch(self, request, message_id):
        msg = RoomMessage.objects.filter(pk=message_id).select_related('room').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        if msg.sender_id != self.uid:
            return Response({'error': 'Forbidden.'}, status=403)
        if msg.is_deleted:
            return Response({'error': 'Cannot edit a deleted message.'}, status=400)
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=400)
        msg.text = text[:2000]
        msg.edited_at = timezone.now()
        msg.save(update_fields=['text', 'edited_at'])
        payload = room_message_to_payload(msg, request=request)
        payload['type'] = 'room.message_edited'
        broadcast_room_event(msg.room_id, payload)
        return Response(RoomMessageSerializer(msg, context={'request': request}).data)

    def delete(self, request, message_id):
        msg = RoomMessage.objects.filter(pk=message_id).select_related('room').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        if msg.sender_id != self.uid:
            return Response({'error': 'Forbidden.'}, status=403)
        msg.is_deleted = True
        msg.text = ''
        msg.is_pinned = False
        msg.save(update_fields=['is_deleted', 'text', 'is_pinned'])
        broadcast_room_event(msg.room_id, {
            'type': 'room.message_deleted',
            'id': msg.id,
        })
        return Response({'id': msg.id, 'is_deleted': True})


class MessagePinView(ChatAuthView):
    def post(self, request, message_id):
        msg = Message.objects.filter(pk=message_id).select_related('conversation').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        conv = msg.conversation
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        with transaction.atomic():
            if msg.is_pinned:
                msg.is_pinned = False
                msg.save(update_fields=['is_pinned'])
            else:
                Message.objects.filter(conversation=conv, is_pinned=True).update(is_pinned=False)
                msg.is_pinned = True
                msg.save(update_fields=['is_pinned'])
        return Response({'is_pinned': msg.is_pinned})


class MessageReactView(ChatAuthView):
    def post(self, request, message_id):
        msg = Message.objects.filter(pk=message_id).select_related('conversation').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        conv = msg.conversation
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        emoji = (request.data.get('emoji') or '').strip()
        if emoji and emoji not in CHAT_REACTION_EMOJIS:
            return Response({'error': 'Invalid reaction.'}, status=400)
        existing = MessageReaction.objects.filter(message=msg, user_id=uid).first()
        my_reaction = None
        if not emoji:
            if existing:
                existing.delete()
        elif existing:
            if existing.emoji == emoji:
                existing.delete()
            else:
                existing.emoji = emoji
                existing.save(update_fields=['emoji'])
                my_reaction = emoji
        else:
            MessageReaction.objects.create(message=msg, user_id=uid, emoji=emoji)
            my_reaction = emoji
        return Response({
            'reaction_counts': reaction_counts_for_message(msg),
            'my_reaction': my_reaction,
        })


class RoomMessagePinView(ChatAuthView):
    def post(self, request, message_id):
        msg = RoomMessage.objects.filter(pk=message_id).select_related('room').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if not msg.room.members.filter(id=uid).exists():
            return Response({'error': 'Forbidden.'}, status=403)
        with transaction.atomic():
            if msg.is_pinned:
                msg.is_pinned = False
                msg.save(update_fields=['is_pinned'])
            else:
                RoomMessage.objects.filter(room=msg.room, is_pinned=True).update(is_pinned=False)
                msg.is_pinned = True
                msg.save(update_fields=['is_pinned'])
        return Response({'is_pinned': msg.is_pinned})


class RoomMessageReactView(ChatAuthView):
    def post(self, request, message_id):
        msg = RoomMessage.objects.filter(pk=message_id).select_related('room').first()
        if not msg:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if not msg.room.members.filter(id=uid).exists():
            return Response({'error': 'Forbidden.'}, status=403)
        emoji = (request.data.get('emoji') or '').strip()
        if emoji and emoji not in CHAT_REACTION_EMOJIS:
            return Response({'error': 'Invalid reaction.'}, status=400)
        existing = RoomMessageReaction.objects.filter(message=msg, user_id=uid).first()
        my_reaction = None
        if not emoji:
            if existing:
                existing.delete()
        elif existing:
            if existing.emoji == emoji:
                existing.delete()
            else:
                existing.emoji = emoji
                existing.save(update_fields=['emoji'])
                my_reaction = emoji
        else:
            RoomMessageReaction.objects.create(message=msg, user_id=uid, emoji=emoji)
            my_reaction = emoji
        return Response({
            'reaction_counts': reaction_counts_for_message(msg),
            'my_reaction': my_reaction,
        })


def _parse_future_send_at(raw):
    send_at = parse_datetime(raw) if isinstance(raw, str) else None
    if not send_at:
        return None, 'Invalid send_at.'
    if timezone.is_naive(send_at):
        send_at = timezone.make_aware(send_at)
    if send_at <= timezone.now():
        return None, 'send_at must be in the future.'
    if send_at > timezone.now() + timedelta(days=365):
        return None, 'send_at is too far in the future.'
    return send_at, None


class ScheduledMessageListView(ChatAuthView):
    """A user's own pending scheduled sends, across all DMs and rooms."""

    def get(self, request):
        uid = self.uid
        _publish_due_scheduled(uid, request=request)
        qs = ScheduledMessage.objects.filter(sender_id=uid).order_by('send_at')
        return Response(ScheduledMessageSerializer(qs, many=True).data)


class ScheduledMessageCancelView(ChatAuthView):
    def delete(self, request, scheduled_id):
        sched = ScheduledMessage.objects.filter(pk=scheduled_id, sender_id=self.uid).first()
        if not sched:
            return Response({'error': 'Not found.'}, status=404)
        sched.delete()
        return Response({'cancelled': True})


class ConversationScheduleView(ChatAuthView):
    def post(self, request, conversation_id):
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=400)
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        send_at, err = _parse_future_send_at(request.data.get('send_at'))
        if err:
            return Response({'error': err}, status=400)
        sched = ScheduledMessage.objects.create(
            sender_id=uid, conversation=conv, text=text[:2000], send_at=send_at,
        )
        return Response(ScheduledMessageSerializer(sched).data, status=201)


class RoomScheduleView(ChatAuthView):
    def post(self, request, room_id):
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=400)
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        send_at, err = _parse_future_send_at(request.data.get('send_at'))
        if err:
            return Response({'error': err}, status=400)
        sched = ScheduledMessage.objects.create(
            sender_id=self.uid, room_id=room_id, text=text[:2000], send_at=send_at,
        )
        return Response(ScheduledMessageSerializer(sched).data, status=201)
