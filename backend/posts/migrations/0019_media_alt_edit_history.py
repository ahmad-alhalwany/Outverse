from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0018_saved_collections_visibility'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='edited_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='postmedia',
            name='alt_text',
            field=models.CharField(blank=True, default='', max_length=280),
        ),
        migrations.CreateModel(
            name='PostEditHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('previous_text', models.TextField(blank=True)),
                ('edited_at', models.DateTimeField(auto_now_add=True)),
                ('post', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='edit_history', to='posts.post')),
            ],
            options={
                'ordering': ['-edited_at'],
            },
        ),
    ]
