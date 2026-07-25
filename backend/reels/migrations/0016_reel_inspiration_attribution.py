from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ideas', '0007_idea_target_date_milestones'),
        ('questions', '0002_question_is_generated'),
        ('reels', '0015_livesession_provider_input_id_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='reel',
            name='inspiration_question',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inspired_reels',
                to='questions.question',
            ),
        ),
        migrations.AddField(
            model_name='reel',
            name='source_idea',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inspired_reels',
                to='ideas.idea',
            ),
        ),
    ]
