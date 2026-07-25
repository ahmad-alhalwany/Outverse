from django.core.management.base import BaseCommand

from notifications.tasks import send_daily_digests, send_weekly_digests


class Command(BaseCommand):
    help = (
        'Send digest emails to users based on their EmailPreference.digest_frequency. '
        'Run daily via cron/Task Scheduler — this checks day-of-week internally for '
        'weekly digests, so it is safe to invoke every day.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Log what would be sent without actually sending email.',
        )
        parser.add_argument(
            '--only', choices=['daily', 'weekly'], default=None,
            help='Send only one digest type (default: both, weekly gated to Mondays).',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        only = options['only']

        if only in (None, 'daily'):
            sent = send_daily_digests(dry_run=dry_run)
            self.stdout.write(self.style.SUCCESS(f'Daily digests sent: {sent}'))

        if only == 'weekly':
            sent = send_weekly_digests(dry_run=dry_run)
            self.stdout.write(self.style.SUCCESS(f'Weekly digests sent: {sent}'))
        elif only is None:
            from django.utils import timezone
            if timezone.now().weekday() == 0:  # Monday
                sent = send_weekly_digests(dry_run=dry_run)
                self.stdout.write(self.style.SUCCESS(f'Weekly digests sent: {sent}'))
            else:
                self.stdout.write('Skipping weekly digests (not Monday).')
