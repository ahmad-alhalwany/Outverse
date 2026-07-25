"""Cosmetic patron-badge tier derived from cumulative coin spend."""

from __future__ import annotations

from django.db.models import Sum

# (minimum total coins spent, tier) — checked highest first.
SPENDER_TIERS = [
    (5000, 'gold'),
    (2000, 'silver'),
    (500, 'bronze'),
]


def total_spent_by(user_id: int) -> int:
    from .models import Tip, Transaction

    purchases = Transaction.objects.filter(
        user_id=user_id, status='completed',
    ).aggregate(total=Sum('amount'))['total'] or 0
    tips = Tip.objects.filter(sender_id=user_id).aggregate(total=Sum('amount'))['total'] or 0
    return purchases + tips


def tier_for_total(total: int) -> str:
    for threshold, tier in SPENDER_TIERS:
        if total >= threshold:
            return tier
    return 'none'


def update_spender_tier(user) -> str:
    """Recompute and persist `user.spender_tier`; returns the new tier."""
    tier = tier_for_total(total_spent_by(user.id))
    if user.spender_tier != tier:
        user.spender_tier = tier
        user.save(update_fields=['spender_tier'])
    return tier
