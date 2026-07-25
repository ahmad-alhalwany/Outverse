from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0016_socialauthaccount_apple_provider'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='karma',
            field=models.IntegerField(default=0, help_text='Reddit-style karma from post votes'),
        ),
    ]
