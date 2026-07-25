from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from communities.models import Community, CommunityMembership

User = get_user_model()

SAMPLE_COMMUNITIES = [
    {
        'slug': 'digital-artists',
        'name': 'Digital Artists',
        'description': 'Share work-in-progress, get critique, and trade brush packs with fellow digital painters.',
        'cover_url': 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=80',
        'privacy': 'public',
    },
    {
        'slug': 'creative-writing-circle',
        'name': 'Creative Writing Circle',
        'description': 'Weekly prompts, beta-reader swaps, and a no-judgment space for first drafts.',
        'cover_url': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
        'privacy': 'public',
    },
    {
        'slug': 'street-photography',
        'name': 'Street Photography',
        'description': 'Candid shots, film vs. digital debates, and monthly walk meetups by city.',
        'cover_url': 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=80',
        'privacy': 'public',
    },
    {
        'slug': 'indie-animators',
        'name': 'Indie Animators',
        'description': 'Frame-by-frame breakdowns, rig sharing, and honest feedback on short loops.',
        'cover_url': 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
        'privacy': 'public',
    },
    {
        'slug': 'late-night-composers',
        'name': 'Late Night Composers',
        'description': 'Lo-fi beats, film scoring tips, and stem swaps for collaborators in any timezone.',
        'cover_url': 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=800&q=80',
        'privacy': 'public',
    },
    {
        'slug': 'founders-only',
        'name': "Founders' Table",
        'description': 'A private room for people actively building something — pledges, blockers, and wins.',
        'cover_url': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
        'privacy': 'private',
    },
]


class Command(BaseCommand):
    help = 'Seed sample communities with memberships'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Delete existing communities first')

    def handle(self, *args, **options):
        if options['clear']:
            n = Community.objects.count()
            Community.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {n} communities.'))

        if Community.objects.exists() and not options['clear']:
            self.stdout.write('Communities already exist — skip or use --clear')
            return

        users = list(User.objects.all()[:6])
        if not users:
            self.stderr.write(self.style.ERROR('No users — run create_sample_posts first.'))
            return

        created = 0
        for i, spec in enumerate(SAMPLE_COMMUNITIES):
            creator = users[i % len(users)]
            community = Community.objects.create(creator=creator, **spec)

            # Creator is always an approved member + moderator.
            CommunityMembership.objects.get_or_create(
                community=community, user=creator,
                defaults={'is_moderator': True, 'status': 'approved'},
            )
            # A handful of the other seeded users join too, staggered so
            # trending (recent joins) has something real to sort by.
            members = [u for u in users if u.id != creator.id][:1 + (i % len(users))]
            for member in members:
                CommunityMembership.objects.get_or_create(
                    community=community, user=member,
                    defaults={'status': 'approved'},
                )

            community.members_count = community.memberships.filter(status='approved').count()
            community.save(update_fields=['members_count'])
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created} sample communities.'))
