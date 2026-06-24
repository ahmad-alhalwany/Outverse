from django.core.cache import cache
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response

class SystemHealthView(APIView):
    def get(self, request):
        checks = []
        overall_ok = True

        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
            checks.append({'name': 'database', 'status': 'ok'})
        except Exception as exc:
            overall_ok = False
            checks.append({'name': 'database', 'status': 'error', 'detail': str(exc)})

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
        return Response({'status': 'ok' if overall_ok else 'degraded', 'checks': checks}, status=status_code)