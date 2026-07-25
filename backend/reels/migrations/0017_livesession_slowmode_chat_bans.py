from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('reels', '0016_reel_inspiration_attribution'),
    ]

    operations = [
        migrations.AddField(
            model_name='livesession',
            name='slowmode_seconds',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='livesession',
            name='chat_banned_users',
            field=models.ManyToManyField(
                blank=True,
                related_name='live_chat_bans',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
