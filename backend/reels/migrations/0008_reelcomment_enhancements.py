from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def migrate_pins_forward(apps, schema_editor):
    Comment = apps.get_model('reels', 'ReelComment')
    order = 1
    for comment in Comment.objects.filter(is_pinned=True).order_by('created_at'):
        comment.pin_order = order
        comment.save(update_fields=['pin_order'])
        order += 1


def migrate_pins_backward(apps, schema_editor):
    Comment = apps.get_model('reels', 'ReelComment')
    Comment.objects.filter(pin_order__isnull=False).update(is_pinned=True)
    Comment.objects.filter(pin_order__isnull=True).update(is_pinned=False)


class Migration(migrations.Migration):

    dependencies = [
        ('reels', '0007_alter_reelcomment_options_reel_shares_count_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='reelcomment',
            name='edited_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='reelcomment',
            name='quoted_comment',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='quotes',
                to='reels.reelcomment',
            ),
        ),
        migrations.AddField(
            model_name='reelcomment',
            name='pin_order',
            field=models.PositiveSmallIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='reelcomment',
            name='sparked_by_author',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(migrate_pins_forward, migrate_pins_backward),
        migrations.RemoveField(
            model_name='reelcomment',
            name='is_pinned',
        ),
        migrations.AlterModelOptions(
            name='reelcomment',
            options={'ordering': ['created_at']},
        ),
        migrations.CreateModel(
            name='ReelCommentVote',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.SmallIntegerField(choices=[(1, 'boost'), (-1, 'dim')])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='votes', to='reels.reelcomment')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reel_comment_votes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('comment', 'user')},
            },
        ),
        migrations.CreateModel(
            name='ReelCommentTranslation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('language', models.CharField(db_index=True, max_length=5)),
                ('text', models.TextField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='translations', to='reels.reelcomment')),
            ],
            options={
                'unique_together': {('comment', 'language')},
            },
        ),
    ]
