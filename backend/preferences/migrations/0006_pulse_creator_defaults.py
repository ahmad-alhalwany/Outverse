# Generated manually for Pulse Pack creator defaults

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('preferences', '0005_userpreferences_read_receipts_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='userpreferences',
            name='default_allow_download',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='userpreferences',
            name='default_allow_remix',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='userpreferences',
            name='default_allow_weave',
            field=models.BooleanField(default=True),
        ),
    ]
