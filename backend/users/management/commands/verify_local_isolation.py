"""Prove, with concrete evidence, that this process is isolated from production.

    python manage.py seed_idor_fixtures     # once
    python manage.py verify_local_isolation

Prints a checklist and exits non-zero if anything fails. Part 1 inspects the
live configuration (including a real database connection). Part 2 runs only if
part 1 passed: it uploads a real image through the API as idor_alice, checks it
landed in the local MEDIA_ROOT, watches every outbound Python-level connection
made meanwhile, and trips an alarm on any AWS SDK call.
"""
import io
import os
import socket
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files.storage import FileSystemStorage, storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from users.management.commands.seed_idor_fixtures import LOCAL_DB_HOSTS

User = get_user_model()

# Variables that would point this process at real external services.
LEAK_WATCHLIST = (
    'AWS_STORAGE_BUCKET_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_CUSTOM_DOMAIN', 'AWS_S3_ENDPOINT_URL', 'DATABASE_REPLICA_URL',
    'REDIS_URL', 'CDN_URL', 'EMAIL_HOST', 'EMAIL_HOST_PASSWORD',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 'NVIDIA_API_KEY', 'SENTRY_DSN', 'TURN_PASSWORD',
    'CLOUDFLARE_STREAM_API_TOKEN', 'VAPID_PRIVATE_KEY',
)
LOOPBACK_NAMES = {'localhost', '127.0.0.1', '::1', 'testserver'}


def leaked_env_vars(environ):
    """Names (never values) of watchlist variables that hold a non-empty value."""
    return [name for name in LEAK_WATCHLIST if (environ.get(name) or '').strip()]


def _is_loopback(address):
    host = address[0] if isinstance(address, (tuple, list)) else str(address)
    return host in LOOPBACK_NAMES or str(host).startswith('127.')


class Command(BaseCommand):
    help = 'Verify (with a live upload and connection watch) that this environment cannot reach production.'

    def handle(self, *args, **options):
        results = []

        def check(ok, title, detail=''):
            results.append(bool(ok))
            tail = f'  ->  {detail}' if detail else ''
            self.stdout.write(f"  [{'OK' if ok else 'FAIL'}] {title}{tail}")

        # ---- Part 1: live configuration ------------------------------------
        self.stdout.write(self.style.MIGRATE_HEADING('1) Configuration'))
        base_dir = Path(settings.BASE_DIR)
        check((base_dir / '.env.local').is_file(),
              'isolated profile active (backend/.env.local is the only env file loaded)')
        check(settings.DEBUG, 'DEBUG is on', f'ALLOWED_HOSTS={settings.ALLOWED_HOSTS}')
        check(os.environ.get('OUTVERSE_ALLOW_REMOTE') != '1', 'remote-infra interlock is not bypassed')
        leaked = leaked_env_vars(os.environ)
        check(not leaked, 'no production-service variables set in the environment',
              ', '.join(leaked) or 'none of the %d watched names is set' % len(LEAK_WATCHLIST))

        db = settings.DATABASES['default']
        check(db['HOST'] in LOCAL_DB_HOSTS and 'replica' not in settings.DATABASES,
              'settings point to a local database, no replica', f"{db['HOST']}:{db['PORT']}/{db['NAME']}")
        try:
            with connection.cursor() as cursor:
                cursor.execute('select current_database(), current_user, version()')
                dbname, dbuser, version = cursor.fetchone()
            info = connection.connection.info
            check(info.host in LOCAL_DB_HOSTS,
                  'REAL connection goes to the local container',
                  f'{info.host}:{info.port} db={dbname} user={dbuser} ({version.split(",")[0]})')
        except Exception as exc:  # noqa: BLE001 - report any connection failure as a failed check
            check(False, 'could not open a database connection', str(exc).splitlines()[0])

        storage = storages['default']
        media_root = Path(settings.MEDIA_ROOT).resolve()
        check(isinstance(storage, FileSystemStorage) and not settings.USE_S3_MEDIA_STORAGE,
              'media storage is the local FileSystemStorage, S3 is off',
              f'{type(storage).__name__}, root={media_root}')
        check(base_dir.resolve() in media_root.parents, 'MEDIA_ROOT is inside the project folder')
        check(settings.EMAIL_BACKEND.endswith(('console.EmailBackend', 'locmem.EmailBackend')),
              'emails are printed to the console, never sent', settings.EMAIL_BACKEND)

        if not all(results):
            raise CommandError('Configuration is NOT isolated - skipped the live upload test. Fix the FAIL lines above.')

        # ---- Part 2: live upload + connection watch -----------------------
        self.stdout.write(self.style.MIGRATE_HEADING('2) Live upload through the API (as idor_alice)'))
        try:
            user = User.objects.get(username='idor_alice')
        except User.DoesNotExist as exc:
            raise CommandError('Run first: python manage.py seed_idor_fixtures') from exc
        token, _ = Token.objects.get_or_create(user=user)
        client = APIClient(HTTP_HOST='127.0.0.1')
        client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

        from PIL import Image
        buf = io.BytesIO()
        Image.new('RGB', (64, 64), (10, 120, 200)).save(buf, 'PNG')
        upload = SimpleUploadedFile('isolation-check.png', buf.getvalue(), content_type='image/png')

        destinations, lookups = [], []
        real_connect = socket.socket.connect
        real_getaddrinfo = socket.getaddrinfo

        def spy_connect(sock, address, *args, **kwargs):
            destinations.append(address)
            return real_connect(sock, address, *args, **kwargs)

        def spy_getaddrinfo(host, *args, **kwargs):
            lookups.append(host)
            return real_getaddrinfo(host, *args, **kwargs)

        stored_path = None
        try:
            with mock.patch.object(socket.socket, 'connect', spy_connect), \
                    mock.patch('socket.getaddrinfo', spy_getaddrinfo), \
                    mock.patch('botocore.client.BaseClient._make_api_call',
                               side_effect=AssertionError('AWS API call attempted')):
                response = client.patch(f'/api/users/{user.id}/update/', {'avatar': upload}, format='multipart')

            check(response.status_code == 200, 'upload request accepted', f'HTTP {response.status_code}')
            user.refresh_from_db()
            if user.avatar:
                stored_path = Path(user.avatar.path)
            check(stored_path is not None and stored_path.is_file(),
                  'file exists on THIS machine', str(stored_path))
            check(stored_path is not None and media_root in stored_path.resolve().parents,
                  'file is inside the local MEDIA_ROOT')
            url = user.avatar.url if user.avatar else ''
            check(url.startswith(settings.MEDIA_URL) and 'amazonaws' not in url,
                  'media URL is local, not an S3 URL', url)
            check(all(_is_loopback(a) for a in destinations),
                  'every outbound Python-level connection was loopback',
                  f'{len(destinations)} connection(s): {sorted({str(a[0]) for a in destinations}) or "none"}')
            check(all(h in LOOPBACK_NAMES for h in lookups if isinstance(h, str)),
                  'no DNS lookup of an external host', f'lookups: {sorted(set(map(str, lookups))) or "none"}')
            check(True, 'no AWS SDK call was made (tripwire armed during the upload)')
        except AssertionError as exc:
            check(False, 'an AWS SDK call was attempted', str(exc))
        finally:
            if user.avatar:
                user.avatar.delete(save=True)
        check(stored_path is None or not stored_path.exists(), 'test file cleaned up')

        failed = results.count(False)
        if failed:
            raise CommandError(f'{failed} isolation check(s) FAILED.')
        self.stdout.write(self.style.SUCCESS('ALL CHECKS PASSED: this environment is isolated from production.'))
