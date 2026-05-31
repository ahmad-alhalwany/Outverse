from django.core.management.base import BaseCommand
from posts.models import Post, PostImage
from django.core.files.base import ContentFile
import requests
import os

IMAGE_URLS = [
    'https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1519125323398-675f0ddb6308?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1465101178521-c3a6088ed0c4?auto=format&fit=crop&w=800&q=80',
]

class Command(BaseCommand):
    help = 'Add multiple images to each existing post (for testing)'

    def download_file(self, url, name):
        response = requests.get(url)
        if response.status_code == 200:
            ext = os.path.splitext(url)[1] or '.jpg'
            return ContentFile(response.content, name=f'{name}{ext}')
        return None

    def handle(self, *args, **options):
        posts = Post.objects.all()
        for post in posts:
            for idx, url in enumerate(IMAGE_URLS[:3]):  # أضف 3 صور لكل بوست
                img_file = self.download_file(url, f'post_{post.id}_img_{idx+1}')
                if img_file:
                    PostImage.objects.create(post=post, image=img_file)
            self.stdout.write(self.style.SUCCESS(f'Added images to post {post.id}'))
        self.stdout.write(self.style.SUCCESS('Successfully added images to all posts')) 