from django.conf import settings
from django.db import migrations, models

import outverse.upload_validators


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_profile_cover_photo'),
    ]

    operations = [
        migrations.CreateModel(
            name='TimeCapsule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('voice', models.FileField(
                    blank=True,
                    null=True,
                    upload_to='capsules/voice/',
                    validators=[outverse.upload_validators.validate_audio_upload],
                )),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('open_at', models.DateTimeField(db_index=True)),
                ('opened_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='time_capsules',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
