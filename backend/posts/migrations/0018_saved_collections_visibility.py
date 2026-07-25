from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0017_post_repost_thread'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='visibility',
            field=models.CharField(
                choices=[('public', 'Public'), ('followers', 'Followers')],
                default='public',
                db_index=True,
                max_length=12,
            ),
        ),
        migrations.AddField(
            model_name='post',
            name='reply_control',
            field=models.CharField(
                choices=[
                    ('everyone', 'Everyone'),
                    ('followers', 'Followers'),
                    ('nobody', 'No one'),
                ],
                default='everyone',
                max_length=12,
            ),
        ),
        migrations.CreateModel(
            name='SavedCollection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=60)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='saved_collections', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['name'],
                'unique_together': {('user', 'name')},
            },
        ),
        migrations.AddField(
            model_name='savedpost',
            name='collection',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='items',
                to='posts.savedcollection',
            ),
        ),
    ]
