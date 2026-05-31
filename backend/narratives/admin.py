from django.contrib import admin

from .models import Segment, Story


class SegmentInline(admin.TabularInline):
    model = Segment
    extra = 0


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ('title', 'genre', 'status', 'is_featured', 'created_at')
    list_filter = ('genre', 'status', 'is_featured')
    search_fields = ('title', 'premise')
    inlines = [SegmentInline]


@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):
    list_display = ('story', 'order', 'author', 'votes', 'created_at')
    list_filter = ('story',)
