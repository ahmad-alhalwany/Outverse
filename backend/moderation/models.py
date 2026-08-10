from django.conf import settings
from django.db import models

# Create your models here.

class FlaggedContent(models.Model):
    CONTENT_TYPES = [
        ('post', 'Post'),
        ('comment', 'Comment'),
        ('reel', 'Reel'),
        ('reel_comment', 'Reel comment'),
        ('story', 'Story'),
        ('live_chat', 'Live chat message'),
        ('chat_message', 'Direct chat message'),
        ('room_message', 'Room chat message'),
        ('bottle', 'Emotion bottle'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('auto_flagged', 'Auto-flagged by AI'),
    ]
    type = models.CharField(max_length=20, choices=CONTENT_TYPES, db_index=True)
    object_id = models.PositiveIntegerField(null=True, blank=True, db_index=True)
    content = models.TextField()
    reporter = models.CharField(max_length=100)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='flagged_contents',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    ai_flagged = models.BooleanField(default=False, db_index=True)
    ai_categories = models.JSONField(default=dict, blank=True)
    ai_scores = models.JSONField(default=dict, blank=True)
    ai_model = models.CharField(max_length=50, blank=True, default='')
    ai_checked_at = models.DateTimeField(null=True, blank=True)
    reason = models.CharField(
        max_length=20,
        blank=True,
        default='',
        choices=[
            ('spam', 'Spam'),
            ('harassment', 'Harassment'),
            ('impersonation', 'Impersonation'),
            ('hate', 'Hate speech'),
            ('other', 'Other'),
        ],
    )
    details = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['type', 'object_id']),
            models.Index(fields=['status', 'ai_flagged']),
        ]

    def __str__(self):
        return f"{self.type} by {self.reporter} - {self.status}"


class UserReport(models.Model):
    REPORT_REASONS = [
        ('spam', 'Spam'),
        ('harassment', 'Harassment'),
        ('impersonation', 'Impersonation'),
        ('hate', 'Hate speech'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('actioned', 'Actioned'),
    ]

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_reports_filed',
    )
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='user_reports_received',
    )
    reason = models.CharField(max_length=20, choices=REPORT_REASONS)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"report {self.reported_user_id} by {self.reporter_id}"


class ContentAppeal(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='content_appeals',
    )
    flagged_content = models.ForeignKey(
        FlaggedContent,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appeals',
    )
    content_type = models.CharField(max_length=20, choices=FlaggedContent.CONTENT_TYPES, db_index=True)
    object_id = models.PositiveIntegerField(db_index=True)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    staff_note = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status'], name='moderation__user_id_8a1f2c_idx'),
            models.Index(fields=['content_type', 'object_id'], name='moderation__content_4b9e1a_idx'),
        ]

    def __str__(self):
        return f"appeal {self.id} — {self.content_type}:{self.object_id} ({self.status})"
