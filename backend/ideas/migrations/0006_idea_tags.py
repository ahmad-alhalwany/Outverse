from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0005_saved_items'),
    ]

    operations = [
        migrations.AddField(
            model_name='idea',
            name='tags',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
