from django.contrib import admin

from .models import TimeCapsule


@admin.register(TimeCapsule)
class TimeCapsuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'created_at', 'open_at', 'opened_at', 'is_unlocked')
    list_filter = ('open_at', 'created_at')
    search_fields = ('text', 'user__username')
    readonly_fields = ('created_at', 'opened_at')
    raw_id_fields = ('user',)
