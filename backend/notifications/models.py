from django.conf import settings
from django.db import models


class Notification(models.Model):
    VERB_CHOICES = [
        ('reaction', 'Reaction'),
        ('comment', 'Comment'),
        ('follow', 'Follow'),
        ('shop_purchase', 'Shop Purchase'),
        ('challenge_complete', 'Challenge Complete'),
        ('moderation_action', 'Moderation Action'),
        ('chat_message', 'Chat Message'),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
        null=True,
        blank=True,
    )
    verb = models.CharField(max_length=20, choices=VERB_CHOICES)
    type = models.CharField(max_length=32, blank=True, default='')
    post = models.ForeignKey(
        'posts.Post',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='+',
    )
    reel = models.ForeignKey(
        'reels.Reel',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='+',
    )
    text = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor_id} {self.verb} -> {self.recipient_id}"
