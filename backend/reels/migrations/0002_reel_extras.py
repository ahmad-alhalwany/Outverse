import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reels', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ReelMusicTrack',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=64, unique=True)),
                ('title', models.CharField(max_length=120)),
                ('artist_label', models.CharField(blank=True, default='Outverse', max_length=120)),
                ('audio_file', models.FileField(blank=True, null=True, upload_to='reels/music/')),
                ('source_path', models.CharField(blank=True, help_text='Static path e.g. /sounds/chime.mp3 when no uploaded file', max_length=255)),
                ('mood', models.CharField(blank=True, default='cosmic', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(default=0)),
            ],
            options={
                'ordering': ['order', 'title'],
            },
        ),
        migrations.AddField(
            model_name='reel',
            name='comments_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='reel',
            name='custom_audio',
            field=models.FileField(blank=True, null=True, upload_to='reels/audio/'),
        ),
        migrations.AddField(
            model_name='reel',
            name='filter_style',
            field=models.CharField(choices=[('none', 'None'), ('cosmic', 'Cosmic Glow'), ('glitch', 'Glitch'), ('vintage', 'Vintage'), ('neon', 'Neon'), ('void', 'Void'), ('dream', 'Dream'), ('pulse', 'Pulse')], default='none', max_length=20),
        ),
        migrations.AddField(
            model_name='reel',
            name='is_featured',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='reel',
            name='music_track',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reels', to='reels.reelmusictrack'),
        ),
        migrations.CreateModel(
            name='ReelComment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField(blank=True)),
                ('gif_url', models.URLField(blank=True, max_length=500)),
                ('sticker_url', models.URLField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('parent', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='replies', to='reels.reelcomment')),
                ('reel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comments', to='reels.reel')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reel_comments', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['created_at'],
            },
        ),
    ]
