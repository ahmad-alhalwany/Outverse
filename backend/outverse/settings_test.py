"""
Test-specific settings used by pytest / Django test runner.

Example:
    set DJANGO_SETTINGS_MODULE=outverse.settings_test
    pytest
"""
from outverse.settings import *  # noqa: F401,F403

SECRET_KEY = 'django-test-secret-key-not-for-production'
DEBUG = True
ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql_psycopg2',
        'NAME': os.environ.get('POSTGRES_TEST_DB', 'outverse_test'),  # noqa: F405
        'USER': os.environ.get('POSTGRES_TEST_USER', os.environ.get('POSTGRES_USER', 'postgres')),  # noqa: F405
        'PASSWORD': os.environ.get('POSTGRES_TEST_PASSWORD', os.environ.get('POSTGRES_PASSWORD', '')),  # noqa: F405
        'HOST': os.environ.get('POSTGRES_TEST_HOST', os.environ.get('POSTGRES_HOST', 'localhost')),  # noqa: F405
        'PORT': os.environ.get('POSTGRES_TEST_PORT', os.environ.get('POSTGRES_PORT', '5432')),  # noqa: F405
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
