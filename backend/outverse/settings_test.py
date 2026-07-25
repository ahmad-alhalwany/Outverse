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

EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
CORS_ALLOWED_ORIGINS = ['http://localhost:3000']
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Speed up tests by using in-memory channel layer when Redis is unavailable.
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}
