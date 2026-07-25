from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def _backfill_roles(apps, schema_editor):
    Membership = apps.get_model('communities', 'CommunityMembership')
    Membership.objects.filter(is_moderator=True, role='member').update(role='moderator')


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('communities', '0004_community_flair_options_membership_banned'),
    ]

    operations = [
        migrations.AddField(
            model_name='communitymembership',
            name='role',
            field=models.CharField(
                choices=[
                    ('member', 'Member'),
                    ('moderator', 'Moderator'),
                    ('admin', 'Admin'),
                ],
                db_index=True,
                default='member',
                max_length=12,
            ),
        ),
        migrations.CreateModel(
            name='CommunityWikiPage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=80)),
                ('title', models.CharField(max_length=120)),
                ('body', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('edited_at', models.DateTimeField(auto_now=True)),
                ('community', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='wiki_pages',
                    to='communities.community',
                )),
                ('edited_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='+',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['title'],
                'unique_together': {('community', 'slug')},
            },
        ),
        migrations.RunPython(_backfill_roles, migrations.RunPython.noop),
    ]
