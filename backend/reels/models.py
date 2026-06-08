from django.conf import settings
from django.db import models


class ReelMusicTrack(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    title = models.CharField(max_length=120)
    artist_label = models.CharField(max_length=120, blank=True, default='Outverse')
    audio_file = models.FileField(upload_to='reels/music/', blank=True, null=True)
    source_path = models.CharField(
        max_length=255,
        blank=True,
        help_text='Static path e.g. /sounds/chime.mp3 when no uploaded file',
    )
    mood = models.CharField(max_length=20, blank=True, default='cosmic')
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'title']

    def __str__(self):
        return self.title


class Reel(models.Model):
    MOOD_CHOICES = [
        ('cosmic', 'Cosmic'),
        ('pulse', 'Pulse'),
        ('void', 'Void'),
        ('spark', 'Spark'),
        ('dream', 'Dream'),
    ]
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

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reels',
    )
    video = models.FileField(upload_to='reels/')
    caption = models.TextField(blank=True)
    mood = models.CharField(max_length=20, choices=MOOD_CHOICES, default='cosmic')
    filter_style = models.CharField(
        max_length=20, choices=FILTER_CHOICES, default='none'
    )
    tags = models.JSONField(default=list, blank=True)
    sound_label = models.CharField(max_length=120, blank=True, default='Original signal')
    music_track = models.ForeignKey(
        ReelMusicTrack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reels',
    )
    custom_audio = models.FileField(upload_to='reels/audio/', blank=True, null=True)
    music_start_seconds = models.FloatField(default=0)
    music_end_seconds = models.FloatField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    views = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Reel {self.id} by {self.user_id}"


class ReelLike(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reel_likes',
    )
    reel = models.ForeignKey(
        Reel,
        on_delete=models.CASCADE,
        related_name='likes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'reel')


class ReelComment(models.Model):
    reel = models.ForeignKey(
        Reel,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reel_comments',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
    )
    text = models.TextField(blank=True)
    gif_url = models.URLField(max_length=500, blank=True)
    sticker_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"ReelComment {self.id} on reel {self.reel_id}"


class ReelCommentReaction(models.Model):
    REACTION_TYPES = [
        ('inspired', 'Inspired'),
        ('cosmic', 'Cosmic'),
        ('mindbending', 'Mind-Bending'),
        ('growing', 'Growing'),
        ('spark', 'Spark'),
    ]
    comment = models.ForeignKey(
        ReelComment,
        on_delete=models.CASCADE,
        related_name='reactions',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reel_comment_reactions',
    )
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'user')

    def __str__(self):
        return f"{self.user_id} {self.type} on reel comment {self.comment_id}"
