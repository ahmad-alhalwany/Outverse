from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Sum, F

from .models import AdCampaign, Ad, AdImpression, AdClick


@receiver(post_save, sender=AdImpression)
def update_campaign_spend_on_impression(sender, instance, created, **kwargs):
    """Update campaign & ad spend counters on new impression."""
    if not created:
        return

    # Update Ad spend
    Ad.objects.filter(pk=instance.ad_id).update(
        impression_count=F('impression_count') + 1,
        spend=F('spend') + instance.cost,
        last_delivered_at=instance.created_at,
    )

    # Update Campaign spend
    AdCampaign.objects.filter(pk=instance.campaign_id).update(
        spent=F('spent') + instance.cost,
    )


@receiver(post_save, sender=AdClick)
def update_ad_on_click(sender, instance, created, **kwargs):
    """Update ad click counters."""
    if not created:
        return

    Ad.objects.filter(pk=instance.ad_id).update(
        click_count=F('click_count') + 1,
        spend=F('spend') + instance.cost,
        last_delivered_at=instance.created_at,
    )