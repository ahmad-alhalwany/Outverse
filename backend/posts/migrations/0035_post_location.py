from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0034_resonance_pack'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='location_name',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
        migrations.AddField(
            model_name='post',
            name='location_lat',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='post',
            name='location_lng',
            field=models.FloatField(blank=True, null=True),
        ),
    ]
