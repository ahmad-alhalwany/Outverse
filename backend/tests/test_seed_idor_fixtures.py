import json

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.authtoken.models import Token

from posts.models import Post
from users.management.commands.seed_idor_fixtures import MARKER, assert_local_only


@pytest.mark.django_db
def test_seed_is_idempotent_and_builds_expected_fixtures(tmp_path, settings):
    settings.DEBUG = True  # pytest-django forces DEBUG=False; the command only runs in a dev setup
    out = tmp_path / 'fixtures.json'
    call_command('seed_idor_fixtures', output=str(out))
    first = json.loads(out.read_text())
    call_command('seed_idor_fixtures', output=str(out))
    second = json.loads(out.read_text())

    assert first['alice']['token'] == second['alice']['token']
    assert first['bob']['token'] != first['alice']['token']
    assert Token.objects.filter(user__username__startswith='idor_').count() == 2
    assert Post.objects.filter(text__startswith=MARKER).count() == 6
    assert set(second['alice']['posts']) == {'public', 'followers', 'subscribers'}
    assert Post.objects.get(pk=second['bob']['posts']['followers']).visibility == 'followers'


@pytest.mark.parametrize('debug,host,s3', [
    (False, 'localhost', False),
    (True, 'database-1.example.rds.amazonaws.com', False),
    (True, '127.0.0.1', True),
])
def test_seed_refuses_non_local_setups(debug, host, s3):
    with pytest.raises(CommandError):
        assert_local_only(debug, host, s3)


def test_seed_accepts_local_setup():
    assert_local_only(True, '127.0.0.1', False)
