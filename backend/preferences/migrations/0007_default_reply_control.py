from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('preferences', '0006_pulse_creator_defaults'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='default_reply_control',
            field=models.CharField(
                choices=[
                    ('everyone', 'Everyone'),
                    ('followers', 'Followers'),
                    ('nobody', 'No one'),
                ],
                default='everyone',
                max_length=12,
            ),
        ),
    ]
