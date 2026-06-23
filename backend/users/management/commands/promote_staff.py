from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = 'Grant Django staff access for the Next.js admin panel (/admin).'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username to promote')
        parser.add_argument(
            '--revoke',
            action='store_true',
            help='Remove staff status instead of granting it',
        )

    def handle(self, *args, **options):
        username = options['username']
        user = User.objects.filter(username=username).first()
        if not user:
            self.stderr.write(self.style.ERROR(f'User "{username}" not found.'))
            return
        if options['revoke']:
            user.is_staff = False
            user.save(update_fields=['is_staff'])
            self.stdout.write(self.style.WARNING(f'Revoked staff for @{username}'))
        else:
            user.is_staff = True
            user.save(update_fields=['is_staff'])
            self.stdout.write(self.style.SUCCESS(f'@{username} is now staff — open /admin after re-login'))
