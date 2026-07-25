from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0006_idea_tags'),
        ('collab', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='source_idea',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='collab_project',
                to='ideas.idea',
            ),
        ),
    ]
