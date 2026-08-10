from django.contrib import admin

from .models import Segment, SegmentDialogue, Story, StoryCollaborator


class SegmentInline(admin.TabularInline):
    model = Segment
    extra = 0


class CollaboratorInline(admin.TabularInline):
    model = StoryCollaborator
    extra = 0


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'genre', 'status', 'visibility', 'require_approval',
        'is_featured', 'created_at',
    )
    list_filter = ('genre', 'status', 'visibility', 'require_approval', 'is_featured')
    search_fields = ('title', 'premise')
    inlines = [SegmentInline, CollaboratorInline]


@admin.register(Segment)
class SegmentAdmin(admin.ModelAdmin):
    list_display = ('story', 'order', 'author', 'status', 'votes', 'created_at')
    list_filter = ('status', 'story')


@admin.register(StoryCollaborator)
class StoryCollaboratorAdmin(admin.ModelAdmin):
    list_display = ('story', 'user', 'role', 'status', 'created_at')
    list_filter = ('role', 'status')


@admin.register(SegmentDialogue)
class SegmentDialogueAdmin(admin.ModelAdmin):
    list_display = ('segment', 'author', 'text', 'created_at')
    search_fields = ('text',)
