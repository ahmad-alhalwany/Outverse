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
    likes = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='liked_failed_ideas', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class FailedIdeaComment(models.Model):
    failed_idea = models.ForeignKey(FailedIdea, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='failed_idea_comments')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.user} on {self.failed_idea}'


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
    emoji = models.CharField(max_length=8, blank=True, default='')
    price = models.PositiveIntegerField(default=100, help_text='Price in Outverse coins')
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='characters'
    )
    is_ai_generated = models.BooleanField(default=False)
    is_public = models.BooleanField(default=True, help_text='Private characters only appear in their creator\'s collection.')
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
