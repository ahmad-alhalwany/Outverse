from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0016_post_polls_questions'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='reposts_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='post',
            name='repost_of',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='reposts',
                to='posts.post',
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='post',
            name='thread_root',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='thread_members',
                to='posts.post',
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='post',
            name='thread_seq',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
