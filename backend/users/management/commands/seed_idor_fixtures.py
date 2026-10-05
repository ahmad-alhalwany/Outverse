"""Seed two ordinary users (A and B) with auth tokens and posts for IDOR testing.

LOCAL ONLY: it creates accounts whose tokens are written to a file, so it
refuses to run unless DEBUG is on, the database is local and S3 is disabled.
Idempotent: running it again reuses the same users, tokens and posts.

    python manage.py seed_idor_fixtures [--show-tokens] [--reset]

Neither user follows the other and neither is staff, on purpose: the
followers-only / subscribers-only posts must be hidden from the other user.
"""
import json
import secrets
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from rest_framework.authtoken.models import Token

from posts.models import Post
from users.models import Profile

User = get_user_model()

LOCAL_DB_HOSTS = ('localhost', '127.0.0.1', '::1', 'db')
USERS = ('alice', 'bob')
POSTS = (
    ('public', 'public post'),
    ('followers', 'followers-only post'),
    ('subscribers', 'subscribers-only post'),
)
MARKER = '[idor-seed]'


def assert_local_only(debug, db_host, s3_enabled):
    """Raise CommandError unless this process is clearly a local dev setup."""
    problems = []
    if not debug:
        problems.append('DEBUG is off')
    if db_host not in LOCAL_DB_HOSTS:
        problems.append(f'database host {db_host!r} is not local')
    if s3_enabled:
        problems.append('S3 media storage is enabled')
    if problems:
        raise CommandError(
            'Refusing to seed test accounts: ' + '; '.join(problems)
            + '. Use the local profile (backend/.env.local).'
        )


class Command(BaseCommand):
    help = 'Create users A and B (idor_alice / idor_bob) with tokens and posts for IDOR tests (local only).'

    def add_arguments(self, parser):
        parser.add_argument('--output', default='', help='Fixtures JSON path (default: backend/.idor-fixtures.json)')
        parser.add_argument('--show-tokens', action='store_true', help='Print full tokens instead of masking them.')
        parser.add_argument('--reset', action='store_true', help='Regenerate passwords and tokens.')

    def handle(self, *args, **options):
        assert_local_only(
            settings.DEBUG,
            settings.DATABASES['default'].get('HOST', ''),
            getattr(settings, 'USE_S3_MEDIA_STORAGE', False),
        )

        out_path = Path(options['output'] or Path(settings.BASE_DIR) / '.idor-fixtures.json')
        previous = json.loads(out_path.read_text(encoding='utf-8')) if out_path.is_file() else {}

        fixtures = {'base_url': 'http://127.0.0.1:8000'}
        for key in USERS:
            username = f'idor_{key}'
            user, created = User.objects.get_or_create(
                username=username, defaults={'email': f'{username}@outverse.local'},
            )
            password = previous.get(key, {}).get('password')
            if created or options['reset'] or not password:
                password = secrets.token_urlsafe(16)
                user.set_password(password)
            user.is_verified = True
            user.is_active = True
            user.is_staff = False
            user.is_superuser = False
            user.save()
            Profile.objects.get_or_create(user=user)

            if options['reset']:
                Token.objects.filter(user=user).delete()
            token, _ = Token.objects.get_or_create(user=user)

            post_ids = {}
            for visibility, label in POSTS:
                post, _ = Post.objects.get_or_create(
                    user=user, text=f'{MARKER} {username} {label}',
                    defaults={'visibility': visibility},
                )
                if post.visibility != visibility:
                    post.visibility = visibility
                    post.save(update_fields=['visibility'])
                post_ids[visibility] = post.id

            fixtures[key] = {
                'id': user.id, 'username': username, 'password': password,
                'token': token.key, 'posts': post_ids,
            }

        out_path.write_text(json.dumps(fixtures, indent=2), encoding='utf-8')

        self.stdout.write(self.style.SUCCESS(f'IDOR fixtures ready -> {out_path}'))
        for key in USERS:
            f = fixtures[key]
            shown = f['token'] if options['show_tokens'] else f['token'][:4] + '...(hidden)'
            self.stdout.write(f"  {f['username']}: id={f['id']} token={shown} posts={f['posts']}")
        self.stdout.write('  Use header:  Authorization: Token <token>   (tokens are in the JSON file)')
