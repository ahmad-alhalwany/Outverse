from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questions', '0002_question_is_generated'),
    ]

    operations = [
        migrations.CreateModel(
            name='QuestionSuggestion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                (
                    'category',
                    models.CharField(
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
                        default='surreal',
                        max_length=20,
                    ),
                ),
                (
                    'language',
                    models.CharField(
                        choices=[('en', 'English'), ('ar', 'Arabic')],
                        default='en',
                        max_length=2,
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        choices=[
                            ('pending', 'Pending review'),
                            ('approved', 'Approved'),
                            ('rejected', 'Rejected'),
                        ],
                        db_index=True,
                        default='pending',
                        max_length=10,
                    ),
                ),
                ('reviewer_note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                (
                    'submitted_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=models.deletion.SET_NULL,
                        related_name='question_suggestions',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'ordering': ['-created_at'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=['text', 'language'],
                        name='unique_suggestion_text_per_language',
                    ),
                ],
            },
        ),
    ]
