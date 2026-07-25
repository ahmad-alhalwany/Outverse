from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0006_idea_tags'),
        ('notifications', '0009_share_logs'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='idea',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='+',
                to='ideas.idea',
            ),
        ),
        migrations.AlterField(
            model_name='notification',
            name='verb',
            field=models.CharField(
                choices=[
                    ('reaction', 'Reaction'),
                    ('comment', 'Comment'),
                    ('follow', 'Follow'),
                    ('shop_purchase', 'Shop Purchase'),
                    ('challenge_complete', 'Challenge Complete'),
                    ('moderation_action', 'Moderation Action'),
                    ('chat_message', 'Chat Message'),
                    ('achievement_unlocked', 'Achievement Unlocked'),
                    ('mention', 'Mention'),
                    ('share', 'Share'),
                    ('idea_pledge', 'Idea Pledge'),
                    ('idea_comment', 'Idea Comment'),
                    ('idea_apply', 'Idea Apply'),
                    ('idea_accepted', 'Idea Accepted'),
                    ('idea_rejected', 'Idea Rejected'),
                ],
                max_length=20,
            ),
        ),
    ]
