from django.core.management.base import BaseCommand
from posts.models import Post, PostMedia
from django.core.files.base import ContentFile
import requests
import os

MEDIA_DATA = [
    # (url, type)
    ('https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80', 'image'),
    ('https://samplelib.com/mp4/sample-5s.mp4', 'video'),
    ('https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80', 'image'),
    ('https://samplelib.com/mp4/sample-3s.mp4', 'video'),
    ('https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80', 'image'),
]

class Command(BaseCommand):
    help = 'Add multiple media (images/videos) to each existing post (for testing)'

    def download_file(self, url, name):
        response = requests.get(url)
        if response.status_code == 200:
            ext = os.path.splitext(url)[1] or ('.mp4' if 'mp4' in url else '.jpg')
            return ContentFile(response.content, name=f'{name}{ext}')
        return None

    def handle(self, *args, **options):
        posts = Post.objects.all()
        for post in posts:
            for idx, (url, media_type) in enumerate(MEDIA_DATA):
                media_file = self.download_file(url, f'post_{post.id}_media_{idx+1}')
                if media_file:
                    PostMedia.objects.create(
                        post=post,
                        media_file=media_file,
                        media_type=media_type,
                        order=idx
                    )
            self.stdout.write(self.style.SUCCESS(f'Added media to post {post.id}'))
        self.stdout.write(self.style.SUCCESS('Successfully added media to all posts')) 