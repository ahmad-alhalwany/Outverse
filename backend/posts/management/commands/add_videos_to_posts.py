from django.core.management.base import BaseCommand
from posts.models import Post, PostVideo
from django.core.files.base import ContentFile
import requests
import os

VIDEO_URLS = [
    'https://samplelib.com/mp4/sample-5s.mp4',
    'https://samplelib.com/mp4/sample-3s.mp4',
    'https://filesamples.com/samples/video/mp4/sample_640x360.mp4',
]

class Command(BaseCommand):
    help = 'Add multiple videos to each existing post (for testing)'

    def download_file(self, url, name):
        response = requests.get(url)
        if response.status_code == 200:
            ext = os.path.splitext(url)[1] or '.mp4'
            return ContentFile(response.content, name=f'{name}{ext}')
        return None

    def handle(self, *args, **options):
        posts = Post.objects.all()
        for post in posts:
            for idx, url in enumerate(VIDEO_URLS[:2]):  # أضف 2 فيديو لكل بوست
                vid_file = self.download_file(url, f'post_{post.id}_vid_{idx+1}')
                if vid_file:
                    PostVideo.objects.create(post=post, video=vid_file)
            self.stdout.write(self.style.SUCCESS(f'Added videos to post {post.id}'))
        self.stdout.write(self.style.SUCCESS('Successfully added videos to all posts')) 