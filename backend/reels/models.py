from django.db import models
from django.conf import settings

from outverse.upload_validators import (
    validate_audio_upload,
    validate_image_upload,
    validate_video_upload,
)


class ReelMusicTrack(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    title = models.CharField(max_length=120)
    artist_label = models.CharField(max_length=120, blank=True, default='Outverse')
    audio_file = models.FileField(upload_to='reels/music/', blank=True, null=True, validators=[validate_audio_upload])
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


class ReelTemplate(models.Model):
    """Outverse Pulse packs — templates / AR-lite overlays for create."""

    slug = models.SlugField(max_length=64, unique=True)
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=255, blank=True, default='')
    mood = models.CharField(max_length=20, blank=True, default='cosmic')
    filter_style = models.CharField(max_length=20, blank=True, default='cosmic')
    overlay_stickers = models.JSONField(
        default=list,
        blank=True,
        help_text='[{id,emoji,x,y,scale}] percentage coords',
    )
    overlay_text = models.CharField(max_length=120, blank=True, default='')
    default_sound_label = models.CharField(max_length=120, blank=True, default='')
    music_track = models.ForeignKey(
        ReelMusicTrack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='templates',
    )
    backdrop_preset = models.CharField(
        max_length=32,
        blank=True,
        default='',
        help_text='Green-screen backdrop key: nebula|orbit|void|aurora|none',
    )
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

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
    CAPTIONS_STATUS = [
        ('none', 'None'),
        ('pending', 'Pending'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reels',
    )
    video = models.FileField(upload_to='reels/', validators=[validate_video_upload])
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
    custom_audio = models.FileField(upload_to='reels/audio/', blank=True, null=True, validators=[validate_audio_upload])
    music_start_seconds = models.FloatField(default=0)
    music_end_seconds = models.FloatField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    views = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    shares_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_featured = models.BooleanField(default=False)

    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('subscribers', 'Subscribers'),
    ]
    visibility = models.CharField(
        max_length=12, choices=VISIBILITY_CHOICES, default='public', db_index=True,
    )
    required_tier = models.ForeignKey(
        'subscriptions.CreatorTier', on_delete=models.SET_NULL, null=True, blank=True, related_name='gated_reels',
    )
    inspiration_question = models.ForeignKey(
        'questions.Question',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='inspired_reels',
    )
    source_idea = models.ForeignKey(
        'ideas.Idea',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='inspired_reels',
    )
    remix_of = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='remixes',
        help_text='Original reel this is a remix of',
    )
    stitch_of = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='stitches',
        help_text='Original reel this is a stitch of (beginning segment used)',
    )
    allow_remix = models.BooleanField(default=True)
    allow_weave = models.BooleanField(
        default=True,
        help_text='Allow Weave (stitch) derivatives of this signal',
    )
    allow_download = models.BooleanField(
        default=False,
        help_text='Allow others to export / download this signal',
    )
    template = models.ForeignKey(
        ReelTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reels',
    )
    captions = models.JSONField(
        default=list,
        blank=True,
        help_text='[{start,end,text}] seconds',
    )
    captions_status = models.CharField(
        max_length=12, choices=CAPTIONS_STATUS, default='none', db_index=True,
    )
    captions_language = models.CharField(max_length=8, blank=True, default='en')
    effect_meta = models.JSONField(
        default=dict,
        blank=True,
        help_text='Green screen / AR-lite: {backdrop,chroma_key,overlays,...}',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Reel {self.id} by {self.user_id}"


class LongFormVideo(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('scheduled', 'Scheduled'),
        ('published', 'Published'),
    ]
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('followers', 'Followers'),
        ('subscribers', 'Subscribers'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='longform_videos',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    video = models.FileField(upload_to='videos/longform/', validators=[validate_video_upload])
    thumbnail = models.ImageField(
        upload_to='videos/longform/thumbnails/',
        blank=True,
        null=True,
        validators=[validate_image_upload],
    )
    duration_seconds = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=12, choices=STATUS_CHOICES, default='draft', db_index=True,
    )
    premiere_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    visibility = models.CharField(
        max_length=12, choices=VISIBILITY_CHOICES, default='public', db_index=True,
    )
    required_tier = models.ForeignKey(
        'subscriptions.CreatorTier',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gated_longform_videos',
    )
    views = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.user_id})"


class VideoChapter(models.Model):
    video = models.ForeignKey(
        LongFormVideo, on_delete=models.CASCADE, related_name='chapters',
    )
    title = models.CharField(max_length=120)
    start_seconds = models.PositiveIntegerField()
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'start_seconds', 'id']

    def __str__(self):
        return f"{self.video_id}: {self.title}"


class VideoPlaylist(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='video_playlists',
    )
    title = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_id}: {self.title}"


class VideoPlaylistItem(models.Model):
    playlist = models.ForeignKey(
        VideoPlaylist, on_delete=models.CASCADE, related_name='items',
    )
    video = models.ForeignKey(
        LongFormVideo, on_delete=models.CASCADE, related_name='playlist_items',
    )
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']
        unique_together = ('playlist', 'video')

    def __str__(self):
        return f"{self.playlist_id} -> {self.video_id}"


class ReelDim(models.Model):
    """User hid a reel from their Pulse feed (TikTok-style Not interested)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='dimmed_reels',
    )
    reel = models.ForeignKey(
        Reel,
        on_delete=models.CASCADE,
        related_name='dimmed_by',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'reel')
        ordering = ['-created_at']

    def __str__(self):
        return f"user {self.user_id} dimmed reel {self.reel_id}"


class ReelLike(models.Model):
    REACTION_TYPES = [
        ('inspired', 'Inspired'),
        ('cosmic', 'Cosmic'),
        ('mindbending', 'Mind-Bending'),
        ('growing', 'Growing'),
        ('spark', 'Spark'),
    ]
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
    type = models.CharField(max_length=20, choices=REACTION_TYPES, default='spark')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'reel')


class SavedReel(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_reels',
    )
    reel = models.ForeignKey(
        Reel,
        on_delete=models.CASCADE,
        related_name='saved_by',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

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
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    edited_at = models.DateTimeField(null=True, blank=True)
    quoted_comment = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
    )
    pin_order = models.PositiveSmallIntegerField(null=True, blank=True, db_index=True)
    sparked_by_author = models.BooleanField(default=False)

    MAX_PINNED = 3

    @property
    def is_pinned(self):
        return self.pin_order is not None

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


class ReelCommentVote(models.Model):
    BOOST = 1
    DIM = -1
    VALUE_CHOICES = [(BOOST, 'boost'), (DIM, 'dim')]

    comment = models.ForeignKey(
        ReelComment, on_delete=models.CASCADE, related_name='votes',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reel_comment_votes',
    )
    value = models.SmallIntegerField(choices=VALUE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'user')


class ReelCommentTranslation(models.Model):
    comment = models.ForeignKey(
        ReelComment, on_delete=models.CASCADE, related_name='translations',
    )
    language = models.CharField(max_length=5, db_index=True)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'language')


class ReelDraft(models.Model):
    """Auto-saved in-progress reel metadata (video re-selected on publish)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reel_drafts',
    )
    caption = models.TextField(blank=True, default='')
    mood = models.CharField(max_length=20, blank=True, default='cosmic')
    filter_style = models.CharField(max_length=20, blank=True, default='none')
    tags = models.JSONField(default=list, blank=True)
    music_track = models.ForeignKey(
        ReelMusicTrack,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='drafts',
    )
    sound_label = models.CharField(max_length=120, blank=True, default='')
    music_start_seconds = models.FloatField(default=0)
    music_end_seconds = models.FloatField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"reel draft {self.id} for user {self.user_id}"


class ReelShareLog(models.Model):
    CHANNEL_CHOICES = [
        ('copy', 'Copy link'),
        ('native', 'Native share'),
        ('twitter', 'X / Twitter'),
        ('whatsapp', 'WhatsApp'),
        ('facebook', 'Facebook'),
        ('telegram', 'Telegram'),
        ('linkedin', 'LinkedIn'),
        ('reddit', 'Reddit'),
        ('bluesky', 'Bluesky'),
        ('email', 'Email'),
        ('dm', 'Direct message'),
        ('story', 'Share to story'),
        ('embed', 'Embed'),
        ('card', 'Share card'),
        ('unknown', 'Unknown'),
    ]

    reel = models.ForeignKey(Reel, on_delete=models.CASCADE, related_name='share_logs')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reel_share_logs',
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='unknown', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['reel', 'channel']),
            models.Index(fields=['reel', 'user']),
        ]

    def __str__(self):
        return f"share reel {self.reel_id} via {self.channel}"


class LiveSession(models.Model):
    PROTOCOL_CHOICES = [
        ('webrtc', 'WebRTC'),
        ('rtmp', 'RTMP'),
        ('srt', 'SRT'),
    ]
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('live', 'Live'),
        ('ended', 'Ended'),
        ('cancelled', 'Cancelled'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_sessions',
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    thumbnail = models.ImageField(upload_to='live/thumbnails/', null=True, blank=True)
    stream_protocol = models.CharField(max_length=10, choices=PROTOCOL_CHOICES, default='webrtc')
    stream_key = models.CharField(max_length=64, unique=True, db_index=True)
    rtmp_url = models.URLField(blank=True)
    playback_url = models.URLField(blank=True)
    provider_input_id = models.CharField(max_length=128, blank=True)
    webrtc_publish_url = models.URLField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled', db_index=True)
    scheduled_at = models.DateTimeField(null=True, blank=True, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    current_viewers = models.PositiveIntegerField(default=0)
    peak_viewers = models.PositiveIntegerField(default=0)
    total_views = models.PositiveIntegerField(default=0)
    is_public = models.BooleanField(default=True)
    chat_enabled = models.BooleanField(default=True)
    recording_enabled = models.BooleanField(default=False)
    recording_url = models.URLField(blank=True)
    moderation_enabled = models.BooleanField(default=True)
    auto_moderation = models.BooleanField(default=True)
    slowmode_seconds = models.PositiveIntegerField(default=0)
    chat_banned_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='live_chat_bans',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"LiveSession {self.id} by {self.user_id}"

    @property
    def is_live(self):
        return self.status == 'live'

    @property
    def duration_seconds(self):
        from django.utils import timezone
        if not self.started_at:
            return 0
        end = self.ended_at or timezone.now()
        return max(0, int((end - self.started_at).total_seconds()))

    def start_stream(self):
        from django.utils import timezone
        self.status = 'live'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at', 'updated_at'])

    def end_stream(self):
        from django.utils import timezone
        self.status = 'ended'
        self.ended_at = timezone.now()
        self.current_viewers = 0
        self.save(update_fields=['status', 'ended_at', 'current_viewers', 'updated_at'])


class LiveReaction(models.Model):
    REACTION_TYPES = [
        ('heart', 'Heart'),
        ('fire', 'Fire'),
        ('spark', 'Spark'),
        ('clap', 'Clap'),
        ('thumbs_up', 'Thumbs Up'),
    ]

    session = models.ForeignKey(LiveSession, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_reactions',
    )
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']


class LiveChatMessage(models.Model):
    session = models.ForeignKey(LiveSession, on_delete=models.CASCADE, related_name='chat_messages')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_chat_messages',
    )
    text = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_live_messages',
    )

    class Meta:
        ordering = ['created_at']


class LiveSessionView(models.Model):
    session = models.ForeignKey(LiveSession, on_delete=models.CASCADE, related_name='session_views')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_session_views',
    )
    viewed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-viewed_at']


class LiveViewer(models.Model):
    session = models.ForeignKey(LiveSession, on_delete=models.CASCADE, related_name='viewers')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='live_views',
    )
    joined_at = models.DateTimeField(auto_now_add=True, db_index=True)
    left_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['-joined_at']
        unique_together = ('session', 'user')

    def leave(self):
        from django.utils import timezone
        self.is_active = False
        self.left_at = timezone.now()
        self.save(update_fields=['is_active', 'left_at'])

