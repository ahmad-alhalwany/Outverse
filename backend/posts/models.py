from django.conf import settings
from django.db import models

from outverse.upload_validators import validate_audio_upload, validate_image_upload, validate_video_upload

class Post(models.Model):
    POST_TYPE_CHOICES = [
        ('normal', 'Normal'),
        ('poll', 'Poll'),
        ('question', 'Question'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    post_type = models.CharField(max_length=20, choices=POST_TYPE_CHOICES, default='normal', db_index=True)
    text = models.TextField(blank=True)
    mood = models.CharField(max_length=20, blank=True)
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    views = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)
    shares_count = models.PositiveIntegerField(default=0)
    reposts_count = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(null=True, blank=True)

    # ---- Audience & reply controls ----
    VISIBILITY_CHOICES = [
        ('public', 'Public'),
        ('followers', 'Followers'),
        ('subscribers', 'Subscribers'),
    ]
    REPLY_CONTROL_CHOICES = [
        ('everyone', 'Everyone'),
        ('followers', 'Followers'),
        ('nobody', 'No one'),
    ]
    visibility = models.CharField(
        max_length=12, choices=VISIBILITY_CHOICES, default='public', db_index=True,
    )
    reply_control = models.CharField(
        max_length=12, choices=REPLY_CONTROL_CHOICES, default='everyone',
    )
    # Only used when visibility='subscribers'. Null = any active subscription
    # to this creator unlocks the post; set = requires that tier or higher
    # (by price) from the same creator.
    required_tier = models.ForeignKey(
        'subscriptions.CreatorTier', on_delete=models.SET_NULL, null=True, blank=True, related_name='gated_posts',
    )

    # ---- Echo / Quote (repost) ----
    # When set, this post references another post. A "pure echo" (repost)
    # has empty text/no media and just surfaces the original. A "quote"
    # carries the reposter's own text on top of the embedded original.
    repost_of = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reposts',
        db_index=True,
    )

    # ---- Constellation (thread chain) ----
    # A thread links a sequence of posts by the same author into one story.
    # ``thread_root`` points to the first post; the root's own value is null.
    # ``thread_seq`` orders posts within the chain (root = 0).
    thread_root = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='thread_members',
        db_index=True,
    )
    thread_seq = models.PositiveIntegerField(default=0)

    inspiration_question = models.ForeignKey(
        'questions.Question',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='inspired_posts',
        db_index=True,
    )

    community = models.ForeignKey(
        'communities.Community',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='posts',
        db_index=True,
    )
    flair = models.CharField(max_length=40, blank=True, default='')
    is_spoiler = models.BooleanField(default=False)
    location_name = models.CharField(max_length=120, blank=True, default='')
    location_lat = models.FloatField(null=True, blank=True)
    location_lng = models.FloatField(null=True, blank=True)

    # ---- Boost (paid feed promotion) ----
    is_boosted = models.BooleanField(default=False, db_index=True)
    boost_expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    # Soft-hide for moderation hard-block / appeals restore
    is_active = models.BooleanField(default=True, db_index=True)

    # ---- Pinned signal (profile) ----
    # Owner can pin up to MAX_PROFILE_PINS posts on their profile.
    is_profile_pinned = models.BooleanField(default=False, db_index=True)
    profile_pinned_at = models.DateTimeField(null=True, blank=True)

    # ---- Anchored signal (community sticky) ----
    is_community_pinned = models.BooleanField(default=False, db_index=True)
    community_pinned_at = models.DateTimeField(null=True, blank=True)

    # ---- Cross-Echo (crosspost into another community) ----
    crosspost_of = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='crossposts',
        db_index=True,
    )

    # ---- Cross-posting ----
    # Sharing a Reel into the main feed as an embedded card — mirrors
    # Story.shared_post's cross-content reference pattern.
    shared_reel = models.ForeignKey(
        'reels.Reel', null=True, blank=True, on_delete=models.SET_NULL, related_name='shared_to_posts',
    )

    MAX_PROFILE_PINS = 3
    MAX_COMMUNITY_PINS = 3

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.text[:30]}"

    @property
    def is_pure_repost(self) -> bool:
        """A repost with no added commentary or media of its own."""
        return bool(self.repost_of_id) and not (self.text or '').strip()

    @property
    def is_boost_active(self) -> bool:
        from django.utils import timezone
        return bool(self.is_boosted and self.boost_expires_at and self.boost_expires_at > timezone.now())


class PollOption(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='poll_options')
    text = models.CharField(max_length=120)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return f"{self.post_id}: {self.text[:40]}"


class PollVote(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='poll_votes')
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='poll_votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_id} voted {self.option_id} on {self.post_id}"


class QuestionAnswer(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='question_answers')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='question_answers')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_id} answered {self.post_id}: {self.text[:30]}"

MEDIA_TYPE_CHOICES = (
    ('image', 'Image'),
    ('video', 'Video'),
    ('audio', 'Audio'),
)

class PostMedia(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='media')
    media_file = models.FileField(upload_to='posts/media/')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    alt_text = models.CharField(max_length=280, blank=True, default='')
    order = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.media_type.capitalize()} for Post {self.post.id}"

    def clean(self):
        super().clean()
        if self.media_type == 'video':
            validate_video_upload(self.media_file)
        elif self.media_type == 'audio':
            validate_audio_upload(self.media_file)
        else:
            validate_image_upload(self.media_file)


class Reaction(models.Model):
    REACTION_TYPES = [
        ('inspired', 'Inspired'),
        ('cosmic', 'Cosmic'),
        ('mindbending', 'Mind-Bending'),
        ('growing', 'Growing'),
        ('spark', 'Spark'),
    ]
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='reactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reactions',
    )
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('post', 'user')

    def __str__(self):
        return f"{self.user.username} {self.type} on Post {self.post_id}"


class Comment(models.Model):
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='comments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments',
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
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    # Echo quote — when replying, embed a snippet of the parent signal.
    quoted_comment = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='quotes',
    )

    # Host controls (post author): pin order (1–3), spark = creator highlight.
    pin_order = models.PositiveSmallIntegerField(null=True, blank=True, db_index=True)
    sparked_by_author = models.BooleanField(default=False)

    MAX_PINNED = 3

    @property
    def is_pinned(self):
        return self.pin_order is not None

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.username}: {self.text[:30]}"


class CommentReaction(models.Model):
    REACTION_TYPES = Reaction.REACTION_TYPES
    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name='reactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comment_reactions',
    )
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'user')

    def __str__(self):
        return f"{self.user_id} {self.type} on comment {self.comment_id}"


class PostVote(models.Model):
    """Reddit-style boost/dim (upvote/downvote) on a post."""

    BOOST = 1
    DIM = -1
    VALUE_CHOICES = [(BOOST, 'boost'), (DIM, 'dim')]

    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='votes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='post_votes',
    )
    value = models.SmallIntegerField(choices=VALUE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')

    def __str__(self):
        label = 'boost' if self.value == self.BOOST else 'dim'
        return f"{self.user_id} {label} on post {self.post_id}"


class CommentVote(models.Model):
    """Reddit-style boost/dim on a comment thread."""

    BOOST = 1
    DIM = -1
    VALUE_CHOICES = [(BOOST, 'boost'), (DIM, 'dim')]

    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name='votes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comment_votes',
    )
    value = models.SmallIntegerField(choices=VALUE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'user')

    def __str__(self):
        label = 'boost' if self.value == self.BOOST else 'dim'
        return f"{self.user_id} {label} on comment {self.comment_id}"


class CommentTranslation(models.Model):
    """Cached LLM translation of comment text."""

    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name='translations'
    )
    language = models.CharField(max_length=5, db_index=True)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'language')

    def __str__(self):
        return f"comment {self.comment_id} → {self.language}"


class SavedCollection(models.Model):
    """A user-named folder for organizing saved posts (Instagram-style)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_collections',
    )
    name = models.CharField(max_length=60)
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=False, db_index=True)
    cover_url = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['name']

    def __str__(self):
        return f"{self.user_id}:{self.name}"


class SavedPost(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_posts',
    )
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='saves'
    )
    collection = models.ForeignKey(
        SavedCollection,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='items',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')
        ordering = ['-created_at']

    def __str__(self):
        return f"user {self.user_id} saved post {self.post_id}"


class PostDraft(models.Model):
    """Auto-saved in-progress posts.

    The frontend debounces saves while the user types so they never lose
    work to a refresh or crash. On publish, the corresponding draft is
    deleted; on explicit discard, the user can remove it from a drafts tray.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='post_drafts',
    )
    text = models.TextField(blank=True, default='')
    mood = models.CharField(max_length=20, blank=True, default='')
    tags = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-updated_at']
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(text=''),
                name='post_draft_not_empty',
            ),
        ]

    def __str__(self):
        return f"draft {self.id} for user {self.user_id}"


class ScheduledPost(models.Model):
    """A post queued to publish at a future time.

    ``payload`` mirrors the plain-text post fields (text/mood/tags/
    visibility/required_tier_id/community_id). Media can be staged either
    by storing ``media_ids`` in the payload or by uploading ``ScheduledMedia``
    rows. ``publish_scheduled_posts`` (run on a cron) turns due rows into
    real Posts."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('published', 'Published'),
        ('failed', 'Failed'),
        ('canceled', 'Canceled'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='scheduled_posts',
    )
    payload = models.JSONField()
    publish_at = models.DateTimeField(db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    published_post = models.ForeignKey(
        'Post', on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    error = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['publish_at']

    def __str__(self):
        return f"scheduled post {self.id} for user {self.user_id} at {self.publish_at}"


class ScheduledMedia(models.Model):
    scheduled_post = models.ForeignKey(ScheduledPost, on_delete=models.CASCADE, related_name='media_files')
    media_file = models.FileField(upload_to='scheduled/')
    media_type = models.CharField(max_length=10, default='image')  # image|video|audio
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class PostEditHistory(models.Model):
    """Snapshot of a post's text before each edit (Facebook-style history)."""

    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='edit_history'
    )
    previous_text = models.TextField(blank=True)
    edited_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-edited_at']

    def __str__(self):
        return f"edit of post {self.post_id} at {self.edited_at:%Y-%m-%d %H:%M}"


class PostShareLog(models.Model):
    """Per-channel share events for analytics and deduped notifications."""

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

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='share_logs')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='post_share_logs',
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='unknown', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['post', 'channel']),
            models.Index(fields=['post', 'user']),
        ]

    def __str__(self):
        return f"share post {self.post_id} via {self.channel}"


class FeedFeedback(models.Model):
    """Negative feed signals — not interested, see less from author."""

    FEEDBACK_TYPES = [
        ('not_interested', 'Not interested'),
        ('see_less', 'See less from author'),
        ('hide_post', 'Hide this post'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='feed_feedback',
    )
    post = models.ForeignKey(
        Post, null=True, blank=True, on_delete=models.CASCADE, related_name='feed_feedback',
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='feed_penalties',
    )
    feedback_type = models.CharField(max_length=20, choices=FEEDBACK_TYPES, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'author']),
            models.Index(fields=['user', 'post']),
        ]

    def __str__(self):
        return f"{self.feedback_type} by user {self.user_id}"


class OrbitList(models.Model):
    """Curated member list whose posts form a chronological feed (Twitter Lists → Orbit Lists)."""

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orbit_lists',
    )
    title = models.CharField(max_length=80)
    description = models.TextField(blank=True, default='')
    is_private = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.title} (owner={self.owner_id})"


class OrbitListMember(models.Model):
    orbit_list = models.ForeignKey(
        OrbitList, on_delete=models.CASCADE, related_name='members',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='orbit_list_memberships',
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('orbit_list', 'user')
        ordering = ['-added_at']

    def __str__(self):
        return f"list {self.orbit_list_id} ← user {self.user_id}"


class OrbitListFollower(models.Model):
    """Optional: follow someone else's public Orbit List."""

    orbit_list = models.ForeignKey(
        OrbitList, on_delete=models.CASCADE, related_name='followers',
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='followed_orbit_lists',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('orbit_list', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"user {self.user_id} follows list {self.orbit_list_id}"
