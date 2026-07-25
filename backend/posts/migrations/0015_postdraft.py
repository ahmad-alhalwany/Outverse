from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0014_postmedia_audio_choice'),
    ]

    operations = [
        migrations.CreateModel(
            name='PostDraft',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField(blank=True, default='')),
                ('mood', models.CharField(blank=True, default='', max_length=20)),
                ('tags', models.JSONField(blank=True, default=list)),
                ('updated_at', models.DateTimeField(auto_now=True, db_index=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='post_drafts',
                    to='users.user',
                )),
            ],
            options={
                'ordering': ['-updated_at'],
                'constraints': [
                    models.CheckConstraint(
                        condition=~models.Q(text=''),
                        name='post_draft_not_empty',
                    ),
                ],
            },
        ),
    ]
