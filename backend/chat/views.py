from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from challenges.models import Challenge
from .base import ChatAuthView
from narratives.models import Segment, Story
from posts.models import PostMedia
from users.models import Follow

from .models import ChatRoom, Conversation, Message, RoomMessage, UserPresence
from .realtime import broadcast_chat_event, broadcast_room_event, get_ice_servers
from .serializers import (
    ChatRoomSerializer,
    ConversationSerializer,
    MessageSerializer,
    RoomMessageSerializer,
)
from .ws_utils import (
    create_chat_message,
    create_room_message,
    guess_message_type,
    message_to_payload,
    room_message_to_payload,
    user_in_room,
)

User = get_user_model()
ONLINE_WINDOW = timedelta(minutes=5)


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
    presence, _ = UserPresence.objects.get_or_create(user=user)
    return {
        'id': user.id,
        'username': user.username,
        'name': (
            f"{user.first_name or ''} {user.last_name or ''}".strip()
            or user.username
        ),
        'avatar': _avatar_url(user, request),
        'status_message': presence.status_message or 'Exploring the cosmos',
        'mood_icon': presence.mood_icon,
        'is_online': _is_online(presence),
        'last_seen': presence.last_seen.isoformat(),
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
        results = [friend_dict(u, uid, request) for u in users[:50]]
        payload = {'friends': results, 'me': friend_dict(me, uid, request)}
        return Response(payload)


class ConversationListView(ChatAuthView):

    def get(self, request):
        uid = self.uid
        qs = Conversation.objects.filter(
            Q(user_a_id=uid) | Q(user_b_id=uid)
        ).prefetch_related('messages')
        serializer = ConversationSerializer(
            qs, many=True, context={'viewer_id': uid, 'request': request}
        )
        return Response(serializer.data)


class ConversationMessagesView(ChatAuthView):

    def get(self, request, conversation_id):
        conv = Conversation.objects.filter(pk=conversation_id).first()
        if not conv:
            return Response({'error': 'Not found.'}, status=404)
        uid = self.uid
        if uid not in (conv.user_a_id, conv.user_b_id):
            return Response({'error': 'Forbidden.'}, status=403)
        msgs = conv.messages.select_related('sender').order_by('created_at')
        Message.objects.filter(conversation=conv, is_read=False).exclude(
            sender_id=uid
        ).update(is_read=True)
        serializer = MessageSerializer(
            msgs, many=True, context={'request': request}
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
        msg = Message.objects.create(
            conversation=conv, sender_id=uid, text=text[:2000]
        )
        conv.save(update_fields=['updated_at'])
        broadcast_chat_event(
            conversation_id,
            message_to_payload(msg, request=request),
        )
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
        conv = Conversation.for_users(self.uid, peer_id)
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
        conv = Conversation.for_users(self.uid, peer_id)
        msg = Message.objects.create(
            conversation=conv,
            sender_id=self.uid,
            text=text[:2000],
        )
        conv.save(update_fields=['updated_at'])
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
        payload = message_to_payload(msg, request=request)
        broadcast_chat_event(conversation_id, payload)
        return Response(
            MessageSerializer(msg, context={'request': request}).data,
            status=201,
        )


class RoomListCreateView(ChatAuthView):

    def get(self, request):
        uid = self.uid
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


class RoomMessagesView(ChatAuthView):

    def get(self, request, room_id):
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        room = ChatRoom.objects.filter(pk=room_id).first()
        if not room:
            return Response({'error': 'Not found.'}, status=404)
        msgs = room.messages.select_related('sender').order_by('created_at')
        return Response({
            'room_id': room.id,
            'name': room.name,
            'messages': RoomMessageSerializer(
                msgs, many=True, context={'request': request}
            ).data,
        })

    def post(self, request, room_id):
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'text is required.'}, status=400)
        if not user_in_room(self.uid, room_id):
            return Response({'error': 'Forbidden.'}, status=403)
        msg = create_room_message(room_id, self.uid, text)
        payload = room_message_to_payload(msg, request=request)
        broadcast_room_event(room_id, payload)
        return Response(
            RoomMessageSerializer(msg, context={'request': request}).data,
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
        payload = room_message_to_payload(msg, request=request)
        broadcast_room_event(room_id, payload)
        return Response(
            RoomMessageSerializer(msg, context={'request': request}).data,
            status=201,
        )


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

        stories = Story.objects.filter(status='open').order_by(
            '-is_featured', '-updated_at'
        )[:4]
        story_rows = []
        for st in stories[:2]:
            segs = Segment.objects.filter(story=st).count()
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
