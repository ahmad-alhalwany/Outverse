from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0031_post_is_active_comment_soft_delete'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='flair',
            field=models.CharField(blank=True, default='', max_length=40),
        ),
    ]
