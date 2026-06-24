import os

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from users.models import Follow, Profile

User = get_user_model()


class Command(BaseCommand):
    help = (
        'Seed demo data for all Outverse features (posts, lab, bazaar, vault, '
        'shop, forge, stories, reels, chat, moderation, notifications).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='ahmadalhalwany',
            help='Primary demo user (staff account)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear bottles, ideas, notifications before re-seeding',
        )
        parser.add_argument(
            '--skip-media',
            action='store_true',
            help='Skip downloading post media (faster, offline-friendly)',
        )
        parser.add_argument(
            '--skip-admin',
            action='store_true',
            help='Do not create/update staff user',
        )

    def handle(self, *args, **options):
        username = options['username'].strip()
        clear = options['clear']
        skip_media = options['skip_media']

        steps = []

        if not options['skip_admin']:
            password = os.environ.get('OUTVERSE_ADMIN_PASS', 'demo1234')
            steps.append(('ensure_staff', [username], {'password': password}))

        steps.extend([
            ('create_sample_posts', [], {}),
            ('create_sample_comments', [], {'clear': clear}),
        ])

        if not skip_media:
            steps.append(('add_media_to_posts', [], {}))

        steps.extend([
            ('create_sample_challenges', [], {}),
            ('create_sample_ideas', [], {'username': username, **({'clear': True} if clear else {})}),
            ('create_sample_bottles', [], {'username': username, **({'clear': True} if clear else {})}),
            ('create_sample_shop_items', [], {}),
            ('create_sample_stories_forge', [], {}),
            ('create_sample_stories', [], {}),
            ('create_sample_reels', [], {}),
            ('seed_reel_music', [], {}),
            ('create_sample_chat', [], {}),
            ('create_sample_flagged', [], {'clear': clear}),
            ('create_sample_notifications', [], {'username': username, 'clear': clear}),
        ])

        self.stdout.write(self.style.MIGRATE_HEADING('Seeding Outverse demo data...'))

        for name, args, kwargs in steps:
            self.stdout.write(f'  -> {name}')
            try:
                call_command(name, *args, **kwargs, verbosity=1)
            except Exception as exc:
                raise CommandError(f'{name} failed: {exc}') from exc

        self._seed_follows(username)
        self._seed_profiles()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Demo data seed complete.'))
        self.stdout.write(f'  Log in as: {username}')
        if not options['skip_admin']:
            self.stdout.write('  Password: OUTVERSE_ADMIN_PASS or demo1234')

    def _seed_follows(self, primary_username):
        primary = User.objects.filter(username=primary_username).first()
        others = list(User.objects.exclude(username=primary_username)[:4])
        if not primary or not others:
            return
        created = 0
        for other in others:
            _, was_created = Follow.objects.get_or_create(
                follower=primary,
                following=other,
            )
            if was_created:
                created += 1
            _, was_created = Follow.objects.get_or_create(
                follower=other,
                following=primary,
            )
            if was_created:
                created += 1
        if created:
            self.stdout.write(self.style.SUCCESS(f'  Follow graph: {created} new edges'))

    def _seed_profiles(self):
        achievements = [
            {'id': 'first_post', 'title': 'First Signal', 'icon': '🚀'},
            {'id': 'lab_streak', 'title': 'Lab Streak x3', 'icon': '🧪'},
            {'id': 'bottle_thrown', 'title': 'Message in a Bottle', 'icon': '🍾'},
        ]
        for user in User.objects.all():
            profile, _ = Profile.objects.get_or_create(user=user)
            if not profile.achievements:
                profile.achievements = achievements[:2]
            if profile.points < 500:
                profile.points = 1250
            profile.save()
