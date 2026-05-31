from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('challenges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='challenge',
            name='description',
            field=models.TextField(blank=True, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='challenge',
            name='cover_url',
            field=models.URLField(blank=True, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='challenge',
            name='is_daily',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='challenge',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='challenge',
            name='type',
            field=models.CharField(
                choices=[
                    ('writing', 'Writing'),
                    ('art', 'Art'),
                    ('music', 'Music'),
                    ('experimental', 'Experimental'),
                    ('practical', 'Practical'),
                ],
                default='writing',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='challenge',
            name='difficulty',
            field=models.CharField(default='medium', max_length=50),
        ),
        migrations.AlterModelOptions(
            name='challenge',
            options={'ordering': ['-created_at']},
        ),
        migrations.AlterModelOptions(
            name='submission',
            options={'ordering': ['-submitted_at']},
        ),
    ]
