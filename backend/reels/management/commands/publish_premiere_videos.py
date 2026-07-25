from django.core.management.base import BaseCommand
from django.utils import timezone

from reels.models import LongFormVideo


class Command(BaseCommand):
    """Publishes long-form premieres whose scheduled time has passed."""

    help = 'Publish scheduled long-form premiere videos whose premiere_at has passed.'

    def handle(self, *args, **options):
        now = timezone.now()
        published = LongFormVideo.objects.filter(
            status='scheduled',
            premiere_at__lte=now,
        ).update(
            status='published',
            published_at=now,
            updated_at=now,
        )
        self.stdout.write(self.style.SUCCESS(f'Published {published} premiere videos.'))
