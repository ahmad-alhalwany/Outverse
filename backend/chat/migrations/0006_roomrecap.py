from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0005_chatroom_prompt_room_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='RoomRecap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('participant_count', models.PositiveIntegerField(default=0)),
                ('message_count', models.PositiveIntegerField(default=0)),
                ('top_messages', models.JSONField(blank=True, default=list)),
                ('duration_minutes', models.PositiveIntegerField(default=0)),
                ('summary', models.TextField(blank=True, default='')),
                ('generated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('room', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='recap',
                    to='chat.chatroom',
                )),
            ],
        ),
    ]
