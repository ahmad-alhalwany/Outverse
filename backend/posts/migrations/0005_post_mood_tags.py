from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0004_remove_postvideo_post_postmedia_delete_postimage_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='mood',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='post',
            name='tags',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterModelOptions(
            name='post',
            options={'ordering': ['-created_at']},
        ),
    ]
