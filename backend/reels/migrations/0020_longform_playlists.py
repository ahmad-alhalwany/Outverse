import django.db.models.deletion
import outverse.upload_validators
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reels', '0019_pulse_intelligence'),
        ('subscriptions', '0003_creatorsubscriptionpayout'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LongFormVideo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('video', models.FileField(upload_to='videos/longform/', validators=[outverse.upload_validators.validate_video_upload])),
                ('thumbnail', models.ImageField(blank=True, null=True, upload_to='videos/longform/thumbnails/', validators=[outverse.upload_validators.validate_image_upload])),
                ('duration_seconds', models.PositiveIntegerField(default=0)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('scheduled', 'Scheduled'), ('published', 'Published')], db_index=True, default='draft', max_length=12)),
                ('premiere_at', models.DateTimeField(blank=True, null=True)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('visibility', models.CharField(choices=[('public', 'Public'), ('followers', 'Followers'), ('subscribers', 'Subscribers')], db_index=True, default='public', max_length=12)),
                ('views', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('required_tier', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='gated_longform_videos', to='subscriptions.creatortier')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='longform_videos', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='VideoPlaylist',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=120)),
                ('description', models.TextField(blank=True)),
                ('is_public', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='video_playlists', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='VideoChapter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=120)),
                ('start_seconds', models.PositiveIntegerField()),
                ('order', models.PositiveIntegerField(default=0)),
                ('video', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='chapters', to='reels.longformvideo')),
            ],
            options={
                'ordering': ['order', 'start_seconds', 'id'],
            },
        ),
        migrations.CreateModel(
            name='VideoPlaylistItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField(default=0)),
                ('playlist', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='reels.videoplaylist')),
                ('video', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='playlist_items', to='reels.longformvideo')),
            ],
            options={
                'ordering': ['order', 'id'],
                'unique_together': {('playlist', 'video')},
            },
        ),
    ]
