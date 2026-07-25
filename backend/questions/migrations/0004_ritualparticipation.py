from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('questions', '0003_questionsuggestion'),
    ]

    operations = [
        migrations.CreateModel(
            name='RitualParticipation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'period',
                    models.CharField(
                        choices=[('morning', 'Morning prompt'), ('evening', 'Evening reflection')],
                        max_length=10,
                    ),
                ),
                ('date', models.DateField(db_index=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='ritual_participations',
                    to='users.user',
                )),
                ('question', models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name='rituals',
                    to='questions.question',
                )),
            ],
            options={
                'ordering': ['-date', '-id'],
                'constraints': [
                    models.UniqueConstraint(
                        fields=['user', 'date', 'period'],
                        name='unique_ritual_per_user_day_period',
                    ),
                ],
            },
        ),
    ]
