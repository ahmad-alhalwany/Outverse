from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0004_alter_chatroom_created_at_alter_message_created_at_and_more'),
        ('questions', '0004_ritualparticipation'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatroom',
            name='expires_at',
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name='chatroom',
            name='question',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='rooms',
                to='questions.question',
            ),
        ),
    ]
