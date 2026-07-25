from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_pins_forward(apps, schema_editor):
    Comment = apps.get_model('posts', 'Comment')
    order = 1
    for comment in Comment.objects.filter(is_pinned=True).order_by('created_at'):
        comment.pin_order = order
        comment.save(update_fields=['pin_order'])
        order += 1


def migrate_pins_backward(apps, schema_editor):
    Comment = apps.get_model('posts', 'Comment')
    Comment.objects.filter(pin_order__isnull=False).update(is_pinned=True)
    Comment.objects.filter(pin_order__isnull=True).update(is_pinned=False)


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0020_comment_enhancements'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='comment',
            name='pin_order',
            field=models.PositiveSmallIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.RunPython(migrate_pins_forward, migrate_pins_backward),
        migrations.RemoveField(
            model_name='comment',
            name='is_pinned',
        ),
        migrations.CreateModel(
            name='CommentVote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.SmallIntegerField(choices=[(1, 'boost'), (-1, 'dim')])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='votes', to='posts.comment')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comment_votes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('comment', 'user')},
            },
        ),
        migrations.CreateModel(
            name='CommentTranslation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('language', models.CharField(db_index=True, max_length=5)),
                ('text', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='translations', to='posts.comment')),
            ],
            options={
                'unique_together': {('comment', 'language')},
            },
        ),
    ]
