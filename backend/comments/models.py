from django.db import models
from django.conf import settings
from posts.models import Post

class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    text = models.TextField()
    gif_url = models.URLField(blank=True, null=True)
    sticker_url = models.URLField(blank=True, null=True)
    custom_style = models.JSONField(default=dict, blank=True)  # لتخزين خلفية مخصصة
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    likes_count = models.PositiveIntegerField(default=0)
    is_pinned = models.BooleanField(default=False)

    class Meta:
        ordering = ['-is_pinned', '-created_at']

    def __str__(self):
        return f"{self.user.username} on {self.post.id}: {self.text[:30]}"

    def is_reply(self):
        return self.parent is not None

class CommentReaction(models.Model):
    REACTION_CHOICES = [
        ('👍', 'Thumbs Up'),
        ('❤️', 'Heart'),
        ('😂', 'Laugh'),
        ('😮', 'Surprised'),
        ('😢', 'Sad'),
        ('😡', 'Angry'),
    ]
    
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comment_reactions')
    reaction = models.CharField(max_length=10, choices=REACTION_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['comment', 'user']  # كل مستخدم يمكنه إعطاء تفاعل واحد فقط لكل تعليق

    def __str__(self):
        return f"{self.user.username} {self.reaction} on {self.comment.id}"
