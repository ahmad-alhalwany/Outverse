from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('communities', '0003_community_rules_membership_flair'),
    ]

    operations = [
        migrations.AddField(
            model_name='community',
            name='flair_options',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name='communitymembership',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('approved', 'Approved'),
                    ('banned', 'Banned'),
                ],
                default='approved',
                max_length=10,
            ),
        ),
    ]
