from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0006_idea_tags'),
    ]

    operations = [
        migrations.AddField(
            model_name='idea',
            name='target_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='idea',
            name='milestones',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
