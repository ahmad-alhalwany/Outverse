from django.conf import settings
from django.db import models
from challenges.models import Challenge

class Mood(models.Model):
    MOOD_TYPES = [
        ('happy', 'فرح'),
        ('sad', 'حزن'),
        ('creative', 'إبداع'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='moods')
    type = models.CharField(max_length=20, choices=MOOD_TYPES)
    intensity = models.IntegerField()
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    related_challenge = models.ForeignKey(Challenge, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return f"{self.user.username} - {self.type}"
