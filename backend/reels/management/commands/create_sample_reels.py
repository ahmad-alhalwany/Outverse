from pathlib import Path

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand

from reels.models import Reel

User = get_user_model()

SAMPLE_VIDEO_URL = 'https://samplelib.com/mp4/sample-5s.mp4'


class Command(BaseCommand):
    help = 'Create sample cosmic reels from existing post/story videos if present'

    def _video_source(self, base: Path):
        candidates = [
            base / 'posts' / 'videos' / 'post_1_vid_1.mp4',
            base / 'posts' / 'media' / 'post_1_media_2.mp4',
            base / 'media' / 'stories' / 'story_2.mp4',
            base / 'stories' / 'story_2.mp4',
        ]
        for path in candidates:
            if path.exists():
                return path
        for story in __import__('stories.models', fromlist=['Story']).Story.objects.all():
            if story.video and story.video.name:
                media_path = Path(settings.MEDIA_ROOT) / story.video.name
                if media_path.exists():
                    return media_path
        try:
            resp = requests.get(SAMPLE_VIDEO_URL, timeout=30)
            if resp.status_code == 200:
                cache = base / 'media' / 'reels' / '_sample_seed.mp4'
                cache.parent.mkdir(parents=True, exist_ok=True)
                cache.write_bytes(resp.content)
                return cache
        except requests.RequestException:
            pass
        return None

    def handle(self, *args, **options):
        user = User.objects.first()
        if not user:
            self.stdout.write(self.style.ERROR('No users in database.'))
            return

        base = Path(settings.BASE_DIR)

        samples = [
            {
                'caption': 'Signal drift through the nebula 🌌',
                'mood': 'cosmic',
                'filter_style': 'cosmic',
                'tags': ['cosmic', 'void', 'signal'],
                'sound_label': 'Nebula pulse · Outverse',
                'is_featured': True,
            },
            {
                'caption': 'When the verse glitches, lean in ✨',
                'mood': 'spark',
                'filter_style': 'glitch',
                'tags': ['glitch', 'spark'],
                'sound_label': 'Warp static',
                'is_featured': True,
            },
            {
                'caption': 'Dream loop — 15 seconds of elsewhere',
                'mood': 'dream',
                'filter_style': 'dream',
                'tags': ['dream', 'loop'],
                'sound_label': 'Lucid orbit',
            },
        ]

        created = 0
        for idx, meta in enumerate(samples):
            src = self._video_source(base)
            if not src:
                self.stdout.write(self.style.WARNING('No sample video available.'))
                break
            if Reel.objects.filter(caption=meta['caption']).exists():
                continue
            reel = Reel(user=user, **meta)
            with open(src, 'rb') as fh:
                reel.video.save(f'reel_sample_{idx + 1}.mp4', File(fh), save=True)
            created += 1

        self.stdout.write(self.style.SUCCESS(f'Created {created} sample reel(s).'))
