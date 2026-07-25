"""
Custom DRF Throttle Classes for Outverse.

Provides granular per-endpoint rate limiting with user/IP identification,
standard headers (Retry-After, X-RateLimit-*), and proper 429 responses.
"""
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle, ScopedRateThrottle
from rest_framework.request import Request
from django.core.cache import cache
import time


class BaseThrottle:
    """Mixin with common throttle logic: headers, cache key format, IP extraction."""

    scope_attr = 'throttle_scope'

    def parse_rate(self, rate):
        """Extends DRF's 'num/unit' rate format with an optional numeric
        multiplier on the period, e.g. '30/5min' == 30 requests per 5
        minutes. DRF's own parser only reads period[0], so '5min' would
        look up the invalid key '5' — this handles the digits first."""
        if rate is None:
            return (None, None)
        num, period = rate.split('/')
        num_requests = int(num)
        digits = ''
        i = 0
        while i < len(period) and period[i].isdigit():
            digits += period[i]
            i += 1
        multiplier = int(digits) if digits else 1
        unit = period[i:] or period
        duration = {'s': 1, 'm': 60, 'h': 3600, 'd': 86400}[unit[0]]
        return (num_requests, duration * multiplier)

    def get_ident(self, request: Request) -> str:
        """
        Identify the client.
        - Authenticated users: user.id (prefixed with 'u:')
        - Anonymous: IP address (prefixed with 'ip:')
        """
        if request.user and request.user.is_authenticated:
            return f'u:{request.user.pk}'

        # Anonymous: extract IP (respect proxies)
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if xff:
            ip = xff.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return f'ip:{ip}'

    def get_cache_key(self, request: Request, view) -> str | None:
        ident = self.get_ident(request)
        scope = getattr(view, self.scope_attr, None) or self.scope
        return f'throttle:{scope}:{ident}'

    def wait(self) -> float | None:
        """Seconds until throttle resets. For Retry-After header."""
        if self.history:
            # history is list of timestamps; last request is most recent
            reset_at = self.history[-1] + self.duration
            remaining = reset_at - time.time()
            return max(0, remaining)
        return None


class BurstThrottle(BaseThrottle, UserRateThrottle):
    """
    Short-window burst protection (e.g., 200/min).
    Applied globally as a safety net.
    """
    scope = 'burst'


class SustainedThrottle(BaseThrottle, UserRateThrottle):
    """
    Long-window sustained protection (e.g., 1000/hour).
    Applied globally to prevent abuse over longer periods.
    """
    scope = 'sustained'


class ScopedEndpointThrottle(BaseThrottle, ScopedRateThrottle):
    """
    Per-endpoint scoped throttling.
    Views must define `throttle_scope = 'auth.login'` (or similar).
    Rate is looked up from REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
    """
    pass


class AuthLoginThrottle(ScopedEndpointThrottle):
    """Login: 30 requests per 5 minutes (prevents credential stuffing)."""
    scope = 'auth.login'


class AuthRegisterThrottle(ScopedEndpointThrottle):
    """Register: 5 per hour (prevents automated account creation)."""
    scope = 'auth.register'


class AuthForgotPasswordThrottle(ScopedEndpointThrottle):
    """Forgot password: 3 per hour (prevents email enumeration/flooding)."""
    scope = 'auth.forgot_password'


class AuthResetPasswordThrottle(ScopedEndpointThrottle):
    """Reset password: 10 per 10 minutes."""
    scope = 'auth.reset_password'


class AuthVerifyEmailThrottle(ScopedEndpointThrottle):
    """Verify email: 10 per hour."""
    scope = 'auth.verify_email'


class AuthCheckUsernameThrottle(ScopedEndpointThrottle):
    """Check username availability: 30 per minute (debounce UI checks)."""
    scope = 'auth.check_username'


class ContentPostCreateThrottle(ScopedEndpointThrottle):
    """Create post: 30 per minute."""
    scope = 'content.post_create'


class ContentReelCreateThrottle(ScopedEndpointThrottle):
    """Create reel: 20 per minute."""
    scope = 'content.reel_create'


class ContentDraftWriteThrottle(ScopedEndpointThrottle):
    """Draft write (auto-save): 60 per minute."""
    scope = 'content.draft_write'


class ContentScheduledCreateThrottle(ScopedEndpointThrottle):
    """Create scheduled post: 30 per minute."""
    scope = 'content.scheduled_create'


class AnonReadThrottle(BaseThrottle, AnonRateThrottle):
    """Anonymous read endpoints: 100 per minute."""
    scope = 'anon.read'


class AnonShareThrottle(BaseThrottle, AnonRateThrottle):
    """Anonymous share/link generation: 30 per minute."""
    scope = 'anon.share'


class UserFollowThrottle(ScopedEndpointThrottle):
    """Follow/unfollow: 60 per minute."""
    scope = 'user.follow'


class UserLikeThrottle(ScopedEndpointThrottle):
    """Like/unlike: 120 per minute."""
    scope = 'user.like'


class UserCommentThrottle(ScopedEndpointThrottle):
    """Comment create: 30 per minute."""
    scope = 'user.comment'


class UserBookmarkThrottle(ScopedEndpointThrottle):
    """Bookmark/unbookmark: 60 per minute."""
    scope = 'user.bookmark'


class UserReportThrottle(ScopedEndpointThrottle):
    """Report content/user: 10 per minute."""
    scope = 'user.report'


class SearchQueryThrottle(ScopedEndpointThrottle):
    """Search query: 30 per minute."""
    scope = 'search.query'


class SearchAutocompleteThrottle(ScopedEndpointThrottle):
    """Search autocomplete: 60 per minute."""
    scope = 'search.autocomplete'


# ──────────────────────────────────────────────────────────────
# Decorator / mixin for easy application on function-based views
# ──────────────────────────────────────────────────────────────

def throttle_classes(*classes):
    """
    Decorator to apply throttle classes to a function-based view.
    Usage:
        @api_view(['POST'])
        @throttle_classes(AuthLoginThrottle)
        def login_view(request):
            ...
    """
    from functools import wraps
    from rest_framework.views import APIView

    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            # Create a temporary APIView instance to run throttle checks
            dummy_view = APIView()
            dummy_view.request = request
            dummy_view.format_kwarg = None
            for throttle_class in classes:
                throttle = throttle_class()
                if not throttle.allow_request(request, dummy_view):
                    return throttle.throttled_response(request)
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator


class ThrottleMixin:
    """
    Mixin for APIView / ViewSet to apply scoped throttles per-action.
    Define `throttle_scopes = {'action_name': 'throttle.scope'}` on the view.
    """
    throttle_scopes = {}

    def get_throttles(self):
        throttles = super().get_throttles()
        action = getattr(self, 'action', None) or self.request.method.lower()
        scope = self.throttle_scopes.get(action)
        if scope:
            throttle = ScopedEndpointThrottle()
            throttle.scope = scope
            throttles.append(throttle)
        return throttles