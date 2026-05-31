from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from posts.models import Post
from datetime import datetime, timedelta
import random

User = get_user_model()

class Command(BaseCommand):
    help = 'Create sample posts for testing'

    def handle(self, *args, **options):
        # Create sample users if they don't exist
        users_data = [
            {'username': 'sarah_mitchell', 'first_name': 'Sarah', 'last_name': 'Mitchell'},
            {'username': 'david_chen', 'first_name': 'David', 'last_name': 'Chen'},
            {'username': 'elena_rodriguez', 'first_name': 'Elena', 'last_name': 'Rodriguez'},
        ]
        
        users = []
        for user_data in users_data:
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                defaults={
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'email': f"{user_data['username']}@example.com",
                }
            )
            if created:
                user.set_password('password123')
                user.save()
            users.append(user)
        
        # Sample posts data
        posts_data = [
            {
                'user': users[0],
                'text': 'Just finished my latest digital art piece exploring the concept of dreams and reality. What do you think?',
                'views': 234,
                'comments_count': 45,
                'likes_count': 12,
            },
            {
                'user': users[1],
                'text': "Working on a new story about a world where creativity is the main currency. Here's a snippet of the first chapter.",
                'views': 156,
                'comments_count': 28,
                'likes_count': 7,
            },
            {
                'user': users[2],
                'text': "Sketched this during today's creative challenge. The theme was 'Future Cities'",
                'views': 342,
                'comments_count': 67,
                'likes_count': 21,
            },
        ]
        
        # Create posts
        for post_data in posts_data:
            post, created = Post.objects.get_or_create(
                user=post_data['user'],
                text=post_data['text'],
                defaults={
                    'views': post_data['views'],
                    'comments_count': post_data['comments_count'],
                    'likes_count': post_data['likes_count'],
                }
            )
            if created:
                self.stdout.write(
                    self.style.SUCCESS(f'Created post: {post.user.username} - {post.text[:30]}...')
                )
        
        self.stdout.write(
            self.style.SUCCESS('Successfully created sample posts')
        ) 