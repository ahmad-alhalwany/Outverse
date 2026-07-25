from django.core.management.base import BaseCommand

from analytics.feed_ranker import (
    rebuild_content_tag_vector,
    rebuild_user_interest_vector,
)
from analytics.models import ContentEngagementEvent


class Command(BaseCommand):
    help = 'Rebuild persisted user interest vectors (and optional content tag vectors).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-id',
            type=int,
            help='Rebuild a single user interest vector.',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Rebuild interest vectors for all users with engagement events.',
        )
        parser.add_argument(
            '--content-type',
            default='post',
            help='When used with --content-id, rebuild a ContentTagVector (default: post).',
        )
        parser.add_argument(
            '--content-id',
            type=int,
            help='Rebuild tag vector for one content item.',
        )

    def handle(self, *args, **options):
        content_id = options.get('content_id')
        if content_id:
            obj = rebuild_content_tag_vector(options['content_type'], content_id)
            if obj:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Rebuilt content tag vector for {obj.content_type}:{obj.content_id} '
                        f'({len(obj.weights)} tags)',
                    )
                )
            else:
                self.stdout.write('No tags found — removed any stale content tag vector.')
            return

        user_id = options.get('user_id')
        if user_id:
            obj = rebuild_user_interest_vector(user_id)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Rebuilt interest vector for user {user_id} '
                    f'({len(obj.weights)} tags, sample={list(obj.weights.items())[:5]})',
                )
            )
            return

        if options['all']:
            user_ids = (
                ContentEngagementEvent.objects.filter(user_id__isnull=False)
                .values_list('user_id', flat=True)
                .distinct()
            )
            count = 0
            for uid in user_ids:
                rebuild_user_interest_vector(uid)
                count += 1
            self.stdout.write(self.style.SUCCESS(f'Rebuilt interest vectors for {count} users.'))
            return

        self.stdout.write(
            'Pass --user-id, --all, or --content-id to rebuild vectors.',
        )
