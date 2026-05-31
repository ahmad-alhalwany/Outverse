from django.db import models
from django.conf import settings

class Post(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    text = models.TextField(blank=True)
<<<<<<< HEAD
    mood = models.CharField(max_length=20, blank=True)
    tags = models.JSONField(default=list, blank=True)
=======
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
    created_at = models.DateTimeField(auto_now_add=True)
    views = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    likes_count = models.PositiveIntegerField(default=0)
<<<<<<< HEAD
    shares_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.text[:30]}"
=======

    def __str__(self):
        return f"{self.user.username} - {self.text[:30]}"
    
    def update_comments_count(self):
        """تحديث عدد التعليقات"""
        from comments.models import Comment
        self.comments_count = Comment.objects.filter(post=self).count()
        self.save(update_fields=['comments_count'])
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660

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
<<<<<<< HEAD


class Reaction(models.Model):
    REACTION_TYPES = [
        ('inspired', 'Inspired'),
        ('cosmic', 'Cosmic'),
        ('mindbending', 'Mind-Bending'),
        ('growing', 'Growing'),
        ('spark', 'Spark'),
    ]
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='reactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reactions',
    )
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')

    def __str__(self):
        return f"{self.user.username} {self.type} on Post {self.post_id}"


class Comment(models.Model):
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='comments'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
    )
    text = models.TextField(blank=True)
    gif_url = models.URLField(max_length=500, blank=True)
    sticker_url = models.URLField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.user.username}: {self.text[:30]}"


class CommentReaction(models.Model):
    REACTION_TYPES = Reaction.REACTION_TYPES
    comment = models.ForeignKey(
        Comment, on_delete=models.CASCADE, related_name='reactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comment_reactions',
    )
    type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'user')

    def __str__(self):
        return f"{self.user_id} {self.type} on comment {self.comment_id}"


class SavedPost(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='saved_posts',
    )
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, related_name='saves'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')
        ordering = ['-created_at']

    def __str__(self):
        return f"user {self.user_id} saved post {self.post_id}"
=======
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
