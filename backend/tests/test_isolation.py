"""Guardrails: the test process must never talk to remote infrastructure.

These fail loudly if someone re-introduces S3 or a remote database into the
test settings (see outverse/settings_test.py), instead of letting a test run
silently write to production.
"""
import tempfile

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage, default_storage, storages
from django.db import connection

LOCAL_DB_HOSTS = {'', 'localhost', '127.0.0.1', '::1', 'db'}  # '' = SQLite


def test_database_host_is_local():
    assert connection.settings_dict['HOST'] in LOCAL_DB_HOSTS


def test_s3_is_disabled():
    assert settings.USE_S3_MEDIA_STORAGE is False
    assert isinstance(storages['default'], FileSystemStorage)


def test_uploads_land_in_a_local_temp_dir():
    assert str(settings.MEDIA_ROOT).startswith(tempfile.gettempdir())
    name = default_storage.save('isolation-check.txt', ContentFile(b'ok'))
    try:
        assert str(default_storage.path(name)).startswith(str(settings.MEDIA_ROOT))
    finally:
        default_storage.delete(name)
