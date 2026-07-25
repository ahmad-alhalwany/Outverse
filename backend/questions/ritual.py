"""Daily ritual: deterministic morning/evening prompt + streak tracking.

When the user has taste signals, ritual prompts are chosen from the
intersection of period categories and preferred categories. The hash
remains stable per user/day/period so the same prompt returns all day.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .feedback import preferred_categories_for_user
from .models import Question, RitualParticipation


MORNING_CATEGORIES = ('everyday', 'emotional', 'fantasy')
EVENING_CATEGORIES = ('philosophical', 'emotional', 'mystery')


def _period_for(now=None) -> str:
    now = now or timezone.now()
    return 'morning' if now.hour < 18 else 'evening'


def _categories_for_period(period: str) -> tuple[str, ...]:
    return MORNING_CATEGORIES if period == 'morning' else EVENING_CATEGORIES


def _eligible_question_ids(*, user, date, period, language: str) -> list[int]:
    period_cats = _categories_for_period(period)
    preferred = preferred_categories_for_user(user)
    if preferred:
        overlap = [c for c in preferred if c in period_cats]
        if overlap:
            period_cats = tuple(overlap)

    eligible_qs = Question.objects.filter(
        is_active=True,
        language=language,
        category__in=period_cats,
    )
    if not eligible_qs.exists():
        eligible_qs = Question.objects.filter(is_active=True, language=language)
    return list(eligible_qs.values_list('id', flat=True).order_by('id'))


def _deterministic_question_id(*, user, date, period, language: str) -> int | None:
    ids = _eligible_question_ids(user=user, date=date, period=period, language=language)
    if not ids:
        return None
    seed = f"{user.id}:{date.isoformat()}:{period}".encode()
    digest = hashlib.sha256(seed).hexdigest()
    return ids[int(digest, 16) % len(ids)]


@transaction.atomic
def get_or_create_today_ritual(user, *, period: str | None = None, language: str = 'en'):
    """Return (ritual, question, created_today) for the user's current window."""
    now = timezone.now()
    period = period or _period_for(now)
    today = now.date()

    ritual = (
        RitualParticipation.objects
        .filter(user=user, date=today, period=period)
        .select_related('question')
        .first()
    )
    if ritual:
        return ritual, ritual.question, False

    qid = _deterministic_question_id(user=user, date=today, period=period, language=language)
    if qid is None:
        return None, None, False
    question = Question.objects.get(pk=qid)
    ritual = RitualParticipation.objects.create(
        user=user,
        question=question,
        period=period,
        date=today,
    )
    return ritual, question, True


def complete_ritual(user, *, period: str | None = None) -> bool:
    """Mark the current window's ritual as completed. Returns True if updated."""
    now = timezone.now()
    period = period or _period_for(now)
    today = now.date()
    updated = (
        RitualParticipation.objects
        .filter(user=user, date=today, period=period, completed_at__isnull=True)
        .update(completed_at=now)
    )
    return updated > 0


def current_streak(user) -> int:
    """Count consecutive days (ending today or yesterday) with any completed ritual."""
    completed_dates = set(
        RitualParticipation.objects
        .filter(user=user, completed_at__isnull=False)
        .values_list('date', flat=True)
        .distinct()
    )
    if not completed_dates:
        return 0

    today = timezone.now().date()
    anchor = today if today in completed_dates else today - timedelta(days=1)
    if anchor not in completed_dates:
        return 0

    streak = 0
    cursor = anchor
    while cursor in completed_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak
