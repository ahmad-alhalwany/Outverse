from django.db import migrations, models


def seed_shop_coins(apps, schema_editor):
    Profile = apps.get_model('users', 'Profile')
    Profile.objects.filter(points=0).update(points=1250)


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_location'),
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
        migrations.RunPython(seed_shop_coins, migrations.RunPython.noop),
    ]
