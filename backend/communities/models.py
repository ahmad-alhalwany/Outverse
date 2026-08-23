from django.conf import settings
from django.db import models


class Community(models.Model):
    """A Reddit-style topic space users can join and post into."""

    PRIVACY_CHOICES = [('public', 'Public'), ('private', 'Private')]
    POSTING_CHOICES = [
        ('members', 'Approved members'),
        ('mods', 'Moderators only'),
    ]

    slug = models.SlugField(max_length=40, unique=True, db_index=True)
    name = models.CharField(max_length=80)
    description = models.TextField(max_length=500, blank=True, default='')
    cover_url = models.URLField(blank=True, default='')
    privacy = models.CharField(max_length=10, choices=PRIVACY_CHOICES, default='public')
    # Community Gates (Reddit-style settings)
    is_nsfw = models.BooleanField(default=False, db_index=True)
    spoilers_enabled = models.BooleanField(default=True)
    posting_permission = models.CharField(
        max_length=12, choices=POSTING_CHOICES, default='members',
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_communities',
    )
    members_count = models.PositiveIntegerField(default=0)
    posts_count = models.PositiveIntegerField(default=0)
    rules = models.JSONField(default=list, blank=True)
    flair_options = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-members_count', 'name']
        verbose_name_plural = 'communities'

    def __str__(self):
        return self.name


class CommunityMembership(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('banned', 'Banned'),
    ]
    ROLE_CHOICES = [
        ('member', 'Member'),
        ('moderator', 'Moderator'),
        ('admin', 'Admin'),
    ]

    community = models.ForeignKey(
        Community, on_delete=models.CASCADE, related_name='memberships',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_memberships',
    )
    is_moderator = models.BooleanField(default=False)
    role = models.CharField(max_length=12, choices=ROLE_CHOICES, default='member', db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='approved')
    flair = models.CharField(max_length=40, blank=True, default='')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('community', 'user')
        ordering = ['-joined_at']

    def save(self, *args, **kwargs):
        # Keep is_moderator in sync with role for legacy callers.
        if self.role in ('moderator', 'admin'):
            self.is_moderator = True
        elif self.is_moderator and self.role == 'member':
            self.role = 'moderator'
        else:
            self.is_moderator = False
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.user_id} {self.role} of {self.community_id} ({self.status})"


class CommunityRitualParticipation(models.Model):
    """One shared daily prompt per community; completion tracked per member.

    No question FK — the prompt is derived on demand from
    communities.constellation.build_community_constellation(), which can
    return placeholder prompts with no backing Question row.
    """

    community = models.ForeignKey(
        Community, on_delete=models.CASCADE, related_name='ritual_participations',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_ritual_participations',
    )
    date = models.DateField(db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['community', 'user', 'date'],
                name='unique_community_ritual_per_user_day',
            ),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.community_id} {self.date}"


class CommunityWikiPage(models.Model):
    """Reddit-style community wiki page."""

    community = models.ForeignKey(
        Community, on_delete=models.CASCADE, related_name='wiki_pages',
    )
    slug = models.SlugField(max_length=80)
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True, default='')
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('community', 'slug')
        ordering = ['title']

    def __str__(self):
        return f"{self.community.slug}/{self.slug}"
