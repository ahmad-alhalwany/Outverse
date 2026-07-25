from datetime import timedelta

from django.db import models
from django.conf import settings
from django.utils import timezone

from outverse.upload_validators import validate_image_upload, validate_video_upload


def default_story_expiry():
    return timezone.now() + timedelta(hours=24)


FILTER_CHOICES = [
    ('none', 'None'),
    ('cosmic', 'Cosmic Glow'),
    ('glitch', 'Glitch'),
    ('vintage', 'Vintage'),
    ('neon', 'Neon'),
    ('void', 'Void'),
    ('dream', 'Dream'),
    ('pulse', 'Pulse'),
]

# Same taxonomy as posts' mood picker, so the emoji carries the same meaning site-wide.
MOOD_LABELS = {
    '😊': 'Happy',
    '🎨': 'Artistic',
    '💡': 'Inspired',
    '🎉': 'Energetic',
    '✨': 'Spark',
}


class StoryConstellation(models.Model):
    """A permanent, named collection of stories (like highlights) that
    survives past the normal 24h expiry — auto-suggested from a story's mood."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='constellations')
    title = models.CharField(max_length=40)
    cover_image = models.ImageField(
        upload_to='constellations/covers/',
        blank=True,
        null=True,
        validators=[validate_image_upload],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('user', 'title')

    def __str__(self):
        return f"{self.user.username}: {self.title}"


class StoryHighlight(models.Model):
    constellation = models.ForeignKey(
        StoryConstellation, on_delete=models.CASCADE, related_name='highlights',
    )
    story = models.ForeignKey(
        'Story', on_delete=models.CASCADE, related_name='highlight_entries',
    )
    order = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'added_at']
        unique_together = ('constellation', 'story')

    def __str__(self):
        return f"highlight {self.story_id} in {self.constellation_id}"


class CloseFriend(models.Model):
    """`owner` has added `friend` to their close-friends list — only they
    (and the owner) can see stories posted with audience='close_friends'."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='close_friends')
    friend = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='close_friend_of')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('owner', 'friend')

    def __str__(self):
        return f"{self.owner_id} -> {self.friend_id}"


AUDIENCE_CHOICES = [
    ('everyone', 'Everyone'),
    ('close_friends', 'Close Friends'),
]


class Story(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='stories')
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to='stories/', blank=True, null=True, validators=[validate_image_upload])
    video = models.FileField(upload_to='stories/', blank=True, null=True, validators=[validate_video_upload])
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_story_expiry, db_index=True)
    is_active = models.BooleanField(default=True)
    views = models.PositiveIntegerField(default=0)

    # --- Creative studio fields (all non-destructive: applied at render time) ---
    filter_style = models.CharField(max_length=20, choices=FILTER_CHOICES, default='none', blank=True)
    background_style = models.CharField(max_length=40, blank=True, default='')
    overlays = models.JSONField(default=list, blank=True)
    drawing = models.JSONField(default=list, blank=True)

    # --- Differentiator features ---
    mood = models.CharField(max_length=10, blank=True, default='')
    unlock_at = models.DateTimeField(null=True, blank=True)  # "Time Capsule": content hidden from everyone (incl. owner) until this time
    constellation = models.ForeignKey(
        StoryConstellation, null=True, blank=True, on_delete=models.SET_NULL, related_name='stories'
    )

    # --- FB/IG parity features ---
    audience = models.CharField(max_length=20, choices=AUDIENCE_CHOICES, default='everyone')
    shared_post = models.ForeignKey(
        'posts.Post', null=True, blank=True, on_delete=models.SET_NULL, related_name='shared_to_stories'
    )
    location_name = models.CharField(max_length=120, blank=True, default='')
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.text[:30]}"

    class Meta:
        ordering = ['-created_at']

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    @property
    def is_locked(self):
        return bool(self.unlock_at and timezone.now() < self.unlock_at)


class StoryView(models.Model):
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='viewers')
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='story_views')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('story', 'viewer')
        ordering = ['-created_at']

    def __str__(self):
        return f"view of story {self.story_id} by {self.viewer_id}"


class StorySpotlight(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('featured', 'Featured'),
        ('rejected', 'Rejected'),
    ]

    story = models.OneToOneField(
        Story, on_delete=models.CASCADE, related_name='spotlight',
    )
    status = models.CharField(
        max_length=12, choices=STATUS_CHOICES, default='pending', db_index=True,
    )
    score = models.IntegerField(default=0)
    featured_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-score', '-created_at']

    def __str__(self):
        return f"spotlight story {self.story_id} ({self.status})"


class SavedStory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_stories',
    )
    story = models.ForeignKey(
        Story,
        on_delete=models.CASCADE,
        related_name='saved_by',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'story')
        ordering = ['-created_at']

    def __str__(self):
        return f"user {self.user_id} saved story {self.story_id}"


class StoryReaction(models.Model):
    REACTION_TYPES = [
        ('inspired', 'Inspired'),
        ('cosmic', 'Cosmic'),
        ('mindbending', 'Mind-Bending'),
        ('growing', 'Growing'),
        ('spark', 'Spark'),
    ]

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='story_reactions')
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('story', 'user')

    def __str__(self):
        return f"{self.user_id} {self.type} on story {self.story_id}"


class StoryPollVote(models.Model):
    """One vote per (story, poll overlay, voter) — voting again with a
    different option changes the vote, like IG's poll sticker."""
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='poll_votes')
    overlay_id = models.CharField(max_length=64)
    voter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='story_poll_votes')
    option_index = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('story', 'overlay_id', 'voter')

    def __str__(self):
        return f"{self.voter_id} voted {self.option_index} on poll {self.overlay_id}"


class StoryQuestionResponse(models.Model):
    """A free-text answer a viewer submits to a story's question sticker.
    Visible only to the story's owner, like IG's question sticker replies."""
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='question_responses')
    overlay_id = models.CharField(max_length=64)
    responder = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='story_question_responses')
    text = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.responder_id} answered question {self.overlay_id}: {self.text[:30]}"


class StoryReply(models.Model):
    """Public quick reply on a story (shown to owner in a thread)."""
    story = models.ForeignKey(
        Story, on_delete=models.CASCADE, related_name='story_replies',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='story_replies',
    )
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user_id} replied to story {self.story_id}"
