from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .models import ChatRoom, Conversation, Message, MessageReaction, RoomMessage, RoomMessageReaction, ScheduledMessage, UserPresence

User = get_user_model()

CHAT_REACTION_EMOJIS = {'👍', '❤️', '😂', '😮', '😢', '🔥', '✨'}


def reaction_counts_for_message(message):
    from collections import Counter
    if hasattr(message, '_prefetched_objects_cache') and 'reactions' in message._prefetched_objects_cache:
        return dict(Counter(r.emoji for r in message.reactions.all()))
    return dict(Counter(message.reactions.values_list('emoji', flat=True)))


def my_message_reaction(message, user_id):
    if not user_id:
        return None
    if hasattr(message, '_prefetched_objects_cache') and 'reactions' in message._prefetched_objects_cache:
        for r in message.reactions.all():
            if r.user_id == user_id:
                return r.emoji
        return None
    row = message.reactions.filter(user_id=user_id).first()
    return row.emoji if row else None


def user_display_name(user):
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or user.username


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_avatar = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender_id', 'sender_name', 'sender_avatar',
            'text', 'message_type', 'attachment_url', 'is_pinned',
            'reaction_counts', 'my_reaction',
            'created_at', 'is_read', 'edited_at', 'is_deleted', 'expires_at',
        ]

    def get_reaction_counts(self, obj):
        return reaction_counts_for_message(obj)

    def get_my_reaction(self, obj):
        viewer = self.context.get('viewer_id')
        return my_message_reaction(obj, viewer)

    def get_sender_name(self, obj):
        return user_display_name(obj.sender)

    def get_sender_avatar(self, obj):
        request = self.context.get('request')
        if getattr(obj.sender, 'avatar', None) and obj.sender.avatar:
            if request:
                return request.build_absolute_uri(obj.sender.avatar.url)
            return obj.sender.avatar.url
        return None

    def get_attachment_url(self, obj):
        if obj.is_deleted or not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            data['text'] = ''
        return data


class RoomMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_avatar = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    read_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = RoomMessage
        fields = [
            'id', 'room_id', 'sender_id', 'sender_name', 'sender_avatar',
            'text', 'message_type', 'attachment_url', 'is_pinned',
            'reaction_counts', 'my_reaction',
            'created_at', 'edited_at', 'is_deleted', 'expires_at',
            'read_count', 'member_count',
        ]

    def get_reaction_counts(self, obj):
        return reaction_counts_for_message(obj)

    def get_read_count(self, obj):
        watermarks = self.context.get('room_read_watermarks')
        if watermarks is None:
            return None
        return sum(1 for w in watermarks if w is not None and w >= obj.id)

    def get_member_count(self, obj):
        return self.context.get('room_member_count')

    def get_my_reaction(self, obj):
        viewer = self.context.get('viewer_id')
        return my_message_reaction(obj, viewer)

    def get_sender_name(self, obj):
        return user_display_name(obj.sender)

    def get_sender_avatar(self, obj):
        request = self.context.get('request')
        if getattr(obj.sender, 'avatar', None) and obj.sender.avatar:
            if request:
                return request.build_absolute_uri(obj.sender.avatar.url)
            return obj.sender.avatar.url
        return None

    def get_attachment_url(self, obj):
        if obj.is_deleted or not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            data['text'] = ''
        return data


class ChatRoomSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()
    created_by_id = serializers.IntegerField(source='created_by.id', read_only=True)
    question_text = serializers.SerializerMethodField()
    question_category = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = ChatRoom
        fields = [
            'id', 'name', 'member_count', 'members',
            'last_message', 'created_at', 'created_by_id',
            'question', 'question_text', 'question_category',
            'expires_at', 'is_expired', 'community', 'category',
            'slowmode_seconds', 'channel_type',
        ]

    def get_question_text(self, obj):
        if not obj.question:
            return None
        return obj.question.text

    def get_question_category(self, obj):
        if not obj.question:
            return None
        return obj.question.category

    def get_member_count(self, obj):
        return getattr(obj, 'member_count', obj.members.count() + 1)

    def get_last_message(self, obj):
        msg = getattr(obj, 'prefetched_last_message', None)
        if msg is None:
            msg = obj.messages.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
            ).order_by('-created_at').first()
        if not msg:
            return None
        return RoomMessageSerializer(msg, context=self.context).data

    def get_members(self, obj):
        request = self.context.get('request')
        members = getattr(obj, 'prefetched_members', None)
        if members is None:
            members = obj.members.all()
        rows = []
        for member in members:
            if not member:
                continue
            avatar = None
            if getattr(member, 'avatar', None) and member.avatar:
                avatar = (
                    request.build_absolute_uri(member.avatar.url)
                    if request
                    else member.avatar.url
                )
            rows.append({
                'id': member.id,
                'username': member.username,
                'name': user_display_name(member),
                'avatar': avatar,
            })
        return rows


class ConversationSerializer(serializers.ModelSerializer):
    peer = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    is_archived = serializers.SerializerMethodField()
    is_muted = serializers.SerializerMethodField()
    is_request = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'peer', 'last_message', 'unread_count', 'updated_at',
            'is_archived', 'is_muted', 'is_request',
        ]

    def get_peer(self, obj):
        viewer_id = self.context.get('viewer_id')
        peer = getattr(obj, 'prefetched_peer', None)
        if peer is None:
            peer_id = obj.peer_id_for(viewer_id)
            peer = User.objects.filter(pk=peer_id).first()
        if not peer:
            return None
        request = self.context.get('request')
        presence = getattr(peer, 'presence', None)
        online = bool(presence and presence.last_seen >= timezone.now() - timezone.timedelta(minutes=5))
        avatar = None
        if getattr(peer, 'avatar', None) and peer.avatar:
            avatar = (
                request.build_absolute_uri(peer.avatar.url)
                if request
                else peer.avatar.url
            )
        full = f"{peer.first_name or ''} {peer.last_name or ''}".strip()
        return {
            'id': peer.id,
            'username': peer.username,
            'name': full or peer.username,
            'avatar': avatar,
            'status_message': (presence.status_message if presence else '') or 'Exploring the cosmos',
            'mood_icon': presence.mood_icon if presence else 'sun',
            'is_online': online,
        }

    def get_last_message(self, obj):
        msg = getattr(obj, 'prefetched_last_message', None)
        if msg is None:
            msg = obj.messages.filter(
                Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
            ).order_by('-created_at').first()
        if not msg:
            return None
        return MessageSerializer(msg, context=self.context).data

    def get_unread_count(self, obj):
        viewer_id = self.context.get('viewer_id')
        return getattr(obj, 'unread_count', obj.messages.filter(
            is_read=False,
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        ).exclude(sender_id=viewer_id).count())

    def _viewer_state(self, obj):
        viewer_id = self.context.get('viewer_id')
        states = getattr(obj, 'prefetched_user_states', None)
        if states is not None:
            return states[0] if states else None
        from .models import ConversationUserState
        return ConversationUserState.objects.filter(
            user_id=viewer_id, conversation_id=obj.id,
        ).first()

    def get_is_archived(self, obj):
        state = self._viewer_state(obj)
        return bool(state and state.is_archived)

    def get_is_muted(self, obj):
        state = self._viewer_state(obj)
        return bool(state and state.is_muted)

    def get_is_request(self, obj):
        state = self._viewer_state(obj)
        return bool(state and not state.accepted)


class ScheduledMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduledMessage
        fields = ['id', 'conversation', 'room', 'text', 'send_at', 'created_at']
        read_only_fields = ['id', 'created_at']
