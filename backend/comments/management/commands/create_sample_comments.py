from django.core.management.base import BaseCommand
from comments.models import Comment, CommentReaction
from posts.models import Post
from users.models import User
import random

class Command(BaseCommand):
    help = 'Create sample comments for testing'

    def handle(self, *args, **options):
        # الحصول على المستخدمين والمنشورات الموجودة
        users = list(User.objects.all())
        posts = list(Post.objects.all())
        
        if not users or not posts:
            self.stdout.write(self.style.ERROR('No users or posts found. Please create some first.'))
            return

        # بيانات التعليقات التجريبية
        sample_comments = [
            "مشاركة رائعة! 🌟",
            "أحب هذا المحتوى كثيراً ❤️",
            "معلومات مفيدة جداً 👍",
            "أريد المزيد من هذا النوع من المحتوى",
            "رائع! شكراً للمشاركة",
            "هذا يذكرني بتجربة مماثلة",
            "أفكار ممتازة! 👏",
            "أحتاج لمزيد من التفاصيل حول هذا",
            "مشاركة قيمة جداً",
            "أحب الطريقة التي تقدم بها المعلومات",
            "هذا يفتح آفاقاً جديدة للتفكير",
            "محتوى عالي الجودة",
            "أريد أن أشارك هذا مع أصدقائي",
            "هذا يلهمني كثيراً ✨",
            "أحتاج لمعرفة المزيد عن هذا الموضوع",
        ]

        # GIFs تجريبية
        sample_gifs = [
            'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
            'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
            'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
            'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
            'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
        ]

        # Stickers تجريبية
        sample_stickers = [
            '/stickers/sticker1.png',
            '/stickers/sticker2.png',
            '/stickers/sticker3.png',
        ]

        # خلفيات مخصصة
        custom_styles = [
            {'background': '#ffeb3b'},
            {'background': '#e91e63'},
            {'background': '#9c27b0'},
            {'background': '#2196f3'},
            {'background': '#4caf50'},
        ]

        comments_created = 0
        reactions_created = 0

        for post in posts:
            # إنشاء 3-8 تعليقات لكل منشور
            num_comments = random.randint(3, 8)
            
            for i in range(num_comments):
                user = random.choice(users)
                text = random.choice(sample_comments)
                
                # إضافة GIF أو Sticker أو خلفية مخصصة بشكل عشوائي
                gif_url = random.choice(sample_gifs) if random.random() < 0.3 else None
                sticker_url = random.choice(sample_stickers) if random.random() < 0.2 else None
                custom_style = random.choice(custom_styles) if random.random() < 0.15 else {}
                
                comment = Comment.objects.create(
                    post=post,
                    user=user,
                    text=text,
                    gif_url=gif_url,
                    sticker_url=sticker_url,
                    custom_style=custom_style
                )
                comments_created += 1

                # إنشاء ردود على بعض التعليقات
                if random.random() < 0.4:  # 40% من التعليقات سيكون لها ردود
                    num_replies = random.randint(1, 3)
                    for j in range(num_replies):
                        reply_user = random.choice(users)
                        reply_text = random.choice(sample_comments)
                        
                        reply = Comment.objects.create(
                            post=post,
                            user=reply_user,
                            parent=comment,
                            text=reply_text,
                            gif_url=random.choice(sample_gifs) if random.random() < 0.2 else None,
                            sticker_url=random.choice(sample_stickers) if random.random() < 0.1 else None,
                        )
                        comments_created += 1

                        # إضافة تفاعلات للردود
                        if random.random() < 0.6:
                            reaction_user = random.choice(users)
                            reaction = random.choice(['👍', '❤️', '😂', '😮', '😢', '😡'])
                            CommentReaction.objects.get_or_create(
                                comment=reply,
                                user=reaction_user,
                                defaults={'reaction': reaction}
                            )
                            reactions_created += 1

                # إضافة تفاعلات للتعليقات الرئيسية
                if random.random() < 0.7:  # 70% من التعليقات سيكون لها تفاعلات
                    num_reactions = random.randint(1, 5)
                    reaction_users = random.sample(users, min(num_reactions, len(users)))
                    for reaction_user in reaction_users:
                        reaction = random.choice(['👍', '❤️', '😂', '😮', '😢', '😡'])
                        CommentReaction.objects.get_or_create(
                            comment=comment,
                            user=reaction_user,
                            defaults={'reaction': reaction}
                        )
                        reactions_created += 1

                # تثبيت بعض التعليقات
                if random.random() < 0.1:  # 10% من التعليقات ستكون مثبتة
                    comment.is_pinned = True
                    comment.save()

        # تحديث عدد التعليقات في المنشورات
        for post in posts:
            post.comments_count = post.comments.count()
            post.save()

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {comments_created} comments and {reactions_created} reactions'
            )
        )
