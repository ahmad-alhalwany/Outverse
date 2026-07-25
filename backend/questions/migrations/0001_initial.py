from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Question',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('category', models.CharField(
                    choices=[
                        ('historical', 'Historical what-if'),
                        ('fantasy', 'Fantasy & worlds'),
                        ('scifi', 'Science & future'),
                        ('philosophical', 'Philosophical'),
                        ('mystery', 'Mystery & secrets'),
                        ('surreal', 'Surreal & absurd'),
                        ('everyday', 'Everyday magic'),
                        ('emotional', 'Emotional'),
                    ],
                    db_index=True, max_length=20,
                )),
                ('language', models.CharField(
                    choices=[('en', 'English'), ('ar', 'Arabic')],
                    db_index=True, default='en', max_length=2,
                )),
                ('tags', models.JSONField(blank=True, default=list)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('times_shown', models.PositiveIntegerField(default=0)),
                ('times_answered', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['id'],
            },
        ),
        migrations.CreateModel(
            name='QuestionView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('answered', models.BooleanField(default=False)),
                ('viewed_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('question', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='views',
                    to='questions.question',
                )),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='question_views',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-viewed_at'],
                'unique_together': {('user', 'question')},
            },
        ),
        migrations.AddConstraint(
            model_name='question',
            constraint=models.UniqueConstraint(
                fields=('text', 'language'),
                name='unique_question_text_per_language',
            ),
        ),
    ]
