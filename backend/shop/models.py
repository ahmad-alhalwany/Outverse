from django.db import models
from django.conf import settings
from django.utils import timezone

from outverse.upload_validators import validate_image_upload


class ShopItem(models.Model):
    ITEM_TYPES = [
        ('digital', 'Digital'),
        ('physical', 'Physical'),
        ('idea', 'Idea'),
    ]
    IDEA_KINDS = [
        ('', 'Plain idea'),
        ('cursed_prompt', 'Cursed Prompt'),
        ('alternate_you', 'Alternate You'),
        ('blind_drop', 'Blind Drop'),
        ('constellation_pack', 'Constellation Pack'),
        ('bottle', 'Idea in a Bottle'),
        ('reverse_commission', 'Reverse Commission'),
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
    type = models.CharField(max_length=20, choices=ITEM_TYPES, default='digital', db_index=True)
    category = models.CharField(
        max_length=20, choices=CATEGORY_CHOICES, default='art'
    )
    image = models.ImageField(upload_to='shop_items/', null=True, blank=True, validators=[validate_image_upload])
    stock = models.PositiveIntegerField(null=True, blank=True, help_text='Leave empty for unlimited stock')
    idea_kind = models.CharField(max_length=20, choices=IDEA_KINDS, blank=True, default='')
    unlock_at = models.DateTimeField(
        null=True, blank=True, help_text="Only used when idea_kind='bottle' — content stays hidden until this time"
    )
    cover_url = models.URLField(blank=True)
    download_url = models.URLField(
        blank=True,
        help_text='Direct download/access URL for digital items',
    )
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
    is_available = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def is_unlocked(self) -> bool:
        return self.unlock_at is None or timezone.now() >= self.unlock_at


class Transaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    FULFILLMENT_CHOICES = [
        ('not_applicable', 'Not applicable'),
        ('pending', 'Pending'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
    ]
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='transactions',
        db_index=True,
    )
    seller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sales',
        db_index=True,
    )
    item = models.ForeignKey(ShopItem, on_delete=models.CASCADE)
    amount = models.IntegerField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True
    )
    shipping_address = models.TextField(blank=True, default='')
    fulfillment_status = models.CharField(
        max_length=20, choices=FULFILLMENT_CHOICES, default='not_applicable', db_index=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username} bought {self.item.name}"


class Tip(models.Model):
    """Direct Outverse-coin gift from one user to another, optionally
    attached to a post or reel they're rewarding."""

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tips_sent',
        db_index=True,
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tips_received',
        db_index=True,
    )
    amount = models.PositiveIntegerField()
    post = models.ForeignKey(
        'posts.Post', on_delete=models.SET_NULL, null=True, blank=True, related_name='tips',
    )
    reel = models.ForeignKey(
        'reels.Reel', on_delete=models.SET_NULL, null=True, blank=True, related_name='tips',
    )
    message = models.CharField(max_length=200, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.sender_id} tipped {self.recipient_id} {self.amount}"


class CoinPack(models.Model):
    """A purchasable bundle of Outverse coins (real-money top-up)."""

    name = models.CharField(max_length=60)
    coins = models.PositiveIntegerField(help_text='Outverse coins granted on purchase')
    price_usd_cents = models.PositiveIntegerField(help_text='USD cents, e.g. 499 = $4.99')
    stripe_price_id = models.CharField(
        max_length=100, blank=True, help_text='Set once the price exists in the Stripe dashboard',
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'price_usd_cents']

    def __str__(self):
        return f'{self.name} ({self.coins} coins)'


class CoinPurchase(models.Model):
    """Record of a completed real-money coin top-up."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='coin_purchases',
        db_index=True,
    )
    pack = models.ForeignKey(CoinPack, on_delete=models.PROTECT, related_name='purchases')
    coins = models.PositiveIntegerField()
    price_usd_cents = models.PositiveIntegerField()
    stripe_checkout_session_id = models.CharField(max_length=120, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user_id} bought {self.coins} coins'
