from django.conf import settings
from django.db import models


class Idea(models.Model):
    STATUS_CHOICES = [
        ('proposed', 'مقترح'),
        ('in_progress', 'قيد التنفيذ'),
        ('completed', 'مكتمل'),
    ]
    CATEGORY_CHOICES = [
        ('technology', 'Technology'),
        ('design', 'Design'),
        ('writing', 'Writing'),
        ('art', 'Art'),
        ('education', 'Education'),
        ('environment', 'Environment'),
        ('health', 'Health'),
        ('social', 'Social Impact'),
        ('other', 'Other'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_ideas',
    )
    collaborators = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='collaborated_ideas',
        blank=True,
    )
    votes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='voted_ideas',
        blank=True,
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='proposed'
    )
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='other'
    )
    cover_url = models.URLField(blank=True)
    roles_needed = models.JSONField(default=list, blank=True)
    funding_goal = models.PositiveIntegerField(null=True, blank=True)
    funding_raised = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
