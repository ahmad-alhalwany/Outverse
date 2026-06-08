from django.core.management.base import BaseCommand

from reels.models import ReelMusicTrack


TRACKS = [
    {
        'slug': 'nebula-pulse',
        'title': 'Nebula Pulse',
        'artist_label': 'Outverse',
        'source_path': '/sounds/mystical-chime-196405.mp3',
        'mood': 'cosmic',
        'order': 1,
    },
    {
        'slug': 'warp-static',
        'title': 'Warp Static',
        'artist_label': 'Outverse',
        'source_path': '/sounds/shine-11-268907.mp3',
        'mood': 'spark',
        'order': 2,
    },
    {
        'slug': 'void-hum',
        'title': 'Void Hum',
        'artist_label': 'Outverse',
        'source_path': '/sounds/logo-transparent-139678.mp3',
        'mood': 'void',
        'order': 3,
    },
    {
        'slug': 'dream-loop',
        'title': 'Dream Loop',
        'artist_label': 'Outverse',
        'source_path': '/sounds/chime-sound-7143.mp3',
        'mood': 'dream',
        'order': 4,
    },
    {
        'slug': 'pulse-drive',
        'title': 'Pulse Drive',
        'artist_label': 'Outverse',
        'source_path': '/sounds/bubblepop-254773.mp3',
        'mood': 'pulse',
        'order': 5,
    },
]


class Command(BaseCommand):
    help = 'Seed reel music library (uses dashboard public sound paths)'

    def handle(self, *args, **options):
        n = 0
        for data in TRACKS:
            _, created = ReelMusicTrack.objects.update_or_create(
                slug=data['slug'],
                defaults=data,
            )
            if created:
                n += 1
        self.stdout.write(self.style.SUCCESS(f'Music tracks ready ({n} new).'))
