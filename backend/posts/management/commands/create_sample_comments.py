import random

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from posts.models import Comment, CommentReaction, Post

User = get_user_model()

SAMPLE_TEXTS = [
    'Great share!',
    'Love this content.',
    'Very useful, thanks.',
    'Want more posts like this.',
    'This reminds me of a similar experience.',
    'Excellent ideas!',
    'High quality content.',
    'This is inspiring.',
]

REACTION_TYPES = ['inspired', 'cosmic', 'spark', 'growing', 'mindbending']


class Command(BaseCommand):
    help = 'Create sample post comments and reactions'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true')

    def handle(self, *args, **options):
        if options['clear']:
            n = Comment.objects.count()
            Comment.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {n} comments.'))
        elif Comment.objects.exists():
            self.stdout.write('Comments already exist — skip or use --clear')
            return

        users = list(User.objects.all())
        posts = list(Post.objects.all())
        if not users or not posts:
            self.stderr.write(self.style.ERROR('No users or posts found.'))
            return

        comments_created = 0
        reactions_created = 0

        for post in posts:
            for _ in range(random.randint(2, 5)):
                user = random.choice(users)
                comment = Comment.objects.create(
                    post=post,
                    user=user,
                    text=random.choice(SAMPLE_TEXTS),
                )
                comments_created += 1

                if random.random() < 0.35:
                    for _ in range(random.randint(1, 2)):
                        Comment.objects.create(
                            post=post,
                            user=random.choice(users),
                            parent=comment,
                            text=random.choice(SAMPLE_TEXTS),
                        )
                        comments_created += 1

                for reaction_user in random.sample(users, min(3, len(users))):
                    _, was_created = CommentReaction.objects.get_or_create(
                        comment=comment,
                        user=reaction_user,
                        defaults={'type': random.choice(REACTION_TYPES)},
                    )
                    if was_created:
                        reactions_created += 1

        for post in posts:
            post.comments_count = post.comments.count()
            post.save()

        self.stdout.write(
            self.style.SUCCESS(
                f'Created {comments_created} comments, {reactions_created} reactions.'
            )
        )
