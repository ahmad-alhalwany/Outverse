from django.core.management.base import BaseCommand

from moderation.models import FlaggedContent

SAMPLES = [
    {
        'type': 'post',
        'content': 'Reported post: possible spam link in caption about crypto giveaway.',
        'reporter': 'sarah_mitchell',
        'status': 'pending',
    },
    {
        'type': 'comment',
        'content': 'Comment flagged for harassment on a Lab submission thread.',
        'reporter': 'david_chen',
        'status': 'pending',
    },
    {
        'type': 'reel',
        'content': 'Reel reported: misleading health claim in description.',
        'reporter': 'elena_rodriguez',
        'status': 'pending',
    },
    {
        'type': 'reel_comment',
        'content': 'Off-topic promotional comment under a science reel.',
        'reporter': 'anonymous_user',
        'status': 'approved',
    },
]


class Command(BaseCommand):
    help = 'Seed moderation queue with sample flagged items'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true')

    def handle(self, *args, **options):
        if options['clear']:
            n = FlaggedContent.objects.count()
            FlaggedContent.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {n} flagged items.'))

        created = 0
        for spec in SAMPLES:
            _, was_created = FlaggedContent.objects.get_or_create(
                type=spec['type'],
                content=spec['content'],
                defaults=spec,
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'Flagged content ready ({created} new).'))
