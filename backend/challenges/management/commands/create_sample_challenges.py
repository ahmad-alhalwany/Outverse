from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from challenges.models import Challenge

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample challenges for the Weirdness Lab'

    def handle(self, *args, **options):
        now = timezone.now()

        daily = {
            'title': 'If your pet wrote a memoir, what would Chapter 1 say?',
            'description': (
                "Get creative and write from your pet's perspective. "
                'What tales would they tell about their human?'
            ),
            'type': 'writing',
            'difficulty': 'easy',
            'cover_url': '',
            'is_daily': True,
            'is_active': True,
            'end_date': now + timedelta(hours=12),
        }

        archive = [
            {
                'title': 'Design a Time Machine',
                'description': 'Sketch or describe a machine that bends time.',
                'type': 'art',
                'difficulty': 'medium',
                'cover_url': 'https://images.unsplash.com/photo-1501139083538-0139583c060f?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Write a Letter to Future You',
                'description': 'A message to who you will be in ten years.',
                'type': 'writing',
                'difficulty': 'easy',
                'cover_url': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Invent a New Color',
                'description': 'Name it, describe it, tell us how it feels.',
                'type': 'experimental',
                'difficulty': 'hard',
                'cover_url': 'https://images.unsplash.com/photo-1502691876148-a84978e59af8?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Create an Alien Language',
                'description': 'Three words and what they mean.',
                'type': 'writing',
                'difficulty': 'medium',
                'cover_url': 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Compose a 10-Second Melody',
                'description': 'Hum it, tab it, or describe its mood.',
                'type': 'music',
                'difficulty': 'medium',
                'cover_url': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
            },
            {
                'title': 'Draw Your Mood as a Landscape',
                'description': 'Turn how you feel today into a place.',
                'type': 'art',
                'difficulty': 'easy',
                'cover_url': 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80',
            },
        ]

        challenge, created = Challenge.objects.get_or_create(
            title=daily['title'],
            defaults={**daily},
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created daily challenge: {challenge.title}')
            )

        for idx, data in enumerate(archive):
            obj, was_created = Challenge.objects.get_or_create(
                title=data['title'],
                defaults={
                    **data,
                    'is_daily': False,
                    'is_active': True,
                    'end_date': now - timedelta(days=idx + 1),
                },
            )
            if was_created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created challenge: {obj.title}')
                )

        self.stdout.write(
            self.style.SUCCESS('Successfully created sample challenges')
        )
