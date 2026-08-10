from django.db import migrations, models

import outverse.upload_validators


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0008_ideapledge_is_anonymous'),
    ]

    operations = [
        migrations.AddField(
            model_name='idea',
            name='cover_image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='ideas/covers/',
                validators=[outverse.upload_validators.validate_image_upload],
            ),
        ),
    ]
