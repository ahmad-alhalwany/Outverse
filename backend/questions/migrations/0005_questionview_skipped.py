from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questions', '0004_ritualparticipation'),
    ]

    operations = [
        migrations.AddField(
            model_name='questionview',
            name='skipped',
            field=models.BooleanField(default=False),
        ),
    ]
