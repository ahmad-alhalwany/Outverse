from django.core.cache import cache
from rest_framework.response import Response


def rate_limit_response(request, key_prefix: str, limit: int = 20, window: int = 60):
    """Return a 429 Response if the client exceeded the limit, else None."""
    ip = (request.META.get('HTTP_X_FORWARDED_FOR') or '').split(',')[0].strip()
    if not ip:
        ip = request.META.get('REMOTE_ADDR', 'unknown')
    cache_key = f'rl:{key_prefix}:{ip}'
    count = cache.get(cache_key, 0)
    if count >= limit:
        return Response({'error': 'Too many requests. Try again shortly.'}, status=429)
    cache.set(cache_key, count + 1, window)
    return None
