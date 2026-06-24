from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='UserPreferences',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('locale', models.CharField(choices=[('en', 'English'), ('ar', 'Arabic')], default='en', max_length=2)),
                ('theme', models.CharField(choices=[('light', 'Light'), ('dark', 'Dark')], default='light', max_length=10)),
                ('vault_map_style', models.CharField(default='street', max_length=32)),
                ('notification_prefs', models.JSONField(blank=True, default=dict)),
                ('profile_visibility', models.CharField(choices=[('public', 'Public'), ('followers', 'Followers'), ('private', 'Private')], default='public', max_length=16)),
                ('bottle_privacy', models.CharField(choices=[('map_only', 'Map only'), ('catch_only', 'Catch only'), ('private', 'Private')], default='map_only', max_length=16)),
                ('online_status_visible', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='preferences', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['user_id'],
            },
        ),
    ]
