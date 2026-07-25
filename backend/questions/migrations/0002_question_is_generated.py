from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questions', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='question',
            name='is_generated',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
