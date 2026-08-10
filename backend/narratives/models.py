from django.conf import settings
from django.db import models


class Story(models.Model):
    GENRE_CHOICES = [
        ('fantasy', 'Fantasy'),
        ('scifi', 'Sci-Fi'),
        ('mystery', 'Mystery'),
        ('romance', 'Romance'),
        ('horror', 'Horror'),
        ('adventure', 'Adventure'),
        ('absurd', 'Absurd'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('completed', 'Completed'),
    ]
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('invite_only', 'Invite only'),
    ]
    STUDIO_MODE_CHOICES = [
        ('solo', 'Solo'),
        ('collab', 'Collaborative'),
    ]

    title = models.CharField(max_length=200)
    premise = models.TextField(help_text='The opening line that starts the story')
    cover_url = models.TextField(blank=True, default='')
    cover_prompt = models.CharField(max_length=500, blank=True, default='')
    genre = models.CharField(max_length=20, choices=GENRE_CHOICES, default='other')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='open'
    )
    visibility = models.CharField(
        max_length=20, choices=VISIBILITY_CHOICES, default='public',
    )
    studio_mode = models.CharField(
        max_length=20, choices=STUDIO_MODE_CHOICES, default='solo',
    )
    require_approval = models.BooleanField(
        default=False,
        help_text='When true, new segments need owner approval before readers see them.',
    )
    tone = models.CharField(max_length=120, blank=True, default='')
    pov = models.CharField(max_length=120, blank=True, default='')
    content_rules = models.TextField(blank=True, default='')
    outline = models.JSONField(default=list, blank=True)
    characters = models.JSONField(default=list, blank=True)
    world_notes = models.TextField(blank=True, default='')
    writing_goal = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Optional total word goal for the story.',
    )
    max_segments = models.PositiveIntegerField(default=12)
    target_words = models.PositiveIntegerField(null=True, blank=True)
    is_featured = models.BooleanField(default=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_stories',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title

    def approved_segments(self):
        return self.segments.filter(status='approved')

    def _accepted_collab(self, user):
        if not user:
            return None
        return self.collaborators.filter(user=user, status='accepted').first()

    def is_owner(self, user) -> bool:
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        return self.owner_id == user.id or getattr(user, 'is_staff', False)

    def role_for(self, user) -> str | None:
        if self.is_owner(user):
            return 'owner'
        collab = self._accepted_collab(user)
        return collab.role if collab else None

    def can_edit_bible(self, user) -> bool:
        role = self.role_for(user)
        return role in ('owner', 'editor')

    def can_approve(self, user) -> bool:
        role = self.role_for(user)
        return role in ('owner', 'editor')

    def can_revise_segments(self, user) -> bool:
        return self.can_approve(user)

    def is_studio_member(self, user) -> bool:
        """Owner or accepted collaborator — full World Studio access."""
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if self.is_owner(user):
            return True
        return self._accepted_collab(user) is not None

    def collab_status_for(self, user) -> str | None:
        if not user or not getattr(user, 'is_authenticated', False):
            return None
        if self.is_owner(user):
            return 'owner'
        row = self.collaborators.filter(user=user).exclude(status='removed').first()
        return row.status if row else None

    def can_request_join(self, user) -> bool:
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if self.is_studio_member(user):
            return False
        if self.status == 'completed':
            return False
        status = self.collab_status_for(user)
        if status in ('invited', 'requested'):
            return False
        # Solo rooms still allow a join request (owner may promote to collab).
        return True

    def can_contribute(self, user) -> bool:
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        if self.status == 'completed':
            return False
        if self.is_owner(user):
            return True
        if self.studio_mode == 'solo':
            return False
        role = self.role_for(user)
        return role in ('writer', 'editor', 'narrator')


class StoryCollaborator(models.Model):
    ROLE_CHOICES = [
        ('writer', 'Writer'),
        ('editor', 'Editor'),
        ('narrator', 'Narrator'),
    ]
    STATUS_CHOICES = [
        ('invited', 'Invited'),
        ('requested', 'Join requested'),
        ('accepted', 'Accepted'),
        ('removed', 'Removed'),
    ]

    story = models.ForeignKey(
        Story, on_delete=models.CASCADE, related_name='collaborators',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='story_collaborations',
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='writer')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='invited')
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('story', 'user')]
        ordering = ['created_at']

    def __str__(self):
        return f'{self.user_id}@{self.story_id}:{self.role}/{self.status}'


class Segment(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    story = models.ForeignKey(
        Story, on_delete=models.CASCADE, related_name='segments'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='story_segments',
    )
    content = models.TextField()
    order = models.PositiveIntegerField(default=0)
    votes = models.IntegerField(default=0)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='approved',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.story.title} #{self.order}"


class SegmentRevision(models.Model):
    segment = models.ForeignKey(
        Segment, on_delete=models.CASCADE, related_name='revisions',
    )
    editor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    previous_content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class SegmentDialogue(models.Model):
    segment = models.ForeignKey(
        Segment, on_delete=models.CASCADE, related_name='dialogues',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='segment_dialogues',
    )
    text = models.CharField(max_length=280)
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'dialogue:{self.segment_id}:{self.id}'


class StorySave(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_forge_stories',
    )
    story = models.ForeignKey(
        Story, on_delete=models.CASCADE, related_name='saves',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'story')]
        ordering = ['-created_at']
