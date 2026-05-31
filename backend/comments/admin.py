from django.contrib import admin
from .models import Comment, CommentReaction

class CommentReactionInline(admin.TabularInline):
    model = CommentReaction
    extra = 0
    readonly_fields = ['created_at']

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'text_preview', 'parent', 'created_at', 'likes_count', 'is_pinned']
    list_filter = ['created_at', 'is_pinned', 'user', 'post']
    search_fields = ['text', 'user__username', 'post__text']
    readonly_fields = ['created_at', 'updated_at', 'likes_count']
    inlines = [CommentReactionInline]
    
    def text_preview(self, obj):
        return obj.text[:50] + '...' if len(obj.text) > 50 else obj.text
    text_preview.short_description = 'Text Preview'

@admin.register(CommentReaction)
class CommentReactionAdmin(admin.ModelAdmin):
    list_display = ['user', 'comment', 'reaction', 'created_at']
    list_filter = ['reaction', 'created_at', 'user']
    search_fields = ['user__username', 'comment__text']
    readonly_fields = ['created_at']
