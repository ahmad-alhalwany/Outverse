"""
Advertising models for Outverse.

Covers:
- AdCampaign: budget, targeting, schedule, bidding
- AdCreative: media, copy, CTA, landing URL
- Ad: links campaign + creative, tracks status
- AdImpression: per-view logging for billing/reporting
- AdClick: per-click logging
- AdConversion: optional post-click attribution
"""
from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class AdCampaign(models.Model):
    """Top-level campaign — holds budget, targeting, schedule."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
    ]

    OBJECTIVE_CHOICES = [
        ('awareness', 'Brand Awareness'),
        ('traffic', 'Traffic / Clicks'),
        ('engagement', 'Engagement'),
        ('conversions', 'Conversions'),
        ('app_installs', 'App Installs'),
    ]

    BID_STRATEGY_CHOICES = [
        ('cpm', 'CPM — Cost per 1,000 Impressions'),
        ('cpc', 'CPC — Cost per Click'),
        ('cpa', 'CPA — Cost per Action'),
    ]

    advertiser = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ad_campaigns',
    )
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    objective = models.CharField(max_length=20, choices=OBJECTIVE_CHOICES, default='traffic')
    bid_strategy = models.CharField(max_length=10, choices=BID_STRATEGY_CHOICES, default='cpm')

    # Budget
    daily_budget = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    lifetime_budget = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.01'))],
    )
    spent = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # Schedule
    start_date = models.DateTimeField(db_index=True)
    end_date = models.DateTimeField(null=True, blank=True)

    # Targeting (JSON for flexibility)
    targeting = models.JSONField(default=dict, blank=True)
    # Example targeting:
    # {
    #   "countries": ["DE", "US"],
    #   "languages": ["en", "de"],
    #   "age_min": 18,
    #   "age_max": 65,
    #   "genders": ["male", "female"],
    #   "interests": ["tech", "gaming"],
    #   "placements": ["feed", "stories", "reels", "explore"],
    #   "exclude_custom_audiences": [123],
    #   "custom_audience_id": 456,
    # }

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reviewed_campaigns',
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['advertiser', 'status']),
            models.Index(fields=['status', 'start_date', 'end_date']),
        ]

    def __str__(self):
        return f"Campaign {self.id}: {self.name} ({self.status})"

    @property
    def is_active(self) -> bool:
        from django.utils import timezone
        now = timezone.now()
        return (
            self.status == 'active'
            and self.start_date <= now
            and (self.end_date is None or self.end_date >= now)
            and self.spent < self.lifetime_budget
        )

    @property
    def can_be_activated(self) -> bool:
        """Whether this campaign is eligible to be switched to 'active' status —
        i.e. budget isn't exhausted and the schedule hasn't ended. Deliberately
        excludes the current `status` (unlike `is_active`), since this is used
        to decide *whether a status transition to active is allowed*.
        """
        from django.utils import timezone
        now = timezone.now()
        return (
            (self.end_date is None or self.end_date >= now)
            and self.spent < self.lifetime_budget
        )

    @property
    def daily_spend_limit_reached(self) -> bool:
        from django.utils import timezone
        from django.db.models import Sum
        today = timezone.now().date()
        today_spent = self.impressions.filter(created_at__date=today).aggregate(
            total=Sum('cost')
        )['total'] or Decimal('0.00')
        return today_spent >= self.daily_budget


class AdCreative(models.Model):
    """Creative asset — image/video + copy + CTA."""

    FORMAT_CHOICES = [
        ('image', 'Single Image'),
        ('carousel', 'Carousel (2-10 images)'),
        ('video', 'Video'),
        ('story', 'Full-screen Story'),
        ('reel', 'Reel-style Video'),
    ]

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    campaign = models.ForeignKey(
        AdCampaign,
        on_delete=models.CASCADE,
        related_name='creatives',
    )
    name = models.CharField(max_length=200)
    format = models.CharField(max_length=15, choices=FORMAT_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)

    # Media
    media_urls = models.JSONField(default=list, blank=True)  # List of URLs (1 for image/video, 2-10 for carousel)
    aspect_ratio = models.CharField(max_length=10, default='1:1')  # '1:1', '9:16', '4:5', '16:9'

    # Copy
    headline = models.CharField(max_length=125, blank=True)
    primary_text = models.TextField(blank=True, max_length=2000)
    description = models.CharField(max_length=30, blank=True)  # For link ads

    # CTA
    cta_text = models.CharField(max_length=30, blank=True)  # 'Learn More', 'Shop Now', etc.
    landing_url = models.URLField(max_length=500)

    # Tracking
    utm_params = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Creative {self.id}: {self.name} ({self.format})"


class Ad(models.Model):
    """Runtime ad — links campaign + creative, tracks delivery state."""

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_review', 'Pending Review'),
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('completed', 'Completed'),
        ('rejected', 'Rejected'),
        ('disapproved', 'Disapproved'),  # Policy violation
    ]

    campaign = models.ForeignKey(
        AdCampaign,
        on_delete=models.CASCADE,
        related_name='ads',
    )
    creative = models.ForeignKey(
        AdCreative,
        on_delete=models.CASCADE,
        related_name='ads',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)

    # Override campaign targeting per-ad (optional)
    targeting_override = models.JSONField(default=dict, blank=True)

    # Delivery tracking (aggregated counters)
    impression_count = models.PositiveIntegerField(default=0)
    click_count = models.PositiveIntegerField(default=0)
    spend = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['campaign', 'status']),
        ]

    def __str__(self):
        return f"Ad {self.id} (campaign {self.campaign_id}) — {self.status}"

    @property
    def ctr(self) -> float:
        if self.impression_count == 0:
            return 0.0
        return round((self.click_count / self.impression_count) * 100, 2)

    @property
    def cpc(self) -> float:
        if self.click_count == 0:
            return 0.0
        return round(float(self.spend) / self.click_count, 4)

    @property
    def cpm(self) -> float:
        if self.impression_count == 0:
            return 0.0
        return round((float(self.spend) / self.impression_count) * 1000, 4)


class AdImpression(models.Model):
    """Logged per impression for billing & reporting."""

    ad = models.ForeignKey(
        Ad,
        on_delete=models.CASCADE,
        related_name='ad_impressions',
    )
    campaign = models.ForeignKey(
        AdCampaign,
        on_delete=models.CASCADE,
        related_name='impressions',
    )
    creative = models.ForeignKey(
        AdCreative,
        on_delete=models.CASCADE,
        related_name='impressions',
    )

    # User context (nullable for non-logged-in)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ad_impressions',
    )
    session_id = models.CharField(max_length=64, blank=True, db_index=True)

    # Placement & context
    placement = models.CharField(max_length=20, db_index=True)  # 'feed', 'stories', 'reels', 'explore', 'profile'
    content_type = models.CharField(max_length=20, blank=True)  # 'post', 'reel', 'story', 'profile'
    content_id = models.PositiveIntegerField(null=True, blank=True)

    # Geo
    country = models.CharField(max_length=2, blank=True, db_index=True)
    city = models.CharField(max_length=100, blank=True)

    # Device
    device_type = models.CharField(max_length=20, blank=True)  # 'mobile', 'desktop', 'tablet'
    os = models.CharField(max_length=30, blank=True)
    browser = models.CharField(max_length=30, blank=True)

    # Cost (for CPM billing)
    cost = models.DecimalField(max_digits=10, decimal_places=6, default=Decimal('0.000000'))
    bid_price = models.DecimalField(max_digits=10, decimal_places=6, default=Decimal('0.000000'))

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ad', 'created_at']),
            models.Index(fields=['campaign', 'created_at']),
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['placement', 'created_at']),
        ]

    def __str__(self):
        return f"Impression {self.id} for Ad {self.ad_id}"


class AdClick(models.Model):
    """Logged per click for billing & reporting."""

    impression = models.ForeignKey(
        AdImpression,
        on_delete=models.CASCADE,
        related_name='clicks',
    )
    ad = models.ForeignKey(
        Ad,
        on_delete=models.CASCADE,
        related_name='ad_clicks',
    )
    campaign = models.ForeignKey(
        AdCampaign,
        on_delete=models.CASCADE,
        related_name='clicks',
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ad_clicks',
    )
    session_id = models.CharField(max_length=64, blank=True, db_index=True)

    # Cost (for CPC billing)
    cost = models.DecimalField(max_digits=10, decimal_places=6, default=Decimal('0.000000'))

    # Click context
    referrer_url = models.URLField(max_length=500, blank=True)
    landing_url = models.URLField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ad', 'created_at']),
            models.Index(fields=['campaign', 'created_at']),
            models.Index(fields=['impression', 'created_at']),
        ]

    def __str__(self):
        return f"Click {self.id} for Ad {self.ad_id}"


class AdConversion(models.Model):
    """Optional post-click attribution (purchase, signup, etc.)."""

    EVENT_TYPES = [
        ('purchase', 'Purchase'),
        ('signup', 'Sign Up'),
        ('lead', 'Lead'),
        ('add_to_cart', 'Add to Cart'),
        ('initiate_checkout', 'Initiate Checkout'),
        ('custom', 'Custom Event'),
    ]

    click = models.ForeignKey(
        AdClick,
        on_delete=models.CASCADE,
        related_name='conversions',
    )
    ad = models.ForeignKey(
        Ad,
        on_delete=models.CASCADE,
        related_name='conversions',
    )
    campaign = models.ForeignKey(
        AdCampaign,
        on_delete=models.CASCADE,
        related_name='conversions',
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='ad_conversions',
    )

    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    event_name = models.CharField(max_length=100, blank=True)
    value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=3, default='USD')

    # Attribution window
    attributed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-attributed_at']
        indexes = [
            models.Index(fields=['ad', 'attributed_at']),
            models.Index(fields=['campaign', 'attributed_at']),
        ]

    def __str__(self):
        return f"Conversion {self.event_type} for Ad {self.ad_id}"