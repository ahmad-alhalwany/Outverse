from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('moderation', '0006_contentappeal'),
    ]

    operations = [
        migrations.AlterField(
            model_name='flaggedcontent',
            name='type',
            field=models.CharField(
                choices=[
                    ('post', 'Post'),
                    ('comment', 'Comment'),
                    ('reel', 'Reel'),
                    ('reel_comment', 'Reel comment'),
                    ('story', 'Story'),
                    ('live_chat', 'Live chat message'),
                    ('chat_message', 'Direct chat message'),
                    ('room_message', 'Room chat message'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='contentappeal',
            name='content_type',
            field=models.CharField(
                choices=[
                    ('post', 'Post'),
                    ('comment', 'Comment'),
                    ('reel', 'Reel'),
                    ('reel_comment', 'Reel comment'),
                    ('story', 'Story'),
                    ('live_chat', 'Live chat message'),
                    ('chat_message', 'Direct chat message'),
                    ('room_message', 'Room chat message'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
    ]
