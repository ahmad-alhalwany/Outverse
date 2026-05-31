from django.conf import settings
from django.db import models


class Story(models.Model):
    GENRE_CHOICES = [
        ('fantasy', 'Fantasy'),
        ('scifi', 'Sci-Fi'),
        ('mystery', 'Mystery'),
        ('romance', 'Romance'),
        ('horror', 'Horror'),
        ('adventure', 'Adventure'),
        ('absurd', 'Absurd'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('completed', 'Completed'),
    ]
    title = models.CharField(max_length=200)
    premise = models.TextField(help_text='The opening line that starts the story')
    cover_url = models.URLField(blank=True)
    genre = models.CharField(max_length=20, choices=GENRE_CHOICES, default='other')
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='open'
    )
    max_segments = models.PositiveIntegerField(default=10)
    is_featured = models.BooleanField(default=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_stories',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title


class Segment(models.Model):
    story = models.ForeignKey(
        Story, on_delete=models.CASCADE, related_name='segments'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='story_segments',
    )
    content = models.TextField()
    order = models.PositiveIntegerField(default=0)
    votes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.story.title} #{self.order}"
