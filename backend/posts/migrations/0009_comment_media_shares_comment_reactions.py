from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('posts', '0008_savedpost'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='shares_count',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='comment',
            name='gif_url',
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='comment',
            name='sticker_url',
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.CreateModel(
            name='CommentReaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('inspired', 'Inspired'), ('cosmic', 'Cosmic'), ('mindbending', 'Mind-Bending'), ('growing', 'Growing'), ('spark', 'Spark')], max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reactions', to='posts.comment')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='comment_reactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('comment', 'user')},
            },
        ),
    ]
