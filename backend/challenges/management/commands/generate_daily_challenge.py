"""Generate or refresh today's positive AI daily challenge.

Usage:
    python manage.py generate_daily_challenge
    python manage.py generate_daily_challenge --force
    python manage.py generate_daily_challenge --lang ar
"""

from django.core.management.base import BaseCommand

from challenges.ai import ensure_today_daily


class Command(BaseCommand):
    help = 'Ensure a bright AI (or fallback) daily challenge exists for today'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Replace today\'s daily even if one exists')
        parser.add_argument('--lang', default='en', choices=['en', 'ar'])

    def handle(self, *args, **options):
        challenge = ensure_today_daily(language=options['lang'], force=options['force'])
        source = 'AI' if challenge.is_ai_generated else 'fallback pool'
        self.stdout.write(
            self.style.SUCCESS(
                f'Daily challenge ready ({source}): {challenge.title} [id={challenge.id}]'
            )
        )
