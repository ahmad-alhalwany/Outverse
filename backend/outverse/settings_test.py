"""
Test-specific settings used by pytest / Django test runner.

By default tests use an in-memory SQLite database so pytest runs without
a local Postgres instance. Set USE_POSTGRES_FOR_TESTS=1 to run against Postgres
(e.g. CI matching production).

Example:
    pytest
    USE_POSTGRES_FOR_TESTS=1 pytest
"""
import os

from outverse.settings import *  # noqa: F401,F403

SECRET_KEY = 'django-test-secret-key-not-for-production'
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

_use_postgres = os.environ.get('USE_POSTGRES_FOR_TESTS', '').lower() in ('1', 'true', 'yes')

if _use_postgres:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql_psycopg2',
            'NAME': os.environ.get('POSTGRES_TEST_DB', 'outverse_test'),
            'USER': os.environ.get('POSTGRES_TEST_USER', os.environ.get('POSTGRES_USER', 'postgres')),
            'PASSWORD': os.environ.get('POSTGRES_TEST_PASSWORD', os.environ.get('POSTGRES_PASSWORD', '')),
            'HOST': os.environ.get('POSTGRES_TEST_HOST', os.environ.get('POSTGRES_HOST', 'localhost')),
            'PORT': os.environ.get('POSTGRES_TEST_PORT', os.environ.get('POSTGRES_PORT', '5432')),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': os.environ.get('SQLITE_TEST_PATH', ':memory:'),
        }
    }

# --- Isolation guards --------------------------------------------------------
# Tests must never reach remote infrastructure (production RDS / S3), whatever
# the surrounding .env files contain.
_LOCAL_DB_HOSTS = ('localhost', '127.0.0.1', '::1', 'db')
_test_db_host = DATABASES['default'].get('HOST', '')
if _use_postgres and _test_db_host not in _LOCAL_DB_HOSTS and os.environ.get('OUTVERSE_ALLOW_REMOTE') != '1':
    from django.core.exceptions import ImproperlyConfigured

    raise ImproperlyConfigured(
        f'Refusing to run tests against remote database host {_test_db_host!r}. '
        'Use the local profile (backend/.env.local) or set OUTVERSE_ALLOW_REMOTE=1.'
    )

# Uploads go to a throw-away local folder, never to S3 (even if AWS_* is set).
import tempfile  # noqa: E402

USE_S3_MEDIA_STORAGE = False
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
MEDIA_ROOT = os.path.join(tempfile.gettempdir(), 'outverse-test-media')
MEDIA_URL = '/media/'

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
CORS_ALLOWED_ORIGINS = ['http://localhost:3000']
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Speed up tests by using in-memory channel layer when Redis is unavailable.
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}
