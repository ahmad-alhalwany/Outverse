from django.urls import path

from .views import (
    ChatAdminOverviewView,
    ChatConfigView,
    ConversationListView,
    ConversationMessagesView,
    FriendsListView,
    MessageUploadView,
    PresencePingView,
    RoomListCreateView,
    RoomMessagesView,
    RoomTypingView,
    RoomUploadView,
    SendMessageView,
    SharedSpaceView,
    StartConversationView,
    TypingView,
)

urlpatterns = [
    path('config/', ChatConfigView.as_view(), name='chat-config'),
    path('admin/overview/', ChatAdminOverviewView.as_view(), name='chat-admin-overview'),
    path('friends/', FriendsListView.as_view(), name='chat-friends'),
    path('presence/', PresencePingView.as_view(), name='chat-presence'),
    path('conversations/', ConversationListView.as_view(), name='chat-conversations'),
    path(
        'conversations/start/',
        StartConversationView.as_view(),
        name='chat-start',
    ),
    path('send/', SendMessageView.as_view(), name='chat-send'),
    path(
        'conversations/<int:conversation_id>/messages/',
        ConversationMessagesView.as_view(),
        name='chat-messages',
    ),
    path(
        'conversations/<int:conversation_id>/typing/',
        TypingView.as_view(),
        name='chat-typing',
    ),
    path(
        'conversations/<int:conversation_id>/upload/',
        MessageUploadView.as_view(),
        name='chat-upload',
    ),
    path('rooms/', RoomListCreateView.as_view(), name='chat-rooms'),
    path(
        'rooms/<int:room_id>/messages/',
        RoomMessagesView.as_view(),
        name='chat-room-messages',
    ),
    path(
        'rooms/<int:room_id>/typing/',
        RoomTypingView.as_view(),
        name='chat-room-typing',
    ),
    path(
        'rooms/<int:room_id>/upload/',
        RoomUploadView.as_view(),
        name='chat-room-upload',
    ),
    path('shared_space/', SharedSpaceView.as_view(), name='chat-shared-space'),
]
