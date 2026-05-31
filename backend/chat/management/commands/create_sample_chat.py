from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from chat.models import Conversation, Message, UserPresence

User = get_user_model()

SAMPLE_LINES = [
    ("Hey! How's your cosmic journey going? 🚀", False),
    ("Amazing! Just discovered a new constellation of ideas!", True),
    ("Working on the new project — want to join the Lab challenge?", False),
    ("Yes! Let's sync in Shared Space later ✨", True),
]


class Command(BaseCommand):
    help = 'Seed sample chat messages between users'

    def handle(self, *args, **options):
        users = list(User.objects.all()[:6])
        if len(users) < 2:
            self.stdout.write(self.style.WARNING('Need at least 2 users.'))
            return

        statuses = [
            'Working on the new project',
            'In a meeting',
            'Feeling stellar!',
            'Exploring nebula stories',
        ]
        for i, u in enumerate(users):
            p, _ = UserPresence.objects.get_or_create(user=u)
            p.status_message = statuses[i % len(statuses)]
            p.mood_icon = 'sun' if i % 2 == 0 else 'cloud'
            p.save()

        me = users[0]
        for peer in users[1:4]:
            conv = Conversation.for_users(me.id, peer.id)
            if conv.messages.exists():
                continue
            for text, from_me in SAMPLE_LINES[:3]:
                Message.objects.create(
                    conversation=conv,
                    sender_id=me.id if from_me else peer.id,
                    text=text,
                )

        self.stdout.write(self.style.SUCCESS('Sample chat ready.'))
