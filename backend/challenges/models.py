from django.db import models
from django.contrib.auth.models import User
from django.conf import settings

class Challenge(models.Model):
    CHALLENGE_TYPES = [
        ('art', 'فني'),
        ('writing', 'كتابي'),
        ('practical', 'عملي'),
    ]
    title = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=CHALLENGE_TYPES)
    difficulty = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField()

    def __str__(self):
        return self.title

class Submission(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submissions')
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='submissions')
    content = models.TextField()
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username}'s submission for {self.challenge.title}"
