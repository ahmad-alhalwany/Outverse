"""Seed Instagram-style stories with geo pins for /stories/map testing."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from stories.models import Story

User = get_user_model()

# Text snaps with world locations — no media required for map pins.
MAP_SNAPS = [
    {
        'text': 'Sunrise over Damascus — the city wakes in gold.',
        'location_name': 'Damascus, Syria',
        'location_lat': 33.5138,
        'location_lng': 36.2765,
        'mood': 'dreamy',
    },
    {
        'text': 'Neon rain on Shibuya crossing. Cosonova feels close tonight.',
        'location_name': 'Tokyo, Japan',
        'location_lat': 35.6595,
        'location_lng': 139.7004,
        'mood': 'neon',
    },
    {
        'text': 'Cairo nights: Nile breeze and a story half-finished.',
        'location_name': 'Cairo, Egypt',
        'location_lat': 30.0444,
        'location_lng': 31.2357,
        'mood': 'cosmic',
    },
    {
        'text': 'Coffee steam + fog over the Golden Gate.',
        'location_name': 'San Francisco, USA',
        'location_lat': 37.8199,
        'location_lng': -122.4783,
        'mood': 'chill',
    },
    {
        'text': 'Berlin warehouse pulse. Dropping a signal from the floor.',
        'location_name': 'Berlin, Germany',
        'location_lat': 52.5200,
        'location_lng': 13.4050,
        'mood': 'glitch',
    },
    {
        'text': 'Amman rooftop — stars brighter than the notifications.',
        'location_name': 'Amman, Jordan',
        'location_lat': 31.9539,
        'location_lng': 35.9106,
        'mood': 'calm',
    },
    {
        'text': 'Istanbul ferry crossing. Two continents, one snap.',
        'location_name': 'Istanbul, Türkiye',
        'location_lat': 41.0082,
        'location_lng': 28.9784,
        'mood': 'wander',
    },
    {
        'text': 'Dubai marina lights look like a constellation you can walk into.',
        'location_name': 'Dubai, UAE',
        'location_lat': 25.0805,
        'location_lng': 55.1403,
        'mood': 'glow',
    },
]


class Command(BaseCommand):
    help = 'Seed geo-tagged stories so /stories/map has pins to explore'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            default='',
            help='Owner username (default: first staff/demo user, else first user)',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='How many days until these demo stories expire (default: 7)',
        )

    def handle(self, *args, **options):
        username = (options.get('username') or '').strip()
        days = max(1, int(options.get('days') or 7))

        if username:
            user = User.objects.filter(username__iexact=username).first()
            if not user:
                self.stderr.write(self.style.ERROR(f'User "{username}" not found.'))
                return
        else:
            user = (
                User.objects.filter(username__iexact='ahmadalhalwany').first()
                or User.objects.filter(is_staff=True).order_by('id').first()
                or User.objects.order_by('id').first()
            )
        if not user:
            self.stderr.write(self.style.ERROR('No users found. Create a user first.'))
            return

        expires = timezone.now() + timedelta(days=days)
        created = 0
        refreshed = 0

        for snap in MAP_SNAPS:
            existing = Story.objects.filter(
                user=user,
                text=snap['text'],
                location_lat=snap['location_lat'],
                location_lng=snap['location_lng'],
            ).first()
            if existing:
                existing.is_active = True
                existing.expires_at = expires
                existing.location_name = snap['location_name']
                existing.mood = snap.get('mood') or existing.mood
                existing.save(update_fields=['is_active', 'expires_at', 'location_name', 'mood'])
                refreshed += 1
                continue

            Story.objects.create(
                user=user,
                text=snap['text'],
                location_name=snap['location_name'],
                location_lat=snap['location_lat'],
                location_lng=snap['location_lng'],
                mood=snap.get('mood') or '',
                is_active=True,
                expires_at=expires,
                audience='everyone',
            )
            created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Story map seed done for @{user.username}: '
                f'{created} created, {refreshed} refreshed (expire in {days}d). '
                f'Open /stories/map'
            )
        )
