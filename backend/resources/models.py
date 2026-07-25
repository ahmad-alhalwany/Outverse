from django.conf import settings
from django.db import models


class Resource(models.Model):
    TYPE_CHOICES = [
        ('template', 'Template'),
        ('toolkit', 'Toolkit'),
        ('tutorial', 'Tutorial'),
    ]
    MOOD_CHOICES = [
        ('inspiration', 'Creative Inspiration'),
        ('productivity', 'Productivity Boost'),
        ('learning', 'Learning Path'),
        ('quick', 'Quick Solutions'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='template', db_index=True)
    mood = models.CharField(max_length=20, choices=MOOD_CHOICES, blank=True)
    file_url = models.URLField(blank=True)
    cover_url = models.URLField(blank=True)
    file_size_label = models.CharField(max_length=32, blank=True, help_text='e.g. "1.2 MB"')
    download_count = models.PositiveIntegerField(default=0)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resources',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-download_count', '-created_at']

    def __str__(self):
        return self.title
