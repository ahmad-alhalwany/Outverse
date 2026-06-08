from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('moderation', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='flaggedcontent',
            name='type',
            field=models.CharField(
                choices=[
                    ('post', 'Post'),
                    ('comment', 'Comment'),
                    ('reel', 'Reel'),
                    ('reel_comment', 'Reel comment'),
                ],
                max_length=20,
            ),
        ),
    ]
