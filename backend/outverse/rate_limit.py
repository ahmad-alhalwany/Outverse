from django.core.cache import cache
from rest_framework.response import Response


def rate_limit_response(request, key_prefix: str, limit: int = 20, window: int = 60):
    """Return a 429 Response if the client exceeded the limit, else None."""
    # Take the LAST hop of X-Forwarded-For, not the first: behind an AWS ALB (or any
    # reverse proxy) the leftmost entries are client-supplied and trivially spoofable,
    # while the proxy always appends the real connecting IP as the final hop.
    xff = request.META.get('HTTP_X_FORWARDED_FOR') or ''
    ip = xff.split(',')[-1].strip() if xff else ''
    if not ip:
        ip = request.META.get('REMOTE_ADDR', 'unknown')
    cache_key = f'rl:{key_prefix}:{ip}'
    count = cache.get(cache_key, 0)
    if count >= limit:
        return Response({'error': 'Too many requests. Try again shortly.'}, status=429)
    cache.set(cache_key, count + 1, window)
    return None
