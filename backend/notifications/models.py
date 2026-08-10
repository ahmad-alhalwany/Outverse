from django.conf import settings
from django.db import models


class Notification(models.Model):
    VERB_CHOICES = [
        ('reaction', 'Reaction'),
        ('comment', 'Comment'),
        ('follow', 'Follow'),
        ('shop_purchase', 'Shop Purchase'),
        ('challenge_complete', 'Challenge Complete'),
        ('moderation_action', 'Moderation Action'),
        ('chat_message', 'Chat Message'),
        ('achievement_unlocked', 'Achievement Unlocked'),
        ('mention', 'Mention'),
        ('share', 'Share'),
        ('idea_pledge', 'Idea Pledge'),
        ('idea_comment', 'Idea Comment'),
        ('idea_apply', 'Idea Apply'),
        ('idea_accepted', 'Idea Accepted'),
        ('idea_rejected', 'Idea Rejected'),
        ('tip', 'Tip'),
        ('going_live', 'Going Live'),
        ('forge_invite', 'Forge Invite'),
        ('forge_pending', 'Forge Pending'),
        ('forge_approved', 'Forge Approved'),
        ('forge_rejected', 'Forge Rejected'),
        ('studio_invite', 'Studio Invite'),
    ]

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
        null=True,
        blank=True,
    )
    verb = models.CharField(max_length=20, choices=VERB_CHOICES)
    type = models.CharField(max_length=32, blank=True, default='')
    post = models.ForeignKey(
        'posts.Post',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='+',
    )
    reel = models.ForeignKey(
        'reels.Reel',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='+',
    )
    story = models.ForeignKey(
        'stories.Story',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='+',
    )
    idea = models.ForeignKey(
        'ideas.Idea',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='+',
    )
    studio_session = models.ForeignKey(
        'studio.DrawSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
    )
    text = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.actor_id} {self.verb} -> {self.recipient_id}"


class PushSubscription(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='push_subscriptions',
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"push sub for user {self.user_id}"


class EmailPreference(models.Model):
    DIGEST_CHOICES = [
        ('never', 'Never'),
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='email_preferences',
    )
    digest_frequency = models.CharField(max_length=10, choices=DIGEST_CHOICES, default='weekly')
    likes = models.BooleanField(default=True)
    comments = models.BooleanField(default=True)
    follows = models.BooleanField(default=True)
    mentions = models.BooleanField(default=True)
    shares = models.BooleanField(default=True)
    messages = models.BooleanField(default=True)
    tips = models.BooleanField(default=True)
    story_reactions = models.BooleanField(default=True)
    new_follower = models.BooleanField(default=True)
    verified_badge = models.BooleanField(default=True)
    challenge_complete = models.BooleanField(default=True)
    shop_updates = models.BooleanField(default=True)
    marketing = models.BooleanField(default=False)
    digest_time = models.TimeField(default='09:00')
    timezone = models.CharField(max_length=50, default='UTC')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"email prefs for user {self.user_id}"


class MarketingCampaign(models.Model):
    SEGMENT_CHOICES = [
        ('all', 'All opted-in users'),
        ('inactive_30d', 'Opted-in, inactive 30+ days'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sending', 'Sending'),
        ('sent', 'Sent'),
    ]

    subject = models.CharField(max_length=200)
    body_html = models.TextField()
    segment = models.CharField(max_length=20, choices=SEGMENT_CHOICES, default='all')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft', db_index=True)
    recipient_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    sent_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='marketing_campaigns',
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.status}] {self.subject}"
