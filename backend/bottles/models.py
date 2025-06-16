from django.conf import settings
from django.db import models

# Create your models here.

class MessageBottle(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_bottles')
    message = models.TextField()
    emotion_type = models.CharField(max_length=50)
    location_lat = models.FloatField()
    location_lng = models.FloatField()
    is_opened = models.BooleanField(default=False)
    expiry_time = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Bottle from {self.sender.username} at {self.created_at}"
