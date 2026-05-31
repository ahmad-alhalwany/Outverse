from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='idea',
            options={'ordering': ['-created_at']},
        ),
        migrations.AddField(
            model_name='idea',
            name='category',
            field=models.CharField(
                choices=[
                    ('technology', 'Technology'),
                    ('design', 'Design'),
                    ('writing', 'Writing'),
                    ('art', 'Art'),
                    ('education', 'Education'),
                    ('environment', 'Environment'),
                    ('health', 'Health'),
                    ('social', 'Social Impact'),
                    ('other', 'Other'),
                ],
                default='other',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='idea',
            name='cover_url',
            field=models.URLField(blank=True),
        ),
        migrations.AddField(
            model_name='idea',
            name='roles_needed',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='idea',
            name='funding_goal',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='idea',
            name='funding_raised',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
