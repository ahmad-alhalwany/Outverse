from django.db import models
from django.conf import settings

class Post(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    text = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    views = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.user.username} - {self.text[:30]}"
    
    def update_comments_count(self):
        """تحديث عدد التعليقات"""
        from comments.models import Comment
        self.comments_count = Comment.objects.filter(post=self).count()
        self.save(update_fields=['comments_count'])

MEDIA_TYPE_CHOICES = (
    ('image', 'Image'),
    ('video', 'Video'),
)

class PostMedia(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='media')
    media_file = models.FileField(upload_to='posts/media/')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    order = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.media_type.capitalize()} for Post {self.post.id}"
