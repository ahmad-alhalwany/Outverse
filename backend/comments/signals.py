from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Comment
from posts.models import Post

@receiver(post_save, sender=Comment)
def update_post_comments_count_on_save(sender, instance, created, **kwargs):
    """تحديث عدد التعليقات عند إضافة أو تعديل تعليق"""
    if created:  # فقط عند إنشاء تعليق جديد
        instance.post.update_comments_count()

@receiver(post_delete, sender=Comment)
def update_post_comments_count_on_delete(sender, instance, **kwargs):
    """تحديث عدد التعليقات عند حذف تعليق"""
    instance.post.update_comments_count()
