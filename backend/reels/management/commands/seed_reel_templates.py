from django.core.management.base import BaseCommand

from reels.models import ReelTemplate


TEMPLATES = [
    {
        'slug': 'nebula-hook',
        'title': 'Nebula Hook',
        'description': 'Cosmic opener with orbit stickers',
        'mood': 'cosmic',
        'filter_style': 'cosmic',
        'overlay_text': 'Signal incoming…',
        'overlay_stickers': [
            {'id': 's1', 'emoji': '✦', 'x': 18, 'y': 22, 'scale': 1.2},
            {'id': 's2', 'emoji': '◎', 'x': 78, 'y': 18, 'scale': 1.0},
        ],
        'default_sound_label': 'Nebula pulse',
        'backdrop_preset': 'nebula',
        'order': 1,
    },
    {
        'slug': 'void-confession',
        'title': 'Void Confession',
        'description': 'Dark intimate frame for honest takes',
        'mood': 'void',
        'filter_style': 'void',
        'overlay_text': 'Say the quiet part',
        'overlay_stickers': [
            {'id': 's1', 'emoji': '☾', 'x': 82, 'y': 70, 'scale': 1.1},
        ],
        'default_sound_label': 'Warp static',
        'backdrop_preset': 'void',
        'order': 2,
    },
    {
        'slug': 'spark-duel',
        'title': 'Spark Duel',
        'description': 'High-energy remix energy',
        'mood': 'spark',
        'filter_style': 'neon',
        'overlay_text': 'Remix this pulse',
        'overlay_stickers': [
            {'id': 's1', 'emoji': '⚡', 'x': 50, 'y': 14, 'scale': 1.4},
            {'id': 's2', 'emoji': '✨', 'x': 22, 'y': 76, 'scale': 1.0},
        ],
        'default_sound_label': 'Lucid orbit',
        'backdrop_preset': 'aurora',
        'order': 3,
    },
    {
        'slug': 'dream-drift',
        'title': 'Dream Drift',
        'description': 'Soft dreamy overlays',
        'mood': 'dream',
        'filter_style': 'dream',
        'overlay_text': 'Stay a little longer',
        'overlay_stickers': [
            {'id': 's1', 'emoji': '☁', 'x': 70, 'y': 28, 'scale': 1.2},
        ],
        'default_sound_label': 'Original signal',
        'backdrop_preset': 'orbit',
        'order': 4,
    },
    {
        'slug': 'pulse-grid',
        'title': 'Pulse Grid',
        'description': 'Glitch street energy',
        'mood': 'pulse',
        'filter_style': 'glitch',
        'overlay_text': 'Stay weird',
        'overlay_stickers': [
            {'id': 's1', 'emoji': '◈', 'x': 14, 'y': 60, 'scale': 1.0},
            {'id': 's2', 'emoji': '◈', 'x': 86, 'y': 40, 'scale': 1.0},
        ],
        'default_sound_label': 'Pulse grid',
        'backdrop_preset': '',
        'order': 5,
    },
]


class Command(BaseCommand):
    help = 'Seed Outverse Pulse reel templates'

    def handle(self, *args, **options):
        created = 0
        for row in TEMPLATES:
            obj, was_created = ReelTemplate.objects.update_or_create(
                slug=row['slug'],
                defaults={k: v for k, v in row.items() if k != 'slug'},
            )
            created += 1 if was_created else 0
            self.stdout.write(f"{'Created' if was_created else 'Updated'}: {obj.title}")
        self.stdout.write(self.style.SUCCESS(f'Done. {created} new templates.'))
