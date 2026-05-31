from django.conf import settings
from django.db import models
from django.utils import timezone


class UserPresence(models.Model):
    MOOD_ICONS = [
        ('sun', 'Sunny'),
        ('cloud', 'Cloudy'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='presence',
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

    def peer_id_for(self, user_id):
        uid = int(user_id)
        return self.user_b_id if self.user_a_id == uid else self.user_a_id


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
    )
    text = models.TextField(blank=True)
    message_type = models.CharField(
        max_length=10, choices=MESSAGE_TYPES, default='text'
    )
    attachment = models.FileField(
        upload_to='chat/attachments/', blank=True, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"msg {self.id} in conv {self.conversation_id}"


class ChatRoom(models.Model):
    name = models.CharField(max_length=120)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='chat_rooms_created',
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='chat_rooms',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class RoomMessage(models.Model):
    MESSAGE_TYPES = Message.MESSAGE_TYPES

    room = models.ForeignKey(
        ChatRoom, on_delete=models.CASCADE, related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='room_messages_sent',
    )
    text = models.TextField(blank=True)
    message_type = models.CharField(
        max_length=10, choices=MESSAGE_TYPES, default='text'
    )
    attachment = models.FileField(
        upload_to='chat/room_attachments/', blank=True, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"room msg {self.id}"
