from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from speculative.models import Character, FailedIdea, FutureMemory
from studio.models import DrawSession

FAILED_IDEAS = [
    {
        'title': 'The Choose-Your-Own-Ending Cookbook',
        'description': 'A recipe book where every page branched into three possible next steps. Readers got lost more than they cooked.',
        'lesson_learned': 'Interactivity needs a reason — sometimes people just want dinner.',
        'exhibition': 'burned_ideas',
    },
    {
        'title': '30-Day Silent Story Challenge',
        'description': 'A challenge asking writers to tell a full story using only images, no text at all.',
        'lesson_learned': 'Constraints are great until they remove the thing people actually came here to do.',
        'exhibition': 'collapsed_challenges',
    },
    {
        'title': 'The Umbrella That Only Opens in Regret',
        'description': 'A short story about an umbrella that senses when you\'ve made a bad decision and pops open to shield you from the consequences — which never actually works.',
        'lesson_learned': 'The best failed ideas are the ones that were fun to imagine, even if they never quite land.',
        'exhibition': 'beautiful_disasters',
    },
    {
        'title': 'Reverse Poetry Slam',
        'description': 'Poets performed their pieces backward, word by word, hoping for hidden meaning. Mostly just confusion.',
        'lesson_learned': 'Novelty for its own sake rarely outlasts the first laugh.',
        'exhibition': 'collapsed_challenges',
    },
    {
        'title': 'The Diary of a Houseplant',
        'description': 'A serialized story narrated entirely from a fern\'s point of view. It went nowhere, slowly, on purpose.',
        'lesson_learned': 'Sometimes "nothing happens" is the whole bit — but it only works for one chapter.',
        'exhibition': 'burned_ideas',
    },
    {
        'title': 'Collaborative Villain Origin Stories',
        'description': 'Everyone was invited to co-write a supervillain\'s backstory — forty people, forty different villains in one thread.',
        'lesson_learned': 'Collaboration needs at least one shared thread to pull, or it splinters immediately.',
        'exhibition': 'beautiful_disasters',
    },
]

DRAW_SESSIONS = [
    {'title': 'Doodle the feeling you can\'t name'},
    {'title': 'Cosmic creature swap'},
    {'title': 'One line, no lifting the pen'},
]

FUTURE_MEMORIES = [
    {'text': 'I remember the day the whole neighborhood learned to make paper boats together, just because it rained for a week straight.', 'tag': 'community', 'is_public': True},
    {'text': 'The first time I read a story out loud and nobody laughed at my accent.', 'tag': 'confidence', 'is_public': True},
    {'text': 'Finally finishing the novel I\'ve been almost-writing for three years.', 'tag': 'creativity', 'is_public': True},
    {'text': 'A quiet Sunday where nothing needed fixing and nobody needed anything from me.', 'tag': 'peace', 'is_public': True},
    {'text': 'Teaching my kid the same card game my grandmother taught me.', 'tag': 'family', 'is_public': True},
]

CHARACTERS = [
    {'name': 'Vex, the Unfinished Sentence', 'description': 'A wandering thought given legs — speaks only in half-statements that others must complete.', 'rarity': 'epic', 'price': 250},
    {'name': 'Marrow the Archive Cat', 'description': 'Keeper of every forgotten story ever abandoned mid-draft; sleeps on the good ideas.', 'rarity': 'rare', 'price': 120},
    {'name': 'The Cartographer of Nowhere', 'description': 'Draws maps to places that only exist while you\'re dreaming of them.', 'rarity': 'legendary', 'price': 500},
    {'name': 'Pip, Apprentice Comet', 'description': 'A young comet still learning to leave a proper trail; mostly just sparkles nervously.', 'rarity': 'rare', 'price': 90},
    {'name': 'The Last Optimist', 'description': 'Believes every plot hole is secretly a plot twist waiting to be discovered.', 'rarity': 'epic', 'price': 300},
]


class Command(BaseCommand):
    help = 'Seed Museum, Studio, Memories, and Characters with demo content.'

    def handle(self, *args, **options):
        User = get_user_model()
        users = list(User.objects.order_by('id')[:10])
        if not users:
            self.stdout.write(self.style.WARNING('No users exist yet — create a user before seeding.'))
            return

        created_ideas = 0
        for i, spec in enumerate(FAILED_IDEAS):
            _, was_created = FailedIdea.objects.get_or_create(
                title=spec['title'],
                defaults={**spec, 'user': users[i % len(users)]},
            )
            if was_created:
                created_ideas += 1

        created_sessions = 0
        for i, spec in enumerate(DRAW_SESSIONS):
            _, was_created = DrawSession.objects.get_or_create(
                title=spec['title'],
                defaults={'host': users[i % len(users)]},
            )
            if was_created:
                created_sessions += 1

        created_memories = 0
        for i, spec in enumerate(FUTURE_MEMORIES):
            _, was_created = FutureMemory.objects.get_or_create(
                text=spec['text'],
                defaults={**{k: v for k, v in spec.items() if k != 'text'}, 'user': users[i % len(users)]},
            )
            if was_created:
                created_memories += 1

        created_characters = 0
        for i, spec in enumerate(CHARACTERS):
            _, was_created = Character.objects.get_or_create(
                name=spec['name'],
                defaults={**spec, 'creator': users[i % len(users)]},
            )
            if was_created:
                created_characters += 1

        self.stdout.write(self.style.SUCCESS(
            f'Speculative worlds ready: {created_ideas} museum exhibits, '
            f'{created_sessions} draw sessions, {created_memories} future memories, '
            f'{created_characters} characters.'
        ))
