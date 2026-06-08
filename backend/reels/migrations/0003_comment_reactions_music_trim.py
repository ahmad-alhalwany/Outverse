from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('reels', '0002_reel_extras'),
    ]

    operations = [
        migrations.AddField(
            model_name='reel',
            name='music_start_seconds',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='reel',
            name='music_end_seconds',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='ReelCommentReaction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('type', models.CharField(choices=[('inspired', 'Inspired'), ('cosmic', 'Cosmic'), ('mindbending', 'Mind-Bending'), ('growing', 'Growing'), ('spark', 'Spark')], max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('comment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reactions', to='reels.reelcomment')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reel_comment_reactions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('comment', 'user')},
            },
        ),
    ]
