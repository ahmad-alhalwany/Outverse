from django.db import migrations, models


class Migration(migrations.Migration):
    """Sync ContentAppeal.content_type choices with FlaggedContent (adds bottle)."""

    dependencies = [
        ('moderation', '0009_flaggedcontent_bottle_type'),
    ]

    operations = [
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
                    ('bottle', 'Emotion bottle'),
                ],
                db_index=True,
                max_length=20,
            ),
        ),
    ]
