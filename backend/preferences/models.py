from django.conf import settings
from django.db import models


class UserPreferences(models.Model):
    LOCALE_CHOICES = [
        ('en', 'English'),
        ('ar', 'Arabic'),
    ]
    THEME_CHOICES = [
        ('light', 'Light'),
        ('dark', 'Dark'),
    ]
    PROFILE_VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('followers', 'Followers'),
        ('private', 'Private'),
    ]
    BOTTLE_PRIVACY_CHOICES = [
        ('map_only', 'Map only'),
        ('catch_only', 'Catch only'),
        ('private', 'Private'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='preferences',
    )
    locale = models.CharField(max_length=2, choices=LOCALE_CHOICES, default='en')
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='light')
    vault_map_style = models.CharField(max_length=32, default='street')
    notification_prefs = models.JSONField(
        default=dict,
        blank=True,
    )
    profile_visibility = models.CharField(
        max_length=16,
        choices=PROFILE_VISIBILITY_CHOICES,
        default='public',
    )
    bottle_privacy = models.CharField(
        max_length=16,
        choices=BOTTLE_PRIVACY_CHOICES,
        default='map_only',
    )
    online_status_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user_id']

    def __str__(self):
        return f"Preferences for {self.user_id}"
