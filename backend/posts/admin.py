from django.contrib import admin
from .models import Post, PostMedia

class PostMediaInline(admin.TabularInline):
    model = PostMedia
    extra = 1

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['user', 'text', 'created_at', 'views', 'likes_count', 'comments_count']
    list_filter = ['created_at', 'user']
    search_fields = ['text', 'user__username']
    readonly_fields = ['created_at', 'views', 'likes_count', 'comments_count']
    inlines = [PostMediaInline]

@admin.register(PostMedia)
class PostMediaAdmin(admin.ModelAdmin):
    list_display = ['post', 'media_type', 'media_file', 'order']
