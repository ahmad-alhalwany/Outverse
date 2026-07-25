from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0007_idea_target_date_milestones'),
    ]

    operations = [
        migrations.AddField(
            model_name='ideapledge',
            name='is_anonymous',
            field=models.BooleanField(default=False),
        ),
    ]
