from django.contrib import admin
from .models import Story

@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ['user', 'text', 'created_at', 'views', 'is_active']
    list_filter = ['created_at', 'is_active', 'user']
    search_fields = ['text', 'user__username']
    readonly_fields = ['created_at', 'views']
