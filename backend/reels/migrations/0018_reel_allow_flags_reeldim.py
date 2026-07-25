# Generated manually for Pulse Pack

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('reels', '0017_livesession_slowmode_chat_bans'),
    ]

    operations = [
        migrations.AddField(
            model_name='reel',
            name='allow_download',
            field=models.BooleanField(
                default=False,
                help_text='Allow others to export / download this signal',
            ),
        ),
        migrations.AddField(
            model_name='reel',
            name='allow_remix',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='reel',
            name='allow_weave',
            field=models.BooleanField(
                default=True,
                help_text='Allow Weave (stitch) derivatives of this signal',
            ),
        ),
        migrations.CreateModel(
            name='ReelDim',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('reel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dimmed_by', to='reels.reel')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='dimmed_reels', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
                'unique_together': {('user', 'reel')},
            },
        ),
    ]
