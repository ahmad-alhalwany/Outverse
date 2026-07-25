from django.conf import settings
from django.db import models


class ContentEngagementEvent(models.Model):
    EVENT_TYPES = [
        ('view', 'View'),
        ('dwell_3s', 'Dwell 3s'),
        ('dwell_10s', 'Dwell 10s'),
        ('like', 'Reaction'),
        ('comment', 'Comment'),
        ('share', 'Share'),
        ('save', 'Save'),
        ('repost', 'Repost'),
        ('hide', 'Hide'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='engagement_events',
    )
    content_type = models.CharField(max_length=10, db_index=True)
    content_id = models.PositiveIntegerField(db_index=True)
    author_id = models.PositiveIntegerField(db_index=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'author_id', '-created_at']),
            models.Index(fields=['content_type', 'content_id']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} {self.content_type}:{self.content_id}"


class FeedRankingSnapshot(models.Model):
    """Point-in-time learned feed feature weights for auditing and replay."""

    weights = models.JSONField(default=dict)
    source = models.CharField(max_length=64, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.source} @ {self.created_at:%Y-%m-%d %H:%M}"


class UserInterestVector(models.Model):
    """Persisted tag-weight embedding from positive engagement signals."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='interest_vector',
    )
    weights = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"interest vector for user {self.user_id}"


class ContentTagVector(models.Model):
    """Optional normalized tag vector for a piece of content (posts, reels, …)."""

    content_type = models.CharField(max_length=10, db_index=True)
    content_id = models.PositiveIntegerField(db_index=True)
    weights = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['content_type', 'content_id'],
                name='analytics_contenttagvector_unique',
            ),
        ]

    def __str__(self):
        return f"{self.content_type}:{self.content_id} tags"
