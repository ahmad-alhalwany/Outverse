from django.conf import settings
from django.db import models


class Question(models.Model):
    """A creative prompt that nudges users to publish unconventional posts."""

    CATEGORY_CHOICES = [
        ('historical', 'Historical what-if'),
        ('fantasy', 'Fantasy & worlds'),
        ('scifi', 'Science & future'),
        ('philosophical', 'Philosophical'),
        ('mystery', 'Mystery & secrets'),
        ('surreal', 'Surreal & absurd'),
        ('everyday', 'Everyday magic'),
        ('emotional', 'Emotional'),
    ]

    LANGUAGE_CHOICES = [
        ('en', 'English'),
        ('ar', 'Arabic'),
    ]

    text = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='en', db_index=True)
    tags = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_generated = models.BooleanField(default=False, db_index=True)
    times_shown = models.PositiveIntegerField(default=0)
    times_answered = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
        constraints = [
            models.UniqueConstraint(
                fields=['text', 'language'],
                name='unique_question_text_per_language',
            ),
        ]

    def __str__(self):
        return f"[{self.category}/{self.language}] {self.text[:60]}"


class QuestionView(models.Model):
    """Tracks which questions a user has already seen — used to avoid repeats."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='question_views',
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='views',
    )
    answered = models.BooleanField(default=False)
    skipped = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'question')
        ordering = ['-viewed_at']

    def __str__(self):
        return f"user {self.user_id} viewed question {self.question_id}"


class QuestionSuggestion(models.Model):
    """Community-submitted prompt ideas awaiting moderation.

    Approving a suggestion promotes it into a real ``Question`` row and
    marks the suggestion ``approved``. Rejecting keeps it for analytics
    but excludes it from the bank.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    text = models.TextField()
    category = models.CharField(max_length=20, choices=Question.CATEGORY_CHOICES, default='surreal')
    language = models.CharField(max_length=2, choices=Question.LANGUAGE_CHOICES, default='en')
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='question_suggestions',
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    reviewer_note = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['text', 'language'],
                name='unique_suggestion_text_per_language',
            ),
        ]

    def __str__(self):
        return f"[{self.status}] {self.text[:60]}"


class RitualParticipation(models.Model):
    """Tracks daily ritual engagement — morning prompt / evening reflection.

    One row per (user, date, period). Used to:
    - guarantee the same prompt is returned for an entire morning/evening
    - compute the user's current streak of consecutive days with any ritual
    """

    PERIOD_CHOICES = [
        ('morning', 'Morning prompt'),
        ('evening', 'Evening reflection'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ritual_participations',
    )
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='rituals')
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    date = models.DateField(db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date', '-id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'date', 'period'],
                name='unique_ritual_per_user_day_period',
            ),
        ]

    def __str__(self):
        return f"{self.user_id} {self.period} {self.date}"
