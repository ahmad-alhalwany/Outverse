from django.db import models
from django.conf import settings
from django.utils import timezone

from outverse.upload_validators import validate_generic_upload


class UserPresence(models.Model):
    MOOD_ICONS = [
        ('sun', 'Sunny'),
        ('cloud', 'Cloudy'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='presence',
        db_index=True,
    )
    last_seen = models.DateTimeField(default=timezone.now)
    status_message = models.CharField(max_length=120, blank=True, default='')
    mood_icon = models.CharField(max_length=10, choices=MOOD_ICONS, default='sun')

    def __str__(self):
        return f"presence:{self.user_id}"


class Conversation(models.Model):
    user_a = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_a',
    )
    user_b = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_b',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user_a', 'user_b'],
                name='chat_unique_conversation_pair',
            ),
        ]
        ordering = ['-updated_at']

    def __str__(self):
        return f"chat {self.user_a_id}-{self.user_b_id}"

    @classmethod
    def for_users(cls, uid1, uid2):
        a, b = sorted([int(uid1), int(uid2)])
        return cls.objects.get_or_create(user_a_id=a, user_b_id=b)[0]

    @classmethod
    def for_users_created(cls, uid1, uid2):
        """Like for_users but also returns whether it was just created —
        needed to gate the message-request flow on first contact only."""
        a, b = sorted([int(uid1), int(uid2)])
        return cls.objects.get_or_create(user_a_id=a, user_b_id=b)

    def peer_id_for(self, user_id):
        uid = int(user_id)
        return self.user_b_id if self.user_a_id == uid else self.user_a_id


class ConversationUserState(models.Model):
    """Per-user archive/mute preferences for a DM conversation."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversation_states',
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='user_states',
    )
    is_archived = models.BooleanField(default=False)
    is_muted = models.BooleanField(default=False)
    # False only when this row was explicitly created for a message-request
    # (first contact from someone the recipient doesn't follow). Absence of
    # a row — the common case — means accepted, so existing/mutual threads
    # are unaffected by this field's introduction.
    accepted = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'conversation'],
                name='chat_unique_conversation_user_state',
            ),
        ]

    def __str__(self):
        return f"state u{self.user_id} c{self.conversation_id}"


class Message(models.Model):
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('image', 'Image'),
        ('voice', 'Voice'),
        ('file', 'File'),
    ]

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_messages_sent',
        db_index=True,
    )
    text = models.TextField(blank=True)
    message_type = models.CharField(
        max_length=10, choices=MESSAGE_TYPES, default='text'
    )
    attachment = models.FileField(
        upload_to='chat/attachments/', blank=True, null=True, validators=[validate_generic_upload]
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_read = models.BooleanField(default=False)
    is_pinned = models.BooleanField(default=False, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"msg {self.id} in conv {self.conversation_id}"


class MessageReaction(models.Model):
    REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✨']

    message = models.ForeignKey(
        Message, on_delete=models.CASCADE, related_name='reactions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='message_reactions',
    )
    emoji = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user')


class ChatRoom(models.Model):
    CHANNEL_TYPE_CHOICES = [('text', 'Text'), ('voice', 'Voice'), ('stage', 'Stage')]

    name = models.CharField(max_length=120)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_rooms_created',
        db_index=True,
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='chat_rooms',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    # ---- Prompt Room extensions (Phase 2) ----
    # When set, this room is a "Prompt Room" — a temporary 24h space where
    # people discuss a single creative question. expires_at auto-stamps
    # on creation; the room stays readable after expiry but won't accept
    # new messages.
    question = models.ForeignKey(
        'questions.Question',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rooms',
    )
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)
    # Community channel extensions (Discord-depth)
    community = models.ForeignKey(
        'communities.Community',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='channels',
    )
    category = models.CharField(max_length=80, blank=True, default='')
    slowmode_seconds = models.PositiveIntegerField(default=0)
    channel_type = models.CharField(max_length=10, choices=CHANNEL_TYPE_CHOICES, default='text')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def is_expired(self) -> bool:
        if not self.expires_at:
            return False
        return timezone.now() >= self.expires_at


class RoomMessage(models.Model):
    MESSAGE_TYPES = Message.MESSAGE_TYPES

    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_messages_sent',
        db_index=True,
    )
    text = models.TextField(blank=True)
    message_type = models.CharField(
        max_length=10, choices=MESSAGE_TYPES, default='text'
    )
    attachment = models.FileField(
        upload_to='chat/room_attachments/', blank=True, null=True, validators=[validate_generic_upload]
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_pinned = models.BooleanField(default=False, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"room msg {self.id}"


class RoomReadState(models.Model):
    """Per-member read watermark for a group room — last message they've
    seen, not a row per message (which would explode message × member)."""

    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name='read_states',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_read_states',
    )
    last_read_message_id = models.PositiveIntegerField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('room', 'user')

    def __str__(self):
        return f"read u{self.user_id} room{self.room_id} -> msg{self.last_read_message_id}"


class RoomMessageReaction(models.Model):
    message = models.ForeignKey(
        RoomMessage, on_delete=models.CASCADE, related_name='reactions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_message_reactions',
    )
    emoji = models.CharField(max_length=8)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user')


class RoomRecap(models.Model):
    """A sealed digest of a Prompt Room after it expires.

    Generated on-demand the first time a user opens an expired room, then
    cached. Heuristic by default (participant/message counts, top messages
    by length, duration). When an LLM provider is configured, ``summary``
    is a one-sentence poetic close written from the room's question + top
    messages; otherwise it falls back to a templated line.
    """

    room = models.OneToOneField(
        ChatRoom,
        on_delete=models.CASCADE,
        related_name='recap',
    )
    participant_count = models.PositiveIntegerField(default=0)
    message_count = models.PositiveIntegerField(default=0)
    top_messages = models.JSONField(default=list, blank=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    summary = models.TextField(blank=True, default='')
    generated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"recap for room {self.room_id}"


class ScheduledMessage(models.Model):
    """A message queued to be sent at a future time. There's no background
    scheduler here, so these are materialized into a real Message/RoomMessage
    lazily — whenever the sender's client touches a chat list/thread endpoint
    and its send_at has passed. Deleted once published."""

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='scheduled_messages',
    )
    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name='scheduled_messages',
        null=True, blank=True,
    )
    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name='scheduled_messages',
        null=True, blank=True,
    )
    text = models.TextField()
    send_at = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['send_at']

    def __str__(self):
        target = f"conv{self.conversation_id}" if self.conversation_id else f"room{self.room_id}"
        return f"scheduled msg {self.id} -> {target} @ {self.send_at}"
