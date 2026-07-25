from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0019_media_alt_edit_history'),
    ]

    operations = [
        migrations.AddField(
            model_name='comment',
            name='edited_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='comment',
            name='quoted_comment',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='quotes',
                to='posts.comment',
            ),
        ),
        migrations.AddField(
            model_name='comment',
            name='is_pinned',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='comment',
            name='sparked_by_author',
            field=models.BooleanField(default=False),
        ),
    ]
