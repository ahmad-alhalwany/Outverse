from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_profile_points_default'),
    ]

    operations = [
        migrations.AlterField(
            model_name='profile',
            name='points',
            field=models.IntegerField(
                default=1250,
                help_text='Outverse coins for the shop',
            ),
        ),
    ]
