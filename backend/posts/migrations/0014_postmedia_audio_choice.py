from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0013_alter_comment_created_at_alter_post_created_at_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='postmedia',
            name='media_type',
            field=models.CharField(
                choices=[
                    ('image', 'Image'),
                    ('video', 'Video'),
                    ('audio', 'Audio'),
                ],
                max_length=10,
            ),
        ),
    ]
