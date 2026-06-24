from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from outverse.upload_validators import validate_image_upload


class User(AbstractUser):
    bio = models.TextField(max_length=500, blank=True, null=True)
    avatar = models.ImageField(
        upload_to='avatars/',
        null=True,
        blank=True,
        validators=[validate_image_upload],
    )
    location = models.CharField(max_length=120, blank=True, default='')
    is_verified = models.BooleanField(default=False, db_index=True)
    onboarding_completed = models.BooleanField(default=False)
    interests = models.JSONField(default=list, blank=True)

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
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower_id} -> {self.following_id}"


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    mood_history = models.JSONField(default=list, blank=True)
    points = models.IntegerField(default=1250, help_text='Outverse coins for the shop')
    achievements = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=100, default='new', db_index=True)
    cover_photo = models.ImageField(
        upload_to='profile_covers/',
        null=True,
        blank=True,
        validators=[validate_image_upload],
    )

    def __str__(self):
        return f"{self.user.username}'s profile"


class UserToken(models.Model):
    EMAIL_VERIFICATION = 'email_verification'
    PASSWORD_RESET = 'password_reset'
    TOKEN_TYPES = [
        (EMAIL_VERIFICATION, 'Email verification'),
        (PASSWORD_RESET, 'Password reset'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tokens',
    )
    token = models.CharField(max_length=128, unique=True, db_index=True)
    token_type = models.CharField(max_length=32, choices=TOKEN_TYPES, db_index=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @property
    def is_active(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def mark_used(self):
        self.used_at = timezone.now()
        self.save(update_fields=['used_at'])