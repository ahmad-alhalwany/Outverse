from django.conf import settings
from django.db import models


class SubscriptionPlan(models.Model):
    TIER_CHOICES = [
        ('nova', 'Nova'),
        ('supernova', 'Supernova'),
        ('galaxy', 'Galaxy'),
    ]

    tier = models.CharField(max_length=20, choices=TIER_CHOICES, unique=True)
    name = models.CharField(max_length=100)
    price_usd_cents = models.PositiveIntegerField(help_text='Monthly price in USD cents, e.g. 999 = $9.99')
    stripe_price_id = models.CharField(max_length=100, blank=True, help_text='Set once the plan exists in the Stripe dashboard')
    features = models.JSONField(default=list, blank=True)
    is_recommended = models.BooleanField(default=False)

    class Meta:
        ordering = ['price_usd_cents']

    def __str__(self):
        return self.name


class Subscription(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('canceled', 'Canceled'),
        ('past_due', 'Past due'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscription',
    )
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name='subscriptions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True)
    stripe_customer_id = models.CharField(max_length=100, blank=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, db_index=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user} — {self.plan} ({self.status})"

    @property
    def is_active(self):
        return self.status == 'active'


# Coins credited to a creator per USD cent of real recurring subscription
# revenue, before the platform's cut is applied. Kept as a simple constant
# (100 coins = $1) rather than reusing shop.CoinPack rates, since those model
# a fan's *purchase* price for coins, not a creator's *payout* rate.
CREATOR_PAYOUT_COINS_PER_USD_CENT = 1
PLATFORM_FEE_PERCENT = 10


class CreatorTier(models.Model):
    """A paid perk tier a creator offers to fans, billed monthly via Stripe.
    Capped at a small number per creator (enforced in the view) to keep tier
    management simple rather than open-ended like a full Patreon-style setup."""

    MAX_TIERS_PER_CREATOR = 3

    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='creator_tiers',
    )
    name = models.CharField(max_length=60)
    description = models.TextField(max_length=500, blank=True, default='')
    price_usd_cents = models.PositiveIntegerField(help_text='Monthly price in USD cents, e.g. 499 = $4.99')
    stripe_price_id = models.CharField(
        max_length=100, blank=True, help_text='Set once this tier\'s price exists in the Stripe dashboard',
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sort_order', 'price_usd_cents']

    def __str__(self):
        return f'{self.name} ({self.creator_id})'


class CreatorSubscription(models.Model):
    """A fan's paid subscription to a specific creator's tier. One active
    subscription per (fan, creator) pair — switching tiers updates this row
    rather than creating a second one."""

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('canceled', 'Canceled'),
        ('past_due', 'Past due'),
    ]

    fan = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='creator_subscriptions',
    )
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='subscribers',
    )
    tier = models.ForeignKey(CreatorTier, on_delete=models.PROTECT, related_name='subscriptions')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True)
    stripe_customer_id = models.CharField(max_length=100, blank=True)
    stripe_subscription_id = models.CharField(max_length=100, blank=True, db_index=True)
    current_period_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('fan', 'creator')

    def __str__(self):
        return f"{self.fan_id} subscribes to {self.creator_id} ({self.tier.name}, {self.status})"

    @property
    def is_active(self):
        return self.status == 'active'


class CreatorSubscriptionPayout(models.Model):
    """One recurring-billing credit to a creator, recorded per Stripe invoice
    so a retried webhook delivery can't double-credit the same payment."""

    subscription = models.ForeignKey(
        CreatorSubscription, on_delete=models.CASCADE, related_name='payouts',
    )
    stripe_invoice_id = models.CharField(max_length=120, unique=True)
    amount_usd_cents = models.PositiveIntegerField()
    coins_credited = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'payout {self.coins_credited} coins for sub {self.subscription_id}'
