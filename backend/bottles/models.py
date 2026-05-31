from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


def default_expiry_time():
    """Drifting bottles vanish from the map after 24 hours."""
    return timezone.now() + timedelta(hours=24)


class MessageBottle(models.Model):
    EMOTION_CHOICES = [
        ('joy', 'Joy'),
        ('hope', 'Hope'),
        ('calm', 'Calm'),
        ('love', 'Love'),
        ('sad', 'Sadness'),
        ('lonely', 'Loneliness'),
        ('anxious', 'Anxiety'),
        ('nostalgic', 'Nostalgia'),
        ('mystery', 'Mystery'),
    ]

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_bottles',
    )
    message = models.TextField()
    emotion_type = models.CharField(max_length=50, choices=EMOTION_CHOICES, default='mystery')
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)
    is_opened = models.BooleanField(default=False)
    expiry_time = models.DateTimeField(default=default_expiry_time)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    caught_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='caught_bottles',
        null=True,
        blank=True,
    )
    caught_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Bottle #{self.pk} from {self.sender_id}"
