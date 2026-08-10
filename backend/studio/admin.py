from django.contrib import admin

from .models import CanvasMedia, CanvasStroke, DrawSession, SessionParticipant


@admin.register(DrawSession)
class DrawSessionAdmin(admin.ModelAdmin):
    list_display = ('title', 'host', 'is_live', 'created_at')
    list_filter = ('is_live',)
    search_fields = ('title', 'host__username')


admin.site.register(SessionParticipant)
admin.site.register(CanvasStroke)
admin.site.register(CanvasMedia)
