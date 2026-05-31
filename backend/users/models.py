from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.

class User(AbstractUser):
    bio = models.TextField(max_length=500, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    location = models.CharField(max_length=120, blank=True, default='')
    # يمكنك إضافة حقول إضافية لاحقًا مثل: المزاج الحالي، الرصيد، ...

    def __str__(self):
        return self.username

class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='following',
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followers',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower_id} -> {self.following_id}"


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    mood_history = models.JSONField(default=list, blank=True)
    points = models.IntegerField(default=1250, help_text='Outverse coins for the shop')
    achievements = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=100, default='new')

    def __str__(self):
        return f"{self.user.username}'s profile"
