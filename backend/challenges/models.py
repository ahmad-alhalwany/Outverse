from django.conf import settings
from django.db import models

from outverse.upload_validators import validate_image_upload


class Challenge(models.Model):
    CHALLENGE_TYPES = [
        ('writing', 'Writing'),
        ('art', 'Art'),
        ('music', 'Music'),
        ('experimental', 'Experimental'),
        ('practical', 'Practical'),
    ]
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    type = models.CharField(
        max_length=20, choices=CHALLENGE_TYPES, default='writing'
    )
    difficulty = models.CharField(max_length=50, default='medium')
    cover_url = models.URLField(blank=True)
    cover_image = models.ImageField(
        upload_to='challenges/covers/',
        blank=True,
        null=True,
        validators=[validate_image_upload],
    )
    is_daily = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_ai_generated = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_challenges',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class Submission(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions',
    )
    challenge = models.ForeignKey(
        Challenge,
        on_delete=models.CASCADE,
        related_name='submissions',
    )
    content = models.TextField()
    submitted_at = models.DateTimeField(auto_now_add=True)
    is_approved = models.BooleanField(default=False)

    class Meta:
        ordering = ['-submitted_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'challenge'],
                name='unique_submission_per_user_challenge',
            ),
        ]

    def __str__(self):
        return f"{self.user.username} -> {self.challenge.title}"
