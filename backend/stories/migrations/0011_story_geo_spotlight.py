import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stories', '0010_storyconstellation_cover_image_storyhighlight'),
    ]

    operations = [
        migrations.AddField(
            model_name='story',
            name='location_name',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='story',
            name='location_lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='story',
            name='location_lng',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='StorySpotlight',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('featured', 'Featured'), ('rejected', 'Rejected')], db_index=True, default='pending', max_length=12)),
                ('score', models.IntegerField(default=0)),
                ('featured_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('story', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='spotlight', to='stories.story')),
            ],
            options={
                'ordering': ['-score', '-created_at'],
            },
        ),
    ]
