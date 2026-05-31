import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('shop', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='shopitem',
            name='type',
            field=models.CharField(
                choices=[('digital', 'Digital'), ('physical', 'Physical')],
                default='digital',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='shopitem',
            name='category',
            field=models.CharField(
                choices=[
                    ('art', 'Art'),
                    ('template', 'Template'),
                    ('story', 'Story'),
                    ('design', 'Design'),
                    ('music', 'Music'),
                    ('effect', 'Effect Pack'),
                    ('other', 'Other'),
                ],
                default='art',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='shopitem',
            name='cover_url',
            field=models.URLField(blank=True, default=''),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='shopitem',
            name='creator',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='shop_items',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='shopitem',
            name='rating',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='shopitem',
            name='sales_count',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='shopitem',
            name='is_featured',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='shopitem',
            name='created_at',
            field=models.DateTimeField(
                auto_now_add=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='shopitem',
            name='image',
            field=models.ImageField(
                blank=True, null=True, upload_to='shop_items/'
            ),
        ),
        migrations.AlterField(
            model_name='shopitem',
            name='price',
            field=models.IntegerField(help_text='Price in Outverse coins'),
        ),
        migrations.AlterField(
            model_name='transaction',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('completed', 'Completed'),
                    ('failed', 'Failed'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AlterModelOptions(
            name='shopitem',
            options={'ordering': ['-created_at']},
        ),
        migrations.AlterModelOptions(
            name='transaction',
            options={'ordering': ['-timestamp']},
        ),
    ]
