from django.contrib import admin

from .models import ChatRoom, Conversation, Message, RoomMessage, UserPresence


@admin.register(UserPresence)
class UserPresenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'last_seen', 'mood_icon', 'status_message')
    search_fields = ('user__username',)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_a', 'user_b', 'updated_at')
    search_fields = ('user_a__username', 'user_b__username')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'conversation', 'sender', 'message_type', 'created_at', 'is_read',
    )
    list_filter = ('message_type', 'is_read')
    search_fields = ('text', 'sender__username')


@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'created_by', 'created_at')
    filter_horizontal = ('members',)
    search_fields = ('name',)


@admin.register(RoomMessage)
class RoomMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'room', 'sender', 'message_type', 'created_at')
    list_filter = ('message_type',)
