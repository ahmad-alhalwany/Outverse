from django.conf import settings
from django.db import models

# Create your models here.

class Story(models.Model):
    title = models.CharField(max_length=200)
    current_content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.title

class StoryContribution(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='story_contributions')
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='contributions')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} - {self.story.title}"
