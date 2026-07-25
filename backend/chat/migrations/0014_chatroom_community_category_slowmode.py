from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('communities', '0005_membership_role_wiki'),
        ('chat', '0013_scheduledmessage'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatroom',
            name='category',
            field=models.CharField(blank=True, default='', max_length=80),
        ),
        migrations.AddField(
            model_name='chatroom',
            name='community',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='channels',
                to='communities.community',
            ),
        ),
        migrations.AddField(
            model_name='chatroom',
            name='slowmode_seconds',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
