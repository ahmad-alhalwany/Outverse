from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('questions', '0004_ritualparticipation'),
        ('posts', '0021_comment_votes_pins_translate'),
    ]

    operations = [
        migrations.AddField(
            model_name='post',
            name='inspiration_question',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='inspired_posts',
                to='questions.question',
            ),
        ),
    ]
