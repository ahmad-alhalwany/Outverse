from django.db import migrations, models

import outverse.upload_validators


class Migration(migrations.Migration):

    dependencies = [
        ('challenges', '0003_challenge_creator_ai'),
    ]

    operations = [
        migrations.AddField(
            model_name='challenge',
            name='cover_image',
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to='challenges/covers/',
                validators=[outverse.upload_validators.validate_image_upload],
            ),
        ),
    ]
