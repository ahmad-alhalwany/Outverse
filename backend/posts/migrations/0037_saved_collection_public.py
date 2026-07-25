from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0036_scheduled_media'),
    ]

    operations = [
        migrations.AddField(
            model_name='savedcollection',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='savedcollection',
            name='is_public',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='savedcollection',
            name='cover_url',
            field=models.URLField(blank=True),
        ),
    ]
