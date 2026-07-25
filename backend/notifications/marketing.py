"""
Bulk marketing email — distinct from the per-user activity digest in tasks.py.
Sends an admin-composed message to a segment of opted-in users (EmailPreference.marketing).
"""
from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.db.models import Q, QuerySet
from django.utils import timezone
from django.utils.html import strip_tags

User = get_user_model()

UNSUBSCRIBE_HTML = (
    '<p style="font-size:12px;color:#64748b;text-align:center;margin-top:24px;">'
    'You are receiving this because you opted in to product updates. '
    '<a href="https://cosmory.app/settings">Manage your email preferences</a>.'
    '</p>'
)
UNSUBSCRIBE_TEXT = (
    '\n\n---\nYou are receiving this because you opted in to product updates. '
    'Manage your preferences: https://cosmory.app/settings'
)


def resolve_segment_users(segment: str) -> QuerySet:
    """Opted-in users (EmailPreference.marketing=True) with a real email, matching the segment filter."""
    qs = User.objects.filter(email_preferences__marketing=True).exclude(email='')
    if segment == 'inactive_30d':
        cutoff = timezone.now() - timedelta(days=30)
        qs = qs.filter(Q(last_login__lt=cutoff) | Q(last_login__isnull=True))
    return qs


def send_campaign(campaign, dry_run: bool = False) -> int:
    """Send a campaign to its resolved segment. Returns the number sent (or would-send under dry_run)."""
    users = resolve_segment_users(campaign.segment)
    sent = 0
    for user in users:
        if dry_run:
            print(f'[DRY RUN] Would send campaign "{campaign.subject}" to {user.email}')
            sent += 1
            continue
        try:
            email = EmailMultiAlternatives(
                subject=campaign.subject,
                body=strip_tags(campaign.body_html) + UNSUBSCRIBE_TEXT,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user.email],
            )
            email.attach_alternative(campaign.body_html + UNSUBSCRIBE_HTML, 'text/html')
            email.send(fail_silently=False)
            sent += 1
        except Exception as e:
            print(f'Failed to send campaign to {user.email}: {e}')
    return sent
