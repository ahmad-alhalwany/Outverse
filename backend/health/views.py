from django.conf import settings
from django.core.cache import cache
from django.db import connections
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, BurstThrottle, ContentPostCreateThrottle


def _database_ok(alias: str) -> bool:
    conn = connections[alias]
    with conn.cursor() as cursor:
        cursor.execute('SELECT 1')
        cursor.fetchone()
    return True


class SystemHealthView(APIView):
    throttle_classes = [BurstThrottle, AnonReadThrottle]
    permission_classes = [AllowAny]

    def get(self, request):
        checks = []
        overall_ok = True

        database_primary = False
        try:
            database_primary = _database_ok('default')
            checks.append({'name': 'database', 'status': 'ok'})
        except Exception as exc:
            overall_ok = False
            checks.append({'name': 'database', 'status': 'error', 'detail': str(exc)})

        database_replica = None
        if 'replica' in settings.DATABASES:
            try:
                database_replica = _database_ok('replica')
                checks.append({'name': 'database_replica', 'status': 'ok'})
            except Exception as exc:
                overall_ok = False
                database_replica = False
                checks.append({'name': 'database_replica', 'status': 'error', 'detail': str(exc)})

        try:
            cache.set('healthcheck', 'ok', 5)
            cache_ok = cache.get('healthcheck') == 'ok'
            if not cache_ok:
                raise RuntimeError('cache round-trip failed')
            checks.append({'name': 'cache', 'status': 'ok'})
        except Exception as exc:
            overall_ok = False
            checks.append({'name': 'cache', 'status': 'error', 'detail': str(exc)})

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
