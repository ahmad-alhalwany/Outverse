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
            name='Story',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('premise', models.TextField(help_text='The opening line that starts the story')),
                ('cover_url', models.URLField(blank=True)),
                ('genre', models.CharField(choices=[('fantasy', 'Fantasy'), ('scifi', 'Sci-Fi'), ('mystery', 'Mystery'), ('romance', 'Romance'), ('horror', 'Horror'), ('adventure', 'Adventure'), ('absurd', 'Absurd'), ('other', 'Other')], default='other', max_length=20)),
                ('status', models.CharField(choices=[('open', 'Open'), ('completed', 'Completed')], default='open', max_length=20)),
                ('max_segments', models.PositiveIntegerField(default=10)),
                ('is_featured', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('owner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='owned_stories', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-updated_at'],
            },
        ),
        migrations.CreateModel(
            name='Segment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('content', models.TextField()),
                ('order', models.PositiveIntegerField(default=0)),
                ('votes', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('author', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='story_segments', to=settings.AUTH_USER_MODEL)),
                ('story', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='segments', to='narratives.story')),
            ],
            options={
                'ordering': ['order', 'created_at'],
            },
        ),
    ]
