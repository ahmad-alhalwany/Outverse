from datetime import timedelta
from urllib.parse import parse_qs

from django.contrib.auth import get_user_model
from django.utils import timezone

from users.models import Follow

from .models import ChatRoom, Conversation, ConversationUserState, Message, RoomMessage, UserPresence

User = get_user_model()
ONLINE_WINDOW = timedelta(minutes=5)


def parse_user_id(scope):
    query = scope.get('query_string', b'').decode()
    params = parse_qs(query)
    raw = params.get('user_id', [None])[0]
    if not raw:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def user_in_conversation(user_id, conversation_id):
    conv = Conversation.objects.filter(pk=conversation_id).first()
    if not conv:
        return False
    uid = int(user_id)
    return uid in (conv.user_a_id, conv.user_b_id)


def get_friend_ids(user_id):
    uid = int(user_id)
    following = set(
        Follow.objects.filter(follower_id=uid).values_list('following_id', flat=True)
    )
    followers = set(
        Follow.objects.filter(following_id=uid).values_list('follower_id', flat=True)
    )
    return list((following | followers) - {uid})


def touch_presence(user_id, online=True):
    presence, _ = UserPresence.objects.get_or_create(user_id=user_id)
    presence.last_seen = timezone.now()
    presence.save(update_fields=['last_seen'])
    return presence


def presence_payload(user_id):
    presence, _ = UserPresence.objects.get_or_create(user_id=user_id)
    user = User.objects.filter(pk=user_id).first()
    online = presence.last_seen >= timezone.now() - ONLINE_WINDOW
    return {
        'user_id': user_id,
        'is_online': online,
        'status_message': presence.status_message or 'Exploring the cosmos',
        'mood_icon': presence.mood_icon,
        'username': user.username if user else '',
    }


VANISH_MIN_SECONDS = 60
VANISH_MAX_SECONDS = 7 * 24 * 3600


def vanish_expiry(expires_in_seconds):
    """Clamp a client-requested TTL to a sane range and turn it into an
    absolute timestamp. None/0/negative means the message never expires."""
    if not expires_in_seconds:
        return None
    try:
        seconds = int(expires_in_seconds)
    except (TypeError, ValueError):
        return None
    if seconds <= 0:
        return None
    seconds = max(VANISH_MIN_SECONDS, min(seconds, VANISH_MAX_SECONDS))
    return timezone.now() + timedelta(seconds=seconds)


def _attachment_url(msg):
    if msg.attachment:
        return msg.attachment.url
    return None


def message_to_payload(msg, request=None):
    user = msg.sender
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    avatar = None
    if getattr(user, 'avatar', None) and user.avatar:
        avatar = user.avatar.url
        if request:
            avatar = request.build_absolute_uri(avatar)
    attachment = _attachment_url(msg)
    if attachment and request:
        attachment = request.build_absolute_uri(attachment)
    return {
        'type': 'chat.message',
        'id': msg.id,
        'sender_id': user.id,
        'sender_name': full or user.username,
        'sender_avatar': avatar,
        'text': msg.text,
        'message_type': msg.message_type,
        'attachment_url': attachment,
        'created_at': msg.created_at.isoformat(),
        'is_read': msg.is_read,
        'expires_at': msg.expires_at.isoformat() if msg.expires_at else None,
    }


def create_chat_message(
    conversation_id,
    sender_id,
    text='',
    message_type='text',
    attachment=None,
    expires_in_seconds=None,
):
    conv = Conversation.objects.get(pk=conversation_id)
    msg = Message.objects.create(
        conversation=conv,
        sender_id=sender_id,
        text=(text or '')[:2000],
        message_type=message_type,
        attachment=attachment,
        expires_at=vanish_expiry(expires_in_seconds),
    )
    conv.save(update_fields=['updated_at'])
    # A reply sent purely over the socket (no REST round-trip) must still
    # move a message-request into the sender's own primary inbox.
    state, created = ConversationUserState.objects.get_or_create(
        user_id=sender_id, conversation=conv, defaults={'accepted': True},
    )
    if not created and not state.accepted:
        state.accepted = True
        state.save(update_fields=['accepted', 'updated_at'])
    return msg


def user_in_room(user_id, room_id):
    room = ChatRoom.objects.filter(pk=room_id).first()
    if not room:
        return False
    uid = int(user_id)
    if room.created_by_id == uid:
        return True
    return room.members.filter(pk=uid).exists()


def room_message_to_payload(msg, request=None):
    user = msg.sender
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    avatar = None
    if getattr(user, 'avatar', None) and user.avatar:
        avatar = user.avatar.url
        if request:
            avatar = request.build_absolute_uri(avatar)
    attachment = _attachment_url(msg)
    if attachment and request:
        attachment = request.build_absolute_uri(attachment)
    return {
        'type': 'room.message',
        'id': msg.id,
        'room_id': msg.room_id,
        'sender_id': user.id,
        'sender_name': full or user.username,
        'sender_avatar': avatar,
        'text': msg.text,
        'message_type': msg.message_type,
        'attachment_url': attachment,
        'created_at': msg.created_at.isoformat(),
        'expires_at': msg.expires_at.isoformat() if msg.expires_at else None,
    }


def create_room_message(
    room_id,
    sender_id,
    text='',
    message_type='text',
    attachment=None,
    expires_in_seconds=None,
):
    from django.core.cache import cache
    from django.core.exceptions import PermissionDenied

    room = ChatRoom.objects.get(pk=room_id)
    slow = int(getattr(room, 'slowmode_seconds', 0) or 0)
    if slow > 0:
        key = f'room:slowmode:{room_id}:{sender_id}'
        if cache.get(key):
            raise PermissionDenied('slowmode')
        cache.set(key, 1, timeout=slow)
    return RoomMessage.objects.create(
        room=room,
        sender_id=sender_id,
        text=(text or '')[:2000],
        message_type=message_type,
        attachment=attachment,
        expires_at=vanish_expiry(expires_in_seconds),
    )


def guess_message_type(uploaded_file):
    content_type = getattr(uploaded_file, 'content_type', '') or ''
    if content_type.startswith('image/'):
        return 'image'
    if content_type.startswith('audio/'):
        return 'voice'
    return 'file'
