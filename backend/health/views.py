import logging

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, BurstThrottle, ContentPostCreateThrottle

logger = logging.getLogger(__name__)


def _database_ok(alias: str) -> bool:
    conn = connections[alias]
    with conn.cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()
    return True


class SystemHealthView(APIView):
    """AllowAny on purpose — load balancers/uptime monitors hit this without
    auth. Exception detail is only included for staff callers so an
    unauthenticated caller can't fingerprint internal DB/cache errors."""

    throttle_classes = [BurstThrottle, AnonReadThrottle]
    permission_classes = [AllowAny]

    def get(self, request):
        show_detail = bool(request.user and request.user.is_authenticated and request.user.is_staff)
        checks = []
        overall_ok = True

        def _fail(name, exc):
            logger.error('health check failed: %s', name, exc_info=exc)
            entry = {'name': name, 'status': 'error'}
            if show_detail:
                entry['detail'] = str(exc)
            return entry

        database_primary = False
        try:
            database_primary = _database_ok('default')
            checks.append({'name': 'database', 'status': 'ok'})
        except Exception as exc:
            overall_ok = False
            checks.append(_fail('database', exc))

        database_replica = None
        if 'replica' in settings.DATABASES:
            try:
                database_replica = _database_ok('replica')
                checks.append({'name': 'database_replica', 'status': 'ok'})
            except Exception as exc:
                overall_ok = False
                database_replica = False
                checks.append(_fail('database_replica', exc))

        try:
            cache.set('healthcheck', 'ok', 5)
            cache_ok = cache.get('healthcheck') == 'ok'
            if not cache_ok:
                raise RuntimeError('cache round-trip failed')
            checks.append({'name': 'cache', 'status': 'ok'})
        except Exception as exc:
            overall_ok = False
            checks.append(_fail('cache', exc))

        status_code = 200 if overall_ok else 503
        return Response(
            {
                'status': 'ok' if overall_ok else 'degraded',
                'database_primary': database_primary,
                'database_replica': database_replica,
                'checks': checks,
            },
            status=status_code,
        )
