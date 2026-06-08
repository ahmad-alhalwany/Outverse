from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('posts', '0011_merge_0005_postreaction_0010_comment_text_blank'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PostReaction',
        ),
    ]
