from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from notifications.models import Notification
from posts.models import Post
from reels.models import Reel

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample in-app notifications for testing'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true')
        parser.add_argument('--username', type=str, default='')

    def handle(self, *args, **options):
        if options['clear']:
            n = Notification.objects.count()
            Notification.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {n} notifications.'))

        users = list(User.objects.all()[:5])
        if len(users) < 2:
            self.stderr.write(self.style.ERROR('Need at least 2 users.'))
            return

        username = options['username'].strip()
        recipient = User.objects.filter(username=username).first() if username else users[0]
        if not recipient:
            recipient = users[0]

        post = Post.objects.first()
        reel = Reel.objects.first()
        actors = [u for u in users if u.id != recipient.id][:3]

        samples = []
        if post and actors:
            samples.extend([
                {
                    'recipient': recipient,
                    'actor': actors[0],
                    'verb': 'reaction',
                    'post': post,
                    'text': 'reacted to your post',
                    'is_read': False,
                },
                {
                    'recipient': recipient,
                    'actor': actors[min(1, len(actors) - 1)],
                    'verb': 'comment',
                    'post': post,
                    'text': 'commented on your post',
                    'is_read': True,
                },
            ])
        if reel and actors:
            samples.append({
                'recipient': recipient,
                'actor': actors[0],
                'verb': 'comment',
                'reel': reel,
                'text': 'commented on your reel',
                'is_read': False,
            })
        if len(actors) >= 2:
            samples.append({
                'recipient': recipient,
                'actor': actors[-1],
                'verb': 'follow',
                'text': 'started following you',
                'is_read': False,
            })

        created = 0
        for spec in samples:
            key = {
                'recipient': spec['recipient'],
                'actor': spec['actor'],
                'verb': spec['verb'],
                'text': spec['text'],
            }
            if Notification.objects.filter(**key).exists():
                continue
            Notification.objects.create(**spec)
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Notifications ready ({created} new).'))
