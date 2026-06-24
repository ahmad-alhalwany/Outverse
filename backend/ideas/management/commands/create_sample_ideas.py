from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from ideas.models import Idea

User = get_user_model()

SAMPLE_IDEAS = [
    {
        'title': 'Cosmic Co-Write Studio',
        'description': (
            'A real-time collaborative writing room where strangers finish '
            'each other\'s stories one paragraph at a time — like Forge, but live.'
        ),
        'category': 'writing',
        'status': 'proposed',
        'cover_url': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
        'roles_needed': ['writer', 'editor', 'designer'],
        'funding_goal': 5000,
        'funding_raised': 1200,
    },
    {
        'title': 'Mood Map for Cities',
        'description': (
            'Aggregate anonymous emotion bottles into a live heatmap so '
            'communities can see collective wellbeing by neighborhood.'
        ),
        'category': 'technology',
        'status': 'in_progress',
        'cover_url': 'https://images.unsplash.com/photo-1526778548025-fa2f0cd046c4?auto=format&fit=crop&w=800&q=80',
        'roles_needed': ['developer', 'data'],
        'funding_goal': 12000,
        'funding_raised': 4800,
    },
    {
        'title': 'Open Art Residency Network',
        'description': (
            'Connect emerging artists with empty studio spaces worldwide '
            'for one-week residencies funded by micro-patronage.'
        ),
        'category': 'art',
        'status': 'proposed',
        'cover_url': 'https://images.unsplash.com/photo-1460661419341-fd2047a5facf?auto=format&fit=crop&w=800&q=80',
        'roles_needed': ['curator', 'community'],
        'funding_goal': 8000,
        'funding_raised': 900,
    },
    {
        'title': 'Signal Reels for Science',
        'description': (
            'Short vertical explainers where researchers break down one '
            'discovery per reel — peer-reviewed captions optional.'
        ),
        'category': 'education',
        'status': 'proposed',
        'cover_url': 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=800&q=80',
        'roles_needed': ['scientist', 'video'],
        'funding_goal': 3000,
        'funding_raised': 2100,
    },
    {
        'title': 'Reforest by Bottle',
        'description': (
            'Every message bottle caught plants a tree. Partner with local '
            'NGOs and show impact on a shared globe.'
        ),
        'category': 'environment',
        'status': 'in_progress',
        'cover_url': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80',
        'roles_needed': ['ngo', 'developer'],
        'funding_goal': 15000,
        'funding_raised': 6700,
    },
    {
        'title': 'Mental Health Check-in Lab',
        'description': (
            'Weekly Lab challenges focused on reflective writing prompts '
            'reviewed by volunteer peer listeners — not therapy, but connection.'
        ),
        'category': 'health',
        'status': 'proposed',
        'cover_url': 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=800&q=80',
        'roles_needed': ['moderator', 'writer'],
        'funding_goal': 2000,
        'funding_raised': 400,
    },
    {
        'title': 'Neighborhood Skill Bazaar',
        'description': (
            'Trade an hour of your skill for an hour of someone else\'s — '
            'design for guitar lessons, code for cooking.'
        ),
        'category': 'social',
        'status': 'completed',
        'cover_url': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80',
        'roles_needed': [],
        'funding_goal': 1000,
        'funding_raised': 1000,
    },
    {
        'title': 'UI Kit for Cosmic Apps',
        'description': (
            'Open-source Figma components matching Outverse moods: vault, '
            'lab, bazaar, forge — dark and light.'
        ),
        'category': 'design',
        'status': 'proposed',
        'cover_url': 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80',
        'roles_needed': ['designer'],
        'funding_goal': 2500,
        'funding_raised': 800,
    },
]


class Command(BaseCommand):
    help = 'Seed Ideas Bazaar with sample proposals'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Delete existing ideas first')
        parser.add_argument('--username', type=str, default='', help='Owner username')

    def handle(self, *args, **options):
        if options['clear']:
            n = Idea.objects.count()
            Idea.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {n} ideas.'))

        if Idea.objects.exists() and not options['clear']:
            self.stdout.write('Ideas already exist — skip or use --clear')
            return

        username = options['username'].strip()
        users = list(User.objects.all()[:6])
        if not users:
            self.stderr.write(self.style.ERROR('No users — run create_sample_posts first.'))
            return

        owner = None
        if username:
            owner = User.objects.filter(username=username).first()
        owner = owner or users[0]

        created = 0
        for i, spec in enumerate(SAMPLE_IDEAS):
            idea = Idea.objects.create(owner=users[i % len(users)], **spec)
            voters = users[: min(4, len(users))]
            idea.votes.add(*voters)
            if len(users) > 1:
                idea.collaborators.add(users[(i + 1) % len(users)])
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created} sample ideas.'))
