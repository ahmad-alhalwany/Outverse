from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('moderation', '0007_flaggedcontent_chat_types'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name='flaggedcontent',
                    name='reason',
                    field=models.CharField(
                        blank=True,
                        choices=[
                            ('spam', 'Spam'),
                            ('harassment', 'Harassment'),
                            ('impersonation', 'Impersonation'),
                            ('hate', 'Hate speech'),
                            ('other', 'Other'),
                        ],
                        default='',
                        max_length=20,
                    ),
                ),
                migrations.AddField(
                    model_name='flaggedcontent',
                    name='details',
                    field=models.TextField(blank=True, default=''),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql="""
                    ALTER TABLE moderation_flaggedcontent
                      ADD COLUMN IF NOT EXISTS reason varchar(20) DEFAULT '' NOT NULL;
                    ALTER TABLE moderation_flaggedcontent
                      ADD COLUMN IF NOT EXISTS details text DEFAULT '' NOT NULL;
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
        ),
    ]
