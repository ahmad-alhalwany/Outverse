from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from chat.models import ChatRoom, RoomMessage
from questions.models import Question

# category -> a couple of demo replies that read naturally as room chatter.
DEMO_REPLIES = [
    "I'd probably freeze for a second, then just start writing it down before it fades.",
    "Honestly this is the kind of question that keeps me up at night in a good way.",
    "Mine would involve way more snacks than is reasonable.",
    "I think the scary part is realizing how much of it is already true.",
    "Okay wait, now I want to actually try this for real.",
]


class Command(BaseCommand):
    help = 'Seed a few live Prompt Rooms from existing questions so the Rooms page has content.'

    def handle(self, *args, **options):
        User = get_user_model()
        users = list(User.objects.order_by('id')[:10])
        if not users:
            self.stdout.write(self.style.WARNING('No users exist yet — create a user before seeding.'))
            return

        questions = list(Question.objects.filter(is_active=True).order_by('id')[:5])
        if not questions:
            self.stdout.write(self.style.WARNING('No active questions exist yet — nothing to seed rooms from.'))
            return

        now = timezone.now()
        created = 0
        for i, question in enumerate(questions):
            room, was_created = ChatRoom.objects.get_or_create(
                question=question,
                defaults={
                    'name': question.text[:120],
                    'created_by': users[i % len(users)],
                    'expires_at': now + timedelta(hours=24),
                },
            )
            if not was_created:
                if room.expires_at and room.expires_at <= now:
                    room.expires_at = now + timedelta(hours=24)
                    room.save(update_fields=['expires_at'])
            else:
                created += 1

            room.members.add(*[u.id for u in users[: 3 + i % 3]])

            for j in range(min(2 + i % 2, len(users))):
                sender = users[(i + j) % len(users)]
                RoomMessage.objects.get_or_create(
                    room=room,
                    sender=sender,
                    text=DEMO_REPLIES[(i + j) % len(DEMO_REPLIES)],
                )

        self.stdout.write(self.style.SUCCESS(f'Prompt Rooms ready ({created} new rooms, {len(questions)} active).'))
