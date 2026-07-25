# Generated for Pulse intelligence pack

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('reels', '0018_reel_allow_flags_reeldim'),
    ]

    operations = [
        migrations.CreateModel(
            name='ReelTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=64, unique=True)),
                ('title', models.CharField(max_length=120)),
                ('description', models.CharField(blank=True, default='', max_length=255)),
                ('mood', models.CharField(blank=True, default='cosmic', max_length=20)),
                ('filter_style', models.CharField(blank=True, default='cosmic', max_length=20)),
                ('overlay_stickers', models.JSONField(blank=True, default=list, help_text='[{id,emoji,x,y,scale}] percentage coords')),
                ('overlay_text', models.CharField(blank=True, default='', max_length=120)),
                ('default_sound_label', models.CharField(blank=True, default='', max_length=120)),
                ('backdrop_preset', models.CharField(blank=True, default='', help_text='Green-screen backdrop key: nebula|orbit|void|aurora|none', max_length=32)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('music_track', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='templates', to='reels.reelmusictrack')),
            ],
            options={
                'ordering': ['order', 'title'],
            },
        ),
        migrations.AddField(
            model_name='reel',
            name='captions',
            field=models.JSONField(blank=True, default=list, help_text='[{start,end,text}] seconds'),
        ),
        migrations.AddField(
            model_name='reel',
            name='captions_language',
            field=models.CharField(blank=True, default='en', max_length=8),
        ),
        migrations.AddField(
            model_name='reel',
            name='captions_status',
            field=models.CharField(choices=[('none', 'None'), ('pending', 'Pending'), ('ready', 'Ready'), ('failed', 'Failed')], db_index=True, default='none', max_length=12),
        ),
        migrations.AddField(
            model_name='reel',
            name='effect_meta',
            field=models.JSONField(blank=True, default=dict, help_text='Green screen / AR-lite: {backdrop,chroma_key,overlays,...}'),
        ),
        migrations.AddField(
            model_name='reel',
            name='template',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reels', to='reels.reeltemplate'),
        ),
    ]
