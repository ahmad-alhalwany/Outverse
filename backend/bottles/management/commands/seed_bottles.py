from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from bottles.models import MessageBottle

# Clustered within one neighborhood (Siglap, Singapore) so the map auto-fits to a
# close, walkable-scale view with real street/park detail — matching the design
# reference — rather than zooming out to fit pins scattered across continents.
STARTER_BOTTLES = [
    {'lat': 1.3086, 'lng': 103.9215, 'emotion_type': 'joy', 'message': 'Today was an amazing day, I finally finished my first short story!'},
    {'lat': 1.3132, 'lng': 103.9260, 'emotion_type': 'love', 'message': 'Sending warmth to whoever catches this.'},
    {'lat': 1.3105, 'lng': 103.9188, 'emotion_type': 'hope', 'message': 'I learned something new about myself today.'},
    {'lat': 1.3072, 'lng': 103.9241, 'emotion_type': 'sad', 'message': 'Missing someone tonight, but the rain is oddly comforting.'},
    {'lat': 1.3121, 'lng': 103.9203, 'emotion_type': 'calm', 'message': 'Sat by the water for an hour and just breathed.'},
    {'lat': 1.3095, 'lng': 103.9277, 'emotion_type': 'lonely', 'message': 'Some nights the city feels very quiet.'},
    {'lat': 1.3149, 'lng': 103.9224, 'emotion_type': 'joy', 'message': 'The weather was perfect for a walk on the beach.'},
    {'lat': 1.3063, 'lng': 103.9189, 'emotion_type': 'anxious', 'message': 'Big exam tomorrow, wish me luck out there.'},
    {'lat': 1.3110, 'lng': 103.9296, 'emotion_type': 'nostalgic', 'message': 'Found an old photo today and got lost in memories.'},
    {'lat': 1.3140, 'lng': 103.9167, 'emotion_type': 'love', 'message': 'Fell in love with this city today.'},
    {'lat': 1.3078, 'lng': 103.9308, 'emotion_type': 'hope', 'message': 'Starting something new tomorrow — a little nervous, mostly excited.'},
    {'lat': 1.3157, 'lng': 103.9253, 'emotion_type': 'calm', 'message': 'Quiet coffee, good book, no plans.'},
    {'lat': 1.3099, 'lng': 103.9151, 'emotion_type': 'joy', 'message': 'Reunited with an old friend after years apart.'},
    {'lat': 1.3126, 'lng': 103.9319, 'emotion_type': 'mystery', 'message': 'Some thoughts are better left unspoken, even here.'},
    {'lat': 1.3055, 'lng': 103.9227, 'emotion_type': 'sad', 'message': 'It has been a heavier week than usual.'},
    {'lat': 1.3168, 'lng': 103.9198, 'emotion_type': 'hope', 'message': 'Tomorrow feels like it could be a better day.'},
    {'lat': 1.3089, 'lng': 103.9269, 'emotion_type': 'lonely', 'message': 'Wish there was someone to share this sunset with.'},
    {'lat': 1.3117, 'lng': 103.9134, 'emotion_type': 'love', 'message': 'Grateful for the people who checked in on me today.'},
    {'lat': 1.3143, 'lng': 103.9287, 'emotion_type': 'joy', 'message': 'Small wins count too — finished my to-do list!'},
    {'lat': 1.3068, 'lng': 103.9182, 'emotion_type': 'anxious', 'message': 'Waiting on news I really hope goes well.'},
]


class Command(BaseCommand):
    help = 'Seed the Emotion Vault map with a clustered set of demo bottles in one neighborhood.'

    def handle(self, *args, **options):
        User = get_user_model()
        users = list(User.objects.order_by('id')[:10])
        if not users:
            self.stdout.write(self.style.WARNING('No users exist yet — create a user before seeding bottles.'))
            return

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
            )
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Emotion Vault ready ({created} drifting bottles).'))
