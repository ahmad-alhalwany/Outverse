from django.conf import settings
from django.db import models
from django.utils import timezone

from outverse.upload_validators import validate_audio_upload


class TimeCapsule(models.Model):
    """A message sealed until a future date — opened only by its author.

    Part of Outverse's "ritual" layer: a small, emotionally-weighted
    artifact that gives users a reason to come back weeks or months later.
    Voice is optional; text is required. ``opened_at`` is set the first
    time the user opens the capsule after ``open_at`` has passed.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='time_capsules',
    )
    text = models.TextField()
    voice = models.FileField(
        upload_to='capsules/voice/',
        null=True,
        blank=True,
        validators=[validate_audio_upload],
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    open_at = models.DateTimeField(db_index=True)
    opened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Capsule {self.id} for user {self.user_id} (opens {self.open_at.date()})"

    @property
    def is_unlocked(self) -> bool:
        return timezone.now() >= self.open_at

    @property
    def is_opened(self) -> bool:
        return self.opened_at is not None
