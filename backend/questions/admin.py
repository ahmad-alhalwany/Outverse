from django.contrib import admin
from django.utils import timezone

from .models import Question, QuestionSuggestion, QuestionView
from .views import promote_suggestion


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'category', 'language', 'is_active', 'is_generated', 'times_shown', 'times_answered', 'short_text')
    list_filter = ('category', 'language', 'is_active', 'is_generated')
    search_fields = ('text', 'tags')
    list_editable = ('is_active',)
    actions = ['deactivate']

    @admin.display(description='Text')
    def short_text(self, obj):
        return obj.text[:80]

    @admin.action(description='Deactivate selected')
    def deactivate(self, request, queryset):
        queryset.update(is_active=False)


@admin.register(QuestionView)
class QuestionViewAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'question', 'answered', 'viewed_at')
    list_filter = ('answered', 'question__category')
    search_fields = ('user__username', 'question__text')
    raw_id_fields = ('user', 'question')


@admin.register(QuestionSuggestion)
class QuestionSuggestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'category', 'language', 'short_text', 'submitted_by', 'created_at', 'reviewed_at')
    list_filter = ('status', 'category', 'language')
    search_fields = ('text', 'submitted_by__username')
    list_editable = ('status',)
    readonly_fields = ('created_at', 'reviewed_at', 'submitted_by')
    actions = ['approve_selected', 'reject_selected']

    @admin.display(description='Text')
    def short_text(self, obj):
        return obj.text[:80]

    @admin.action(description='Approve selected (promote to Question bank)')
    def approve_selected(self, request, queryset):
        promoted = 0
        for suggestion in queryset.filter(status='pending'):
            promote_suggestion(suggestion)
            promoted += 1
        self.message_user(request, f"Promoted {promoted} suggestion(s) to the bank.")

    @admin.action(description='Reject selected')
    def reject_selected(self, request, queryset):
        updated = queryset.filter(status='pending').update(
            status='rejected',
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"Rejected {updated} suggestion(s).")
