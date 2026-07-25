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
    MESSAGE_FREQUENCY_CHOICES = [
        ('hourly', 'Hourly'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
    ]
    INTERACTION_POLICY_CHOICES = [
        ('everyone', 'Everyone'),
        ('followers', 'Followers'),
        ('following', 'People you follow'),
        ('none', 'No one'),
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
    read_receipts_enabled = models.BooleanField(default=True)
    weirdness_level = models.PositiveSmallIntegerField(default=30)
    message_frequency = models.CharField(
        max_length=16,
        choices=MESSAGE_FREQUENCY_CHOICES,
        default='daily',
    )
    dm_policy = models.CharField(
        max_length=16,
        choices=INTERACTION_POLICY_CHOICES,
        default='everyone',
    )
    comment_policy = models.CharField(
        max_length=16,
        choices=INTERACTION_POLICY_CHOICES,
        default='everyone',
    )
    mention_policy = models.CharField(
        max_length=16,
        choices=INTERACTION_POLICY_CHOICES,
        default='everyone',
    )
    tag_policy = models.CharField(
        max_length=16,
        choices=INTERACTION_POLICY_CHOICES,
        default='everyone',
    )
    hidden_words = models.JSONField(default=list, blank=True)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    # Pulse creator defaults applied to new reels
    default_allow_remix = models.BooleanField(default=True)
    default_allow_weave = models.BooleanField(default=True)
    default_allow_download = models.BooleanField(default=False)
    # Signal publish default — who can echo back (reply) on new posts
    REPLY_CONTROL_CHOICES = [
        ('everyone', 'Everyone'),
        ('followers', 'Followers'),
        ('nobody', 'No one'),
    ]
    default_reply_control = models.CharField(
        max_length=12,
        choices=REPLY_CONTROL_CHOICES,
        default='everyone',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['user_id']

    def __str__(self):
        return f"Preferences for {self.user_id}"
