from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def default_note_expiry():
    return timezone.now() + timedelta(hours=24)


class Note(models.Model):
    EXPIRE_CHOICES = [
        ('24h', '24 hours'),
        ('7d', '7 days'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notes',
    )
    text = models.TextField()
    theme = models.CharField(max_length=40, blank=True, default='cosmic')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_note_expiry, db_index=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def __str__(self):
        return f"{self.user_id}: {self.text[:30]}"
