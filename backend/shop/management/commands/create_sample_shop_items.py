from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from shop.models import ShopItem

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample products for the Madness Shop'

    def handle(self, *args, **options):
        creator = User.objects.first()

        items = [
            {
                'name': 'Cosmic Avatar Frame',
                'description': 'A glowing nebula frame for your profile picture.',
                'price': 120,
                'type': 'digital',
                'category': 'design',
                'cover_url': 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=800&q=80',
                'rating': 4.8,
                'sales_count': 342,
                'is_featured': True,
            },
            {
                'name': 'Story Framework Bundle',
                'description': 'A complete collection of storytelling templates.',
                'price': 250,
                'type': 'digital',
                'category': 'template',
                'cover_url': 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
                'rating': 4.9,
                'sales_count': 510,
                'is_featured': True,
            },
            {
                'name': 'Neon Reaction Effects',
                'description': 'Animated reaction effects that burst across the screen.',
                'price': 90,
                'type': 'digital',
                'category': 'effect',
                'cover_url': 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80',
                'rating': 4.6,
                'sales_count': 198,
                'is_featured': False,
            },
            {
                'name': 'Vintage Emotion Print',
                'description': 'Turn your mood into a 1920s telegram, printed on aged paper.',
                'price': 400,
                'type': 'physical',
                'category': 'art',
                'cover_url': 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?auto=format&fit=crop&w=800&q=80',
                'rating': 4.7,
                'sales_count': 73,
                'is_featured': True,
            },
            {
                'name': 'Lo-Fi Cosmic Beats',
                'description': 'A pack of ambient melodies for your stories and posts.',
                'price': 150,
                'type': 'digital',
                'category': 'music',
                'cover_url': 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
                'rating': 4.5,
                'sales_count': 264,
                'is_featured': False,
            },
            {
                'name': 'Custom Fictional Bio',
                'description': 'A poetic, fictional life story written just for you.',
                'price': 300,
                'type': 'digital',
                'category': 'story',
                'cover_url': 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80',
                'rating': 5.0,
                'sales_count': 41,
                'is_featured': False,
            },
            {
                'name': 'Galaxy Sticker Pack',
                'description': 'Physical holographic stickers shipped to your door.',
                'price': 200,
                'type': 'physical',
                'category': 'art',
                'cover_url': 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=800&q=80',
                'rating': 4.4,
                'sales_count': 156,
                'is_featured': False,
            },
            {
                'name': 'Dark Matter UI Theme',
                'description': 'A premium cosmic dark theme for your Outverse profile.',
                'price': 180,
                'type': 'digital',
                'category': 'design',
                'cover_url': 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=800&q=80',
                'rating': 4.8,
                'sales_count': 389,
                'is_featured': True,
            },
        ]

        for data in items:
            obj, created = ShopItem.objects.get_or_create(
                name=data['name'],
                defaults={**data, 'creator': creator, 'is_available': True},
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created shop item: {obj.name}')
                )

        self.stdout.write(
            self.style.SUCCESS('Successfully created sample shop items')
        )
