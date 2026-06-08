from django.contrib import admin

from .models import Reel, ReelComment, ReelLike, ReelMusicTrack


@admin.register(ReelMusicTrack)
class ReelMusicTrackAdmin(admin.ModelAdmin):
    list_display = ['slug', 'title', 'mood', 'order', 'is_active']


@admin.register(Reel)
class ReelAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'user', 'mood', 'filter_style', 'views',
        'likes_count', 'comments_count', 'is_featured', 'created_at',
    ]
    list_filter = ['mood', 'filter_style', 'is_active', 'is_featured']


@admin.register(ReelComment)
class ReelCommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'reel', 'user', 'created_at']


@admin.register(ReelLike)
class ReelLikeAdmin(admin.ModelAdmin):
    list_display = ['user', 'reel', 'created_at']
