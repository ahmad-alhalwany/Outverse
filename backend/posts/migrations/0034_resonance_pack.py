import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0033_signal_pack'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='is_spoiler',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='post',
            name='is_community_pinned',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='post',
            name='community_pinned_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='post',
            name='crosspost_of',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='crossposts',
                to='posts.post',
            ),
        ),
    ]
