from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('communities', '0005_membership_role_wiki'),
    ]

    operations = [
        migrations.AddField(
            model_name='community',
            name='is_nsfw',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='community',
            name='spoilers_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='community',
            name='posting_permission',
            field=models.CharField(
                choices=[('members', 'Approved members'), ('mods', 'Moderators only')],
                default='members',
                max_length=12,
            ),
        ),
    ]
