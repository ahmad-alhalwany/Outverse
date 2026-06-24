import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = (
        'Create or update a staff + superuser account for /admin and Django admin. '
        'Pass password via --password or OUTVERSE_ADMIN_PASS env (never commit passwords).'
    )

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)
        parser.add_argument(
            '--email',
            type=str,
            default='',
            help='Email for new users (default: username@outverse.local)',
        )
        parser.add_argument(
            '--password',
            type=str,
            default='',
            help='Password (prefer OUTVERSE_ADMIN_PASS env instead)',
        )
        parser.add_argument(
            '--no-superuser',
            action='store_true',
            help='Staff only, not Django superuser',
        )

    def handle(self, *args, **options):
        username = options['username'].strip()
        if not username:
            raise CommandError('Username is required.')

        password = options['password'] or os.environ.get('OUTVERSE_ADMIN_PASS', '').strip()
        if not password:
            raise CommandError(
                'Set OUTVERSE_ADMIN_PASS or pass --password (do not commit passwords to git).'
            )

        email = options['email'].strip() or f'{username}@outverse.local'
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email},
        )
        user.email = email
        user.set_password(password)
        user.is_staff = True
        if not options['no_superuser']:
            user.is_superuser = True
        user.save()

        verb = 'Created' if created else 'Updated'
        self.stdout.write(
            self.style.SUCCESS(
                f'{verb} @{username} (staff=True, superuser={user.is_superuser}). '
                'Log in at /login then open /admin.'
            )
        )
