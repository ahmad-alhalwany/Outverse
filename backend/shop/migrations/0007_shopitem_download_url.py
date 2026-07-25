from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('shop', '0006_transaction_seller'),
    ]

    operations = [
        migrations.AddField(
            model_name='shopitem',
            name='download_url',
            field=models.URLField(
                blank=True,
                help_text='Direct download/access URL for digital items',
            ),
        ),
    ]
