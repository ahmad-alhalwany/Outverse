from django.core.management.base import BaseCommand

from resources.models import Resource

STARTER_RESOURCES = [
    {
        'title': 'Story Framework Pack',
        'description': 'Five proven story-structure templates (Hero\'s Journey, Three-Act, Save the Cat, Kishotenketsu, In Medias Res) to jumpstart your next Story Forge entry.',
        'type': 'template',
        'mood': 'inspiration',
        'file_size_label': '1.2 MB',
    },
    {
        'title': 'Essential Color Palettes',
        'description': '20 curated color palettes with hex codes, organized by mood — from cosmic pastels to high-contrast neon.',
        'type': 'template',
        'mood': 'inspiration',
        'file_size_label': '340 KB',
    },
    {
        'title': 'Typography Masterclass',
        'description': 'A short video course on pairing fonts for social posts, covers, and shop listings.',
        'type': 'tutorial',
        'mood': 'learning',
        'file_size_label': '48 min',
    },
    {
        'title': 'UI Component Library',
        'description': 'Reusable Figma components matching the Outverse cosmic design system.',
        'type': 'toolkit',
        'mood': 'productivity',
        'file_size_label': '4.6 MB',
    },
    {
        'title': 'Video Production Guide',
        'description': 'A step-by-step guide to shooting and editing a Signals reel in under 20 minutes.',
        'type': 'tutorial',
        'mood': 'quick',
        'file_size_label': '2.1 MB',
    },
    {
        'title': 'Brand Style Templates',
        'description': 'Ready-made cover art and banner templates sized for every Outverse world.',
        'type': 'template',
        'mood': 'productivity',
        'file_size_label': '890 KB',
    },
    {
        'title': 'Social Media Content Calendar',
        'description': 'A 30-day posting plan template to keep your creative momentum going.',
        'type': 'toolkit',
        'mood': 'productivity',
        'file_size_label': '210 KB',
    },
    {
        'title': 'Project Timeline Template',
        'description': 'A simple spreadsheet timeline for planning a collaborative story or shop launch.',
        'type': 'template',
        'mood': 'quick',
        'file_size_label': '95 KB',
    },
]


class Command(BaseCommand):
    help = 'Seed the Resource Library with a handful of starter resources.'

    def handle(self, *args, **options):
        created = 0
        for spec in STARTER_RESOURCES:
            _, was_created = Resource.objects.get_or_create(title=spec['title'], defaults=spec)
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f'Resource library ready ({created} new).'))
