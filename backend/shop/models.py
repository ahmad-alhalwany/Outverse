from django.conf import settings
from django.db import models


class ShopItem(models.Model):
    ITEM_TYPES = [
        ('digital', 'Digital'),
        ('physical', 'Physical'),
    ]
    CATEGORY_CHOICES = [
        ('art', 'Art'),
        ('template', 'Template'),
        ('story', 'Story'),
        ('design', 'Design'),
        ('music', 'Music'),
        ('effect', 'Effect Pack'),
        ('other', 'Other'),
    ]
    name = models.CharField(max_length=200)
    description = models.TextField()
    price = models.IntegerField(help_text='Price in Outverse coins')
    type = models.CharField(max_length=20, choices=ITEM_TYPES, default='digital')
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='art'
    )
    image = models.ImageField(upload_to='shop_items/', null=True, blank=True)
    cover_url = models.URLField(blank=True)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shop_items',
    )
    rating = models.FloatField(default=0)
    sales_count = models.IntegerField(default=0)
    is_featured = models.BooleanField(default=False)
    is_available = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class Transaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='transactions',
    )
    item = models.ForeignKey(ShopItem, on_delete=models.CASCADE)
    amount = models.IntegerField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username} bought {self.item.name}"
