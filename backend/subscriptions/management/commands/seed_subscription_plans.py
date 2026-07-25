from django.core.management.base import BaseCommand

from subscriptions.models import SubscriptionPlan

PLANS = [
    {
        'tier': 'nova',
        'name': 'Nova',
        'price_usd_cents': 999,
        'features': [
            'Golden Mood Constellations',
            'Ad-free browsing',
            'Priority support',
        ],
        'is_recommended': False,
    },
    {
        'tier': 'supernova',
        'name': 'Supernova',
        'price_usd_cents': 1999,
        'features': [
            'Everything in Nova',
            'Diamond Bottles',
            'Priority Story Placement',
            'Exclusive Cosmic Pass badge',
        ],
        'is_recommended': True,
    },
    {
        'tier': 'galaxy',
        'name': 'Galaxy',
        'price_usd_cents': 2999,
        'features': [
            'Everything in Supernova',
            'Early access to new worlds',
            'Monthly bonus coins',
        ],
        'is_recommended': False,
    },
]


class Command(BaseCommand):
    help = 'Seed the three Cosmic Pass subscription tiers.'

    def handle(self, *args, **options):
        created = 0
        for spec in PLANS:
            _, was_created = SubscriptionPlan.objects.get_or_create(tier=spec['tier'], defaults=spec)
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f'Subscription plans ready ({created} new).'))
