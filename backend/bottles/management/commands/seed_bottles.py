from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from bottles.models import MessageBottle

# Worldwide drifting bottles — each city carries a mood so the cosmic map
# reads as a global emotion field, matching Emotion Vault design intent.
STARTER_BOTTLES = [
    {'lat': 48.8566, 'lng': 2.3522, 'emotion_type': 'joy', 'message': 'Paris glow tonight — small joys still matter.', 'place': 'Paris'},
    {'lat': 35.6762, 'lng': 139.6503, 'emotion_type': 'hope', 'message': 'Tokyo sunrise. Starting something gentle tomorrow.', 'place': 'Tokyo'},
    {'lat': 40.7128, 'lng': -74.0060, 'emotion_type': 'calm', 'message': 'Quiet harbor breath in New York.', 'place': 'New York'},
    {'lat': -33.8688, 'lng': 151.2093, 'emotion_type': 'love', 'message': 'Sydney light feels soft today. Sending warmth.', 'place': 'Sydney'},
    {'lat': 51.5074, 'lng': -0.1278, 'emotion_type': 'nostalgic', 'message': 'London rain on old streets. Remembering kinder days.', 'place': 'London'},
    {'lat': 25.2048, 'lng': 55.2708, 'emotion_type': 'mystery', 'message': 'Desert night sky above Dubai — some thoughts stay unspoken.', 'place': 'Dubai'},
    {'lat': -23.5505, 'lng': -46.6333, 'emotion_type': 'joy', 'message': 'São Paulo pulse. Finished a story I was afraid to start.', 'place': 'São Paulo'},
    {'lat': 19.4326, 'lng': -99.1332, 'emotion_type': 'love', 'message': 'Mexico City colors. Grateful for who checked in.', 'place': 'Mexico City'},
    {'lat': 28.6139, 'lng': 77.2090, 'emotion_type': 'hope', 'message': 'Delhi dusk. Tomorrow might be lighter.', 'place': 'Delhi'},
    {'lat': 1.3521, 'lng': 103.8198, 'emotion_type': 'calm', 'message': 'Singapore evening — coffee, book, no rush.', 'place': 'Singapore'},
    {'lat': 30.0444, 'lng': 31.2357, 'emotion_type': 'nostalgic', 'message': 'Cairo river wind. Old photos, new courage.', 'place': 'Cairo'},
    {'lat': 41.0082, 'lng': 28.9784, 'emotion_type': 'lonely', 'message': 'Istanbul bridges at night. The city feels quiet.', 'place': 'Istanbul'},
    {'lat': 55.7558, 'lng': 37.6173, 'emotion_type': 'sad', 'message': 'Moscow snow. Heavy week, but still here.', 'place': 'Moscow'},
    {'lat': 37.7749, 'lng': -122.4194, 'emotion_type': 'anxious', 'message': 'San Francisco fog. Waiting on news I care about.', 'place': 'San Francisco'},
    {'lat': 34.0522, 'lng': -118.2437, 'emotion_type': 'joy', 'message': 'LA golden hour. Small wins count.', 'place': 'Los Angeles'},
    {'lat': -26.2041, 'lng': 28.0473, 'emotion_type': 'hope', 'message': 'Johannesburg morning. Learning myself again.', 'place': 'Johannesburg'},
    {'lat': 6.5244, 'lng': 3.3792, 'emotion_type': 'love', 'message': 'Lagos energy. Sending this to whoever needs it.', 'place': 'Lagos'},
    {'lat': 13.7563, 'lng': 100.5018, 'emotion_type': 'calm', 'message': 'Bangkok canal quiet. Breathing slowly.', 'place': 'Bangkok'},
    {'lat': 22.3193, 'lng': 114.1694, 'emotion_type': 'mystery', 'message': 'Hong Kong neon reflections — keep this secret.', 'place': 'Hong Kong'},
    {'lat': 39.9042, 'lng': 116.4074, 'emotion_type': 'hope', 'message': 'Beijing rooftops. A new chapter feels close.', 'place': 'Beijing'},
    {'lat': -34.6037, 'lng': -58.3816, 'emotion_type': 'joy', 'message': 'Buenos Aires tango night in my chest.', 'place': 'Buenos Aires'},
    {'lat': 45.5017, 'lng': -73.5673, 'emotion_type': 'calm', 'message': 'Montreal snowfall hush. Soft inside.', 'place': 'Montreal'},
    {'lat': 52.5200, 'lng': 13.4050, 'emotion_type': 'nostalgic', 'message': 'Berlin corners. Memory and forward motion.', 'place': 'Berlin'},
    {'lat': 41.9028, 'lng': 12.4964, 'emotion_type': 'love', 'message': 'Rome evening bells. Fell for this city again.', 'place': 'Rome'},
    {'lat': 37.9838, 'lng': 23.7275, 'emotion_type': 'sad', 'message': 'Athens dusk. Missing someone gently.', 'place': 'Athens'},
    {'lat': 24.7136, 'lng': 46.6753, 'emotion_type': 'hope', 'message': 'Riyadh night. Starting something bright.', 'place': 'Riyadh'},
    {'lat': 33.3152, 'lng': 44.3661, 'emotion_type': 'lonely', 'message': 'Baghdad twilight. Wish for company under this sky.', 'place': 'Baghdad'},
    {'lat': 31.7683, 'lng': 35.2137, 'emotion_type': 'calm', 'message': 'Jerusalem stones hold quiet hope.', 'place': 'Jerusalem'},
    {'lat': 36.8065, 'lng': 10.1815, 'emotion_type': 'joy', 'message': 'Tunis sea air. Finished what I feared.', 'place': 'Tunis'},
    {'lat': -1.2921, 'lng': 36.8219, 'emotion_type': 'hope', 'message': 'Nairobi morning light. Tomorrow can be kinder.', 'place': 'Nairobi'},
    {'lat': 64.1466, 'lng': -21.9426, 'emotion_type': 'mystery', 'message': 'Reykjavik aurora thoughts — leave them here.', 'place': 'Reykjavik'},
    {'lat': -36.8485, 'lng': 174.7633, 'emotion_type': 'calm', 'message': 'Auckland harbor stillness.', 'place': 'Auckland'},
    {'lat': 59.3293, 'lng': 18.0686, 'emotion_type': 'lonely', 'message': 'Stockholm waterfront. Soft loneliness.', 'place': 'Stockholm'},
    {'lat': 47.6062, 'lng': -122.3321, 'emotion_type': 'anxious', 'message': 'Seattle rain. Big day tomorrow — wish me luck.', 'place': 'Seattle'},
    {'lat': 43.6532, 'lng': -79.3832, 'emotion_type': 'joy', 'message': 'Toronto spark. Reunited after years.', 'place': 'Toronto'},
    {'lat': 12.9716, 'lng': 77.5946, 'emotion_type': 'hope', 'message': 'Bengaluru code and coffee. Excited-nervous.', 'place': 'Bengaluru'},
    {'lat': -22.9068, 'lng': -43.1729, 'emotion_type': 'love', 'message': 'Rio waves. Sending warmth across the sea.', 'place': 'Rio'},
    {'lat': 35.6892, 'lng': 51.3890, 'emotion_type': 'sad', 'message': 'Tehran evening. Heavier week than usual.', 'place': 'Tehran'},
    {'lat': 21.3069, 'lng': -157.8583, 'emotion_type': 'calm', 'message': 'Honolulu trade winds. Just breathed.', 'place': 'Honolulu'},
    {'lat': 14.5995, 'lng': 120.9842, 'emotion_type': 'joy', 'message': 'Manila sunset. Small festival of kindness in my head.', 'place': 'Manila'},
]


class Command(BaseCommand):
    help = 'Seed Emotion Vault with worldwide drifting bottles (global mood map).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--replace-all-active',
            action='store_true',
            help='Expire existing unopened drifting bottles before seeding.',
        )

    def handle(self, *args, **options):
        User = get_user_model()
        users = list(User.objects.order_by('id')[:10])
        if not users:
            self.stdout.write(self.style.WARNING('No users exist yet — create a user before seeding bottles.'))
            return

        if options.get('replace_all_active'):
            now = timezone.now()
            MessageBottle.objects.filter(
                is_opened=False,
                caught_by__isnull=True,
                expiry_time__gt=now,
            ).update(expiry_time=now - timedelta(minutes=1))

        messages = [spec['message'] for spec in STARTER_BOTTLES]
        MessageBottle.objects.filter(message__in=messages).delete()

        created = 0
        for i, spec in enumerate(STARTER_BOTTLES):
            sender = users[i % len(users)]
            MessageBottle.objects.create(
                sender=sender,
                message=spec['message'],
                emotion_type=spec['emotion_type'],
                location_lat=spec['lat'],
                location_lng=spec['lng'],
                expiry_time=timezone.now() + timedelta(hours=24),
                is_opened=False,
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(
            f'Emotion Vault ready ({created} worldwide drifting bottles).'
        ))
