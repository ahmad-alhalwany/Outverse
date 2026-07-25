# Generated manually for ReelLike.type field

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reels', '0010_share_logs'),
    ]

    operations = [
        migrations.AddField(
            model_name='reellike',
            name='type',
            field=models.CharField(
                choices=[
                    ('inspired', 'Inspired'),
                    ('cosmic', 'Cosmic'),
                    ('mindbending', 'Mind-Bending'),
                    ('growing', 'Growing'),
                    ('spark', 'Spark'),
                ],
                default='spark',
                max_length=20,
            ),
        ),
    ]
