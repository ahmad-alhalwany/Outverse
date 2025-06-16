from django.conf import settings
from django.db import models

class Idea(models.Model):
    STATUS_CHOICES = [
        ('proposed', 'مقترح'),
        ('in_progress', 'قيد التنفيذ'),
        ('completed', 'مكتمل'),
    ]
    title = models.CharField(max_length=200)
    description = models.TextField()
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_ideas')
    collaborators = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='collaborated_ideas', blank=True)
    votes = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='voted_ideas', blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='proposed')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
