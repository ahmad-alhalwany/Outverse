from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from stories.models import Story
from django.core.files.base import ContentFile
import requests
import os

User = get_user_model()

class Command(BaseCommand):
    help = 'Create sample stories for testing (with media)'

    def download_file(self, url):
        response = requests.get(url)
        if response.status_code == 200:
            return ContentFile(response.content)
        return None

    def handle(self, *args, **options):
        users = list(User.objects.all())
        if not users:
            self.stdout.write(self.style.ERROR('No users found. Please create users first.'))
            return

        stories_data = [
            {
                'user': users[0],
                'text': 'رحلتي إلى الفضاء كانت مذهلة! شاهدوا هذه الصورة من محطة الفضاء الدولية.',
                'image_url': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80',
                'video_url': None,
                'is_active': True,
            },
            {
                'user': users[-1],
                'text': 'تجربة رسم كوني جديد اليوم ✨🪐',
                'image_url': None,
                'video_url': 'https://samplelib.com/mp4/sample-5s.mp4',
                'is_active': True,
            },
            {
                'user': users[0],
                'text': 'فيديو قصير عن تحدي اليوم في الإبداع.',
                'image_url': None,
                'video_url': 'https://samplelib.com/mp4/sample-3s.mp4',
                'is_active': True,
            },
        ]

        for idx, story_data in enumerate(stories_data):
            story, created = Story.objects.get_or_create(
                user=story_data['user'],
                text=story_data['text'],
                defaults={
                    'is_active': story_data['is_active'],
                }
            )
            updated = False
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created story: {story.user.username} - {story.text[:30]}...'))
            # إضافة صورة إذا وجدت
            if story_data['image_url']:
                img_file = self.download_file(story_data['image_url'])
                if img_file:
                    story.image.save(f'story_{idx+1}.jpg', img_file, save=True)
                    updated = True
            # إضافة فيديو إذا وجد
            if story_data['video_url']:
                vid_file = self.download_file(story_data['video_url'])
                if vid_file:
                    ext = os.path.splitext(story_data['video_url'])[1] or '.mp4'
                    story.video.save(f'story_{idx+1}{ext}', vid_file, save=True)
                    updated = True
            if updated:
                self.stdout.write(self.style.SUCCESS(f'Added media to story: {story.user.username}'))
        self.stdout.write(self.style.SUCCESS('Successfully created sample stories with media')) 