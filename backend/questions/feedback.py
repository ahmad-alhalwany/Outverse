"""Learning signals for personalized inspiration prompts."""

from __future__ import annotations

from collections import Counter
from typing import Iterable

from django.db.models import F

from posts.models import Post

from .interests import categories_for_interests
from .models import Question, QuestionView


BEHAVIOR_WEIGHT = 2
SKIP_WEIGHT = 1
PUBLISH_WEIGHT = 3
SERENDIPITY_FALLBACK_CATEGORIES = ('surreal', 'fantasy', 'mystery')


def _declared_scores(user) -> Counter[str]:
    declared = categories_for_interests(list(getattr(user, 'interests', []) or []))
    scores: Counter[str] = Counter()
    for i, cat in enumerate(declared):
        scores[cat] += max(1, len(declared) - i)
    return scores


def category_stats_for_user(user) -> dict[str, int]:
    if not user or not user.is_authenticated:
        return {}
    rows = (
        QuestionView.objects
        .filter(user=user, answered=True)
        .values('question__category')
        .order_by()
    )
    counts: Counter[str] = Counter()
    for row in rows:
        counts[row['question__category']] += 1
    return dict(counts)


def skipped_stats_for_user(user) -> dict[str, int]:
    if not user or not user.is_authenticated:
        return {}
    rows = (
        QuestionView.objects
        .filter(user=user, skipped=True)
        .values('question__category')
        .order_by()
    )
    counts: Counter[str] = Counter()
    for row in rows:
        counts[row['question__category']] += 1
    return dict(counts)


def preferred_categories_for_user(user) -> list[str]:
    """Combine declared interests, answers, publishes, and skip penalties."""
    if not user or not user.is_authenticated:
        return []

    scores = _declared_scores(user)

    answered = (
        QuestionView.objects
        .filter(user=user, answered=True, question__is_active=True)
        .values_list('question__category', flat=True)
    )
    for cat in answered:
        scores[cat] += BEHAVIOR_WEIGHT

    published = (
        Post.objects
        .filter(user=user, inspiration_question__isnull=False, inspiration_question__is_active=True)
        .values_list('inspiration_question__category', flat=True)
    )
    for cat in published:
        scores[cat] += PUBLISH_WEIGHT

    skipped = (
        QuestionView.objects
        .filter(user=user, skipped=True, question__is_active=True)
        .values_list('question__category', flat=True)
    )
    for cat in skipped:
        scores[cat] -= SKIP_WEIGHT

    scores = Counter({cat: score for cat, score in scores.items() if score > 0})
    if not scores:
        return []

    return [cat for cat, _ in scores.most_common(5)]


def serendipity_pool(preferred: Iterable[str], all_categories: Iterable[str]) -> list[str]:
    preferred_set = set(preferred)
    outside = [c for c in all_categories if c not in preferred_set]
    return outside or list(preferred_set)[:1]


def user_avoid_texts(user, language: str, limit: int = 12) -> list[str]:
    """Recent prompts this user has seen — used to avoid repeats in LLM generation."""
    if not user or not user.is_authenticated:
        return list(
            Question.objects.filter(language=language, is_active=True)
            .order_by('-id')[:limit]
            .values_list('text', flat=True)
        )
    seen_ids = QuestionView.objects.filter(user=user).values_list('question_id', flat=True)
    qs = Question.objects.filter(language=language, is_active=True, id__in=seen_ids).order_by('-id')[:limit]
    texts = list(qs.values_list('text', flat=True))
    if len(texts) < limit:
        extra = (
            Question.objects.filter(language=language, is_active=True)
            .exclude(id__in=seen_ids)
            .order_by('-id')[: limit - len(texts)]
            .values_list('text', flat=True)
        )
        texts.extend(extra)
    return texts


def pick_generate_category(user, category: str | None) -> str | None:
    if category and category != 'all':
        return category
    preferred = preferred_categories_for_user(user)
    if preferred:
        return preferred[0]
    return None


def record_question_skipped(user, question: Question) -> None:
    QuestionView.objects.update_or_create(
        user=user,
        question=question,
        defaults={'skipped': True},
    )


def record_question_published(user, question: Question) -> None:
    QuestionView.objects.update_or_create(
        user=user,
        question=question,
        defaults={'answered': True, 'skipped': False},
    )
    Question.objects.filter(pk=question.pk).update(times_answered=F('times_answered') + 1)
