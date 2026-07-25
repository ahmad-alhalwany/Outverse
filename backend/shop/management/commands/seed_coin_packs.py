from django.core.management.base import BaseCommand

from shop.models import CoinPack


DEFAULT_PACKS = [
    {
        'name': 'Starter Pack',
        'coins': 100,
        'price_usd_cents': 99,
        'sort_order': 1,
    },
    {
        'name': 'Explorer Pack',
        'coins': 500,
        'price_usd_cents': 399,
        'sort_order': 2,
    },
    {
        'name': 'Creator Pack',
        'coins': 1200,
        'price_usd_cents': 799,
        'sort_order': 3,
    },
    {
        'name': 'Visionary Pack',
        'coins': 3000,
        'price_usd_cents': 1799,
        'sort_order': 4,
    },
]


class Command(BaseCommand):
    help = 'Create default CoinPack rows if they do not already exist.'

    def handle(self, *args, **options):
        created_count = 0
        for pack_data in DEFAULT_PACKS:
            pack, created = CoinPack.objects.get_or_create(
                name=pack_data['name'],
                defaults={
                    'coins': pack_data['coins'],
                    'price_usd_cents': pack_data['price_usd_cents'],
                    'stripe_price_id': '',
                    'is_active': True,
                    'sort_order': pack_data['sort_order'],
                },
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Created: {pack.name} — {pack.coins} coins @ "
                        f"${pack.price_usd_cents / 100:.2f} "
                        f"(stripe_price_id: empty placeholder)"
                    )
                )
            else:
                self.stdout.write(f"  Already exists: {pack.name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone. {created_count}/{len(DEFAULT_PACKS)} coin pack(s) created.\n"
                f"Set stripe_price_id on each pack once you have created the prices in "
                f"your Stripe Dashboard (https://dashboard.stripe.com/products)."
            )
        )
