"""Pre-generate personalized AI prompts for active users.

Usage:
    python manage.py pregenerate_inspiration
    python manage.py pregenerate_inspiration --user-id 3 --per-user 2
    python manage.py pregenerate_inspiration --dry-run
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from questions.feedback import pick_generate_category, preferred_categories_for_user, user_avoid_texts
from questions.llm import generate_question, persist_generated

User = get_user_model()


class Command(BaseCommand):
    help = 'Generate personalized inspiration prompts and add them to the question bank.'

    def add_arguments(self, parser):
        parser.add_argument('--user-id', type=int, help='Only generate for this user id')
        parser.add_argument('--limit', type=int, default=25, help='Max users to process')
        parser.add_argument('--per-user', type=int, default=1, help='Prompts per user per language')
        parser.add_argument('--dry-run', action='store_true', help='Print actions without calling LLM')

    def handle(self, *args, **options):
        qs = User.objects.filter(is_active=True).order_by('-last_login', '-id')
        if options['user_id']:
            qs = qs.filter(pk=options['user_id'])
        users = list(qs[: options['limit']])
        if not users:
            self.stdout.write('No users matched.')
            return

        created = 0
        for user in users:
            interests = list(getattr(user, 'interests', []) or [])
            preferred = preferred_categories_for_user(user)
            for lang in ('en', 'ar'):
                for _ in range(max(1, options['per_user'])):
                    category = pick_generate_category(user, None)
                    avoid = user_avoid_texts(user, lang)
                    if options['dry_run']:
                        self.stdout.write(
                            f'[dry-run] user={user.id} lang={lang} cat={category} preferred={preferred[:3]}'
                        )
                        continue
                    text = generate_question(
                        language=lang,
                        category=category,
                        interests=interests,
                        avoid=avoid,
                        preferred_categories=preferred,
                    )
                    if not text:
                        continue
                    persist_generated(text, language=lang, category=category or 'surreal')
                    created += 1

        self.stdout.write(self.style.SUCCESS(f'Done. Generated {created} prompt(s) for {len(users)} user(s).'))
