import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

import bottles.models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('bottles', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='messagebottle',
            options={'ordering': ['-created_at']},
        ),
        migrations.AlterField(
            model_name='messagebottle',
            name='emotion_type',
            field=models.CharField(
                choices=[
                    ('joy', 'Joy'),
                    ('hope', 'Hope'),
                    ('calm', 'Calm'),
                    ('love', 'Love'),
                    ('sad', 'Sadness'),
                    ('lonely', 'Loneliness'),
                    ('anxious', 'Anxiety'),
                    ('nostalgic', 'Nostalgia'),
                    ('mystery', 'Mystery'),
                ],
                default='mystery',
                max_length=50,
            ),
        ),
        migrations.AlterField(
            model_name='messagebottle',
            name='location_lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='messagebottle',
            name='location_lng',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='messagebottle',
            name='expiry_time',
            field=models.DateTimeField(default=bottles.models.default_expiry_time),
        ),
        migrations.AddField(
            model_name='messagebottle',
            name='caught_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='caught_bottles',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='messagebottle',
            name='caught_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
