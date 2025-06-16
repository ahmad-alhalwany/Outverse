from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Profile

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ('معلومات إضافية', {'fields': ('bio', 'avatar')}),
    )
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'bio')
    search_fields = ('username', 'email', 'first_name', 'last_name')

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'points', 'status')
    search_fields = ('user__username',)
    list_filter = ('status',)
