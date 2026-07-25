from django.conf import settings
from django.db import models


class FailedIdea(models.Model):
    """Museum of Creative Failures — a gallery of abandoned/failed creative attempts."""

    EXHIBITION_CHOICES = [
        ('burned_ideas', 'Burned Ideas'),
        ('collapsed_challenges', 'Collapsed Challenges'),
        ('beautiful_disasters', 'Beautiful Disasters'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    lesson_learned = models.TextField(blank=True)
    exhibition = models.CharField(max_length=32, choices=EXHIBITION_CHOICES, default='burned_ideas', db_index=True)
    cover_url = models.URLField(blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='failed_ideas')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class DrawSession(models.Model):
    """Live Creation Studio — a simplified shared drawing room (autosave, no real-time video)."""

    title = models.CharField(max_length=200, default='Untitled session')
    host = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='draw_sessions')
    strokes = models.JSONField(default=list, blank=True)
    is_live = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class FutureMemory(models.Model):
    """Future Memories Bank — a deposit vault for imagined/speculative memories."""

    text = models.TextField()
    tag = models.CharField(max_length=64, blank=True)
    is_public = models.BooleanField(default=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='future_memories')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.text[:40]


class Character(models.Model):
    """Imaginary Characters Market — collaborative story characters, purchasable with Outverse coins."""

    RARITY_CHOICES = [
        ('rare', 'Rare'),
        ('epic', 'Epic'),
        ('legendary', 'Legendary'),
    ]

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    rarity = models.CharField(max_length=20, choices=RARITY_CHOICES, default='rare', db_index=True)
    image_url = models.URLField(blank=True)
    price = models.PositiveIntegerField(default=100, help_text='Price in Outverse coins')
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='characters'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class CharacterOwnership(models.Model):
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='owners')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_characters')
    summoned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('character', 'user')
