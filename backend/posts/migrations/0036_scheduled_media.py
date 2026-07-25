from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0035_post_location'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScheduledMedia',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('media_file', models.FileField(upload_to='scheduled/')),
                ('media_type', models.CharField(default='image', max_length=10)),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                (
                    'scheduled_post',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='media_files',
                        to='posts.scheduledpost',
                    ),
                ),
            ],
        ),
    ]
