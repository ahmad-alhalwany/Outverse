import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Reel',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('video', models.FileField(upload_to='reels/')),
                ('caption', models.TextField(blank=True)),
                ('mood', models.CharField(choices=[('cosmic', 'Cosmic'), ('pulse', 'Pulse'), ('void', 'Void'), ('spark', 'Spark'), ('dream', 'Dream')], default='cosmic', max_length=20)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('sound_label', models.CharField(blank=True, default='Original signal', max_length=120)),
                ('duration_seconds', models.PositiveIntegerField(default=0)),
                ('views', models.PositiveIntegerField(default=0)),
                ('likes_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reels', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='ReelLike',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('reel', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='likes', to='reels.reel')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reel_likes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('user', 'reel')},
            },
        ),
    ]
