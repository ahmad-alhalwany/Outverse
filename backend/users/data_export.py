"""Build a portable GDPR-style export payload for a user."""

from __future__ import annotations

from django.contrib.auth import get_user_model

User = get_user_model()


def build_user_export(user) -> dict:
    from chat.models import Message
    from posts.models import Comment, Post
    from preferences.models import UserPreferences
    from reels.models import Reel

    prefs = UserPreferences.objects.filter(user=user).first()
    posts = list(
        Post.objects.filter(user=user).values(
            'id', 'text', 'created_at', 'views', 'likes_count', 'comments_count', 'shares_count',
        )[:500]
    )
    comments = list(
        Comment.objects.filter(user=user).values('id', 'post_id', 'text', 'created_at')[:500]
    )
    reels = list(
        Reel.objects.filter(user=user).values('id', 'caption', 'created_at', 'views')[:200]
    )
    messages = list(
        Message.objects.filter(sender=user).values('id', 'conversation_id', 'text', 'created_at')[:500]
    )

    return {
        'account': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'bio': user.bio,
            'location': user.location,
            'is_verified': user.is_verified,
            'badge_verified': getattr(user, 'badge_verified', False),
            'date_joined': user.date_joined.isoformat() if user.date_joined else None,
            'interests': user.interests or [],
        },
        'preferences': {
            'locale': getattr(prefs, 'locale', None),
            'theme': getattr(prefs, 'theme', None),
            'profile_visibility': getattr(prefs, 'profile_visibility', None),
            'notification_prefs': getattr(prefs, 'notification_prefs', {}),
        } if prefs else {},
        'posts': posts,
        'comments': comments,
        'reels': reels,
        'messages': messages,
    }
