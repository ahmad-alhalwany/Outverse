import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from bottles.models import MessageBottle

User = get_user_model()

SAMPLE_BOTTLES = [
    {
        'message': 'Today was an amazing day — the sunset over the Seine reminded me that small joys matter.',
        'emotion_type': 'joy',
        'location_lat': 48.8566,
        'location_lng': 2.3522,
        'place': 'Paris, France',
        'hours_ago': 2,
    },
    {
        'message': 'Feeling hopeful about the new chapter starting next week. Sending this into the cosmos.',
        'emotion_type': 'hope',
        'location_lat': 35.6762,
        'location_lng': 139.6503,
        'place': 'Tokyo, Japan',
        'hours_ago': 5,
    },
    {
        'message': 'Quiet morning by the harbor. Breathing slowly. Grateful for stillness.',
        'emotion_type': 'calm',
        'location_lat': 40.7128,
        'location_lng': -74.006,
        'place': 'New York, USA',
        'hours_ago': 8,
    },
    {
        'message': 'Miss someone I used to walk with every Sunday. If you catch this — tell them the park still blooms.',
        'emotion_type': 'nostalgic',
        'location_lat': 51.5074,
        'location_lng': -0.1278,
        'place': 'London, UK',
        'hours_ago': 12,
    },
    {
        'message': 'Heart full after helping a stranger find their way. Love spreads quietly.',
        'emotion_type': 'love',
        'location_lat': -33.8688,
        'location_lng': 151.2093,
        'place': 'Sydney, Australia',
        'hours_ago': 3,
    },
    {
        'message': 'Rain on the window. Some days are heavy — that is okay.',
        'emotion_type': 'sad',
        'location_lat': 52.52,
        'location_lng': 13.405,
        'place': 'Berlin, Germany',
        'hours_ago': 6,
    },
    {
        'message': 'Presentation tomorrow. Butterflies in my stomach. Wish me luck, universe.',
        'emotion_type': 'anxious',
        'location_lat': 25.2048,
        'location_lng': 55.2708,
        'place': 'Dubai, UAE',
        'hours_ago': 1,
    },
    {
        'message': 'Alone in a new city but learning to enjoy my own company.',
        'emotion_type': 'lonely',
        'location_lat': 37.7749,
        'location_lng': -122.4194,
        'place': 'San Francisco, USA',
        'hours_ago': 9,
    },
    {
        'message': 'Found a note in an old book. Whoever wrote it — your words still echo.',
        'emotion_type': 'mystery',
        'location_lat': 41.9028,
        'location_lng': 12.4964,
        'place': 'Rome, Italy',
        'hours_ago': 4,
    },
    {
        'message': 'Couscous with friends until midnight. Laughter heals.',
        'emotion_type': 'joy',
        'location_lat': 33.5731,
        'location_lng': -7.5898,
        'place': 'Casablanca, Morocco',
        'hours_ago': 7,
    },
    {
        'message': 'First snow of the year. Everything feels reset.',
        'emotion_type': 'calm',
        'location_lat': 59.3293,
        'location_lng': 18.0686,
        'place': 'Stockholm, Sweden',
        'hours_ago': 11,
    },
    {
        'message': 'Dreamed of oceans on other worlds. Maybe someone out there feels this too.',
        'emotion_type': 'mystery',
        'location_lat': -22.9068,
        'location_lng': -43.1729,
        'place': 'Rio de Janeiro, Brazil',
        'hours_ago': 14,
    },
    {
        'message': 'Graduation day! To everyone who doubted — we made it.',
        'emotion_type': 'hope',
        'location_lat': 19.4326,
        'location_lng': -99.1332,
        'place': 'Mexico City, Mexico',
        'hours_ago': 10,
    },
    {
        'message': 'Said goodbye at the airport. Love you across every timezone.',
        'emotion_type': 'love',
        'location_lat': 1.3521,
        'location_lng': 103.8198,
        'place': 'Singapore',
        'hours_ago': 15,
    },
    {
        'message': 'Could not sleep. Leaving this here for the night owls.',
        'emotion_type': 'lonely',
        'location_lat': 28.6139,
        'location_lng': 77.209,
        'place': 'New Delhi, India',
        'hours_ago': 18,
    },
    {
        'message': 'Street musician played my favorite song. Cried a little. Happy tears.',
        'emotion_type': 'joy',
        'location_lat': 55.7558,
        'location_lng': 37.6173,
        'place': 'Moscow, Russia',
        'hours_ago': 20,
    },
    {
        'message': 'Waves at Bondi at dawn. The world is bigger than my worries.',
        'emotion_type': 'calm',
        'location_lat': -33.8908,
        'location_lng': 151.2743,
        'place': 'Bondi Beach, Australia',
        'hours_ago': 22,
    },
    {
        'message': 'Lost a friend this year. If you feel grief too — you are not alone.',
        'emotion_type': 'sad',
        'location_lat': 43.6532,
        'location_lng': -79.3832,
        'place': 'Toronto, Canada',
        'hours_ago': 16,
    },
    {
        'message': 'Interview in an hour. Deep breaths. We rise.',
        'emotion_type': 'anxious',
        'location_lat': 31.2304,
        'location_lng': 121.4737,
        'place': 'Shanghai, China',
        'hours_ago': 0.5,
    },
    {
        'message': 'Old playlist on shuffle. Teenage me would be proud.',
        'emotion_type': 'nostalgic',
        'location_lat': 34.0522,
        'location_lng': -118.2437,
        'place': 'Los Angeles, USA',
        'hours_ago': 13,
    },
]

MOOD_CYCLE = ['joy', 'joy', 'calm', 'hope', 'sad', 'calm', 'love', 'joy', 'anxious', 'calm']


class Command(BaseCommand):
    help = 'Seed drifting message bottles around the world for demos and testing.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Delete existing bottles before seeding',
        )
        parser.add_argument(
            '--username',
            type=str,
            default='',
            help='Assign all bottles to this user (default: first user)',
        )

    def handle(self, *args, **options):
        if options['clear']:
            count = MessageBottle.objects.count()
            MessageBottle.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {count} bottles.'))
        elif MessageBottle.objects.exists():
            self.stdout.write('Bottles already exist — skip or use --clear')
            return

        username = options['username'].strip()
        if username:
            user = User.objects.filter(username=username).first()
        else:
            user = User.objects.order_by('id').first()
        if not user:
            self.stderr.write(self.style.ERROR('No users in database. Create one first.'))
            return

        now = timezone.now()
        created = 0
        for i, spec in enumerate(SAMPLE_BOTTLES):
            jitter_lat = spec['location_lat'] + random.uniform(-0.08, 0.08)
            jitter_lng = spec['location_lng'] + random.uniform(-0.08, 0.08)
            created_at = now - timedelta(hours=spec['hours_ago'])
            expiry = created_at + timedelta(hours=24)
            MessageBottle.objects.create(
                sender=user,
                message=spec['message'],
                emotion_type=spec['emotion_type'],
                location_lat=round(jitter_lat, 5),
                location_lng=round(jitter_lng, 5),
                expiry_time=expiry,
                created_at=created_at,
                is_opened=False,
            )
            created += 1

        # Historical bottles for dashboard timeline (last 30 days)
        for day_offset in range(30):
            emotion = MOOD_CYCLE[day_offset % len(MOOD_CYCLE)]
            MessageBottle.objects.create(
                sender=user,
                message=f'Day {30 - day_offset} mood log — feeling {emotion}.',
                emotion_type=emotion,
                location_lat=48.85 + random.uniform(-2, 2),
                location_lng=2.35 + random.uniform(-2, 2),
                expiry_time=now - timedelta(days=day_offset) + timedelta(hours=20),
                created_at=now - timedelta(days=day_offset),
                is_opened=day_offset > 3,
                caught_by=user if day_offset % 4 == 0 else None,
            )

        thrown = MessageBottle.objects.filter(sender=user).count()
        caught = MessageBottle.objects.filter(caught_by=user).count()
        self.stdout.write(
            self.style.SUCCESS(
                f'Created {created} drifting bottles (+ mood history) for @{user.username}. '
                f'Totals: {thrown} thrown, {caught} caught.'
            )
        )
