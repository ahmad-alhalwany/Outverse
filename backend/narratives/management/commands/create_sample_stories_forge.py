from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from narratives.models import Segment, Story

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample collaborative stories for Story Forge'

    def handle(self, *args, **options):
        owner = User.objects.first()
        users = list(User.objects.all())

        stories = [
            {
                'title': 'The Last Library on Mars',
                'premise': (
                    'When the dust storms cleared, only one building still '
                    'glowed on the red horizon: a library no one remembered '
                    'building.'
                ),
                'genre': 'scifi',
                'cover_url': 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80',
                'is_featured': True,
                'max_segments': 10,
                'segments': [
                    'Mira pressed her gloved hand against the door, and it sighed open as if it had been waiting for her.',
                    'Inside, the shelves rearranged themselves, whispering titles that had not been written yet.',
                ],
            },
            {
                'title': 'A Man Who Lived Inside a Computer',
                'premise': (
                    'There was a man who lived inside a computer, and every '
                    'night he rearranged the icons into constellations.'
                ),
                'genre': 'absurd',
                'cover_url': 'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?auto=format&fit=crop&w=800&q=80',
                'is_featured': True,
                'max_segments': 8,
                'segments': [
                    'One morning the cursor blinked twice and asked him a question no human had ever typed.',
                ],
            },
            {
                'title': 'The Clockmaker of Forgotten Hours',
                'premise': (
                    'In a town where time ran backwards on Sundays, an old '
                    'clockmaker collected the hours people wished to forget.'
                ),
                'genre': 'fantasy',
                'cover_url': 'https://images.unsplash.com/photo-1495364141860-b0d03eccd065?auto=format&fit=crop&w=800&q=80',
                'is_featured': False,
                'max_segments': 12,
                'segments': [],
            },
            {
                'title': 'The House That Remembered Everyone',
                'premise': (
                    'The new tenants noticed the walls breathing, slow and '
                    'patient, as if the house was deciding whether to keep them.'
                ),
                'genre': 'horror',
                'cover_url': 'https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?auto=format&fit=crop&w=800&q=80',
                'is_featured': False,
                'max_segments': 10,
                'segments': [],
            },
        ]

        for data in stories:
            seg_texts = data.pop('segments')
            story, created = Story.objects.get_or_create(
                title=data['title'],
                defaults={**data, 'owner': owner, 'status': 'open'},
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created story: {story.title}')
                )
                for idx, text in enumerate(seg_texts):
                    author = users[idx % len(users)] if users else None
                    Segment.objects.create(
                        story=story,
                        author=author,
                        content=text,
                        order=idx + 1,
                    )

        self.stdout.write(
            self.style.SUCCESS('Successfully created sample Story Forge stories')
        )
