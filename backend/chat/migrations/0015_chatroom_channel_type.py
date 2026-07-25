from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0014_chatroom_community_category_slowmode'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatroom',
            name='channel_type',
            field=models.CharField(
                choices=[('text', 'Text'), ('voice', 'Voice'), ('stage', 'Stage')],
                default='text',
                max_length=10,
            ),
        ),
    ]
