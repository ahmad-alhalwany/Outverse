from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import ChatRoom, Conversation, Message, RoomMessage, UserPresence

User = get_user_model()


def user_display_name(user):
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or user.username


class MessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_avatar = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'sender_id', 'sender_name', 'sender_avatar',
            'text', 'message_type', 'attachment_url',
            'created_at', 'is_read',
        ]

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
        if not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url


class RoomMessageSerializer(serializers.ModelSerializer):
    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.SerializerMethodField()
    sender_avatar = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = RoomMessage
        fields = [
            'id', 'room_id', 'sender_id', 'sender_name', 'sender_avatar',
            'text', 'message_type', 'attachment_url', 'created_at',
        ]

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
        if not obj.attachment:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.attachment.url)
        return obj.attachment.url


class ChatRoomSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = ['id', 'name', 'member_count', 'last_message', 'created_at']

    def get_member_count(self, obj):
        return obj.members.count() + 1

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return RoomMessageSerializer(msg, context=self.context).data


class ConversationSerializer(serializers.ModelSerializer):
    peer = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'peer', 'last_message', 'unread_count', 'updated_at',
        ]

    def get_peer(self, obj):
        viewer_id = self.context.get('viewer_id')
        peer_id = obj.peer_id_for(viewer_id)
        peer = User.objects.filter(pk=peer_id).first()
        if not peer:
            return None
        request = self.context.get('request')
        from django.utils import timezone
        from datetime import timedelta

        from .models import UserPresence

        presence, _ = UserPresence.objects.get_or_create(user=peer)
        online = presence.last_seen >= timezone.now() - timedelta(minutes=5)
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
            'status_message': presence.status_message or 'Exploring the cosmos',
            'mood_icon': presence.mood_icon,
            'is_online': online,
        }

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        if not msg:
            return None
        return MessageSerializer(msg, context=self.context).data

    def get_unread_count(self, obj):
        viewer_id = self.context.get('viewer_id')
        return obj.messages.filter(is_read=False).exclude(
            sender_id=viewer_id
        ).count()
