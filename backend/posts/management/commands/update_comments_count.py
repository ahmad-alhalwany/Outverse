from django.core.management.base import BaseCommand
from posts.models import Post

class Command(BaseCommand):
    help = 'Update comments count for all posts'

    def handle(self, *args, **options):
        posts = Post.objects.all()
        updated_count = 0
        
        for post in posts:
            old_count = post.comments_count
            post.update_comments_count()
            if post.comments_count != old_count:
                updated_count += 1
                self.stdout.write(f'Updated post {post.id}: {old_count} -> {post.comments_count}')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully updated comments count for {updated_count} posts'
            )
        )
