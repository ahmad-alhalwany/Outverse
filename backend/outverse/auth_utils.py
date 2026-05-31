"""Shared helpers for token-authenticated API views."""

from rest_framework.response import Response


def user_from_request(request):
    user = getattr(request, 'user', None)
    if user and user.is_authenticated:
        return user
    return None


def require_user(request):
    """Return (user, None) or (None, 401 Response)."""
    user = user_from_request(request)
    if not user:
        return None, Response(
            {
                'error': (
                    'Authentication required. '
                    'Send Authorization: Token <key>.'
                ),
            },
            status=401,
        )
    return user, None
