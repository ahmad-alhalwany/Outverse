"""Community Ritual — one shared daily prompt per community + per-member streak."""

from __future__ import annotations

import hashlib
from datetime import timedelta

from django.utils import timezone

from .constellation import build_community_constellation
from .models import CommunityRitualParticipation


def get_today_prompt(community) -> dict | None:
    questions = build_community_constellation(community)['questions']
    if not questions:
        return None
    today = timezone.now().date()
    seed = f"{community.id}:{today.isoformat()}".encode()
    digest = hashlib.sha256(seed).hexdigest()
    return questions[int(digest, 16) % len(questions)]


def complete_ritual(community, user) -> None:
    today = timezone.now().date()
    obj, created = CommunityRitualParticipation.objects.get_or_create(
        community=community, user=user, date=today,
        defaults={'completed_at': timezone.now()},
    )
    if not created and obj.completed_at is None:
        obj.completed_at = timezone.now()
        obj.save(update_fields=['completed_at'])


def current_streak(community, user) -> int:
    # ponytail: O(n) recompute per call, same tradeoff as questions.ritual.current_streak;
    # upgrade to a cached counter if this ever shows up hot.
    completed = set(
        CommunityRitualParticipation.objects
        .filter(community=community, user=user, completed_at__isnull=False)
        .values_list('date', flat=True)
    )
    if not completed:
        return 0
    today = timezone.now().date()
    anchor = today if today in completed else today - timedelta(days=1)
    if anchor not in completed:
        return 0
    streak, cursor = 0, anchor
    while cursor in completed:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
