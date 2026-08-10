from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('narratives', '0004_world_studio'),
    ]

    operations = [
        migrations.AlterField(
            model_name='storycollaborator',
            name='status',
            field=models.CharField(
                choices=[
                    ('invited', 'Invited'),
                    ('requested', 'Join requested'),
                    ('accepted', 'Accepted'),
                    ('removed', 'Removed'),
                ],
                default='invited',
                max_length=20,
            ),
        ),
    ]
