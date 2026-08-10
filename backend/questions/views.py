from random import choice, random

from django.db import transaction
from django.db.models import Count, F, Min, Sum
from django.utils import timezone

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import user_from_request

from .feedback import (
    category_stats_for_user,
    pick_generate_category,
    preferred_categories_for_user,
    record_question_published,
    record_question_skipped,
    skipped_stats_for_user,
    user_avoid_texts,
)
from .llm import deepen_draft, generate_question, persist_generated
from .models import Question, QuestionSuggestion, QuestionView
from posts.models import Post
from .ritual import complete_ritual, current_streak, get_or_create_today_ritual
from .serializers import QuestionSerializer, QuestionSuggestionSerializer

# Serendipity — fraction of prompts drawn from outside the user's preferred
# categories. Keeps the experience from becoming a filter bubble.
SERENDIPITY_RATE = 0.20

ALL_CATEGORIES = [c for c, _ in Question.CATEGORY_CHOICES]


class QuestionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to creative prompts.

    ``GET /api/questions/next/?lang=en&category=historical&personalize=1``
        Returns one question the user has not seen before. When
        ``personalize=1`` and the user has interests or answered history,
        the selection is biased toward their preferred categories
        (with a 20% serendipity slice from outside those categories).

    ``POST /api/questions/generate/?lang=en&category=historical``
        Generate a fresh prompt with the configured LLM provider. Falls
        back to ``next`` if no provider is set or the call fails.

    ``POST /api/questions/suggest/``
        Authenticated users submit a prompt idea for moderator review.

    ``GET /api/questions/stats/``
        Returns the caller's per-category answered counts (feedback loop).

    ``POST /api/questions/{id}/answer/``
        Mark a question as answered (user published a post inspired by it).
    """

    serializer_class = QuestionSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = Question.objects.filter(is_active=True)
        language = self.request.query_params.get('lang')
        if language in ('en', 'ar'):
            qs = qs.filter(language=language)
        category = self.request.query_params.get('category')
        if category and category != 'all':
            qs = qs.filter(category=category)
        return qs

    def _pick_from_pool(self, queryset, user):
        seen_ids = (
            QuestionView.objects.filter(user=user).values_list('question_id', flat=True)
            if user
            else []
        )
        available = queryset.exclude(id__in=seen_ids) if seen_ids else queryset
        if not available.exists():
            available = queryset  # recycle oldest views once everything seen

        min_shown = available.aggregate(m=Min('times_shown'))['m'] or 0
        least_seen = list(available.filter(times_shown=min_shown).order_by('?')[:20])
        pool = least_seen or list(available.order_by('?')[:20])
        if not pool:
            return None
        return pool[0] if len(pool) == 1 else choice(pool)

    def _personalized_queryset(self, base_qs, user):
        preferred = preferred_categories_for_user(user)
        if not preferred:
            return base_qs

        if random() < SERENDIPITY_RATE:
            outside = base_qs.exclude(category__in=preferred)
            if outside.exists():
                return outside
        return base_qs.filter(category__in=preferred)

    @action(detail=False, methods=['get'], url_path='next')
    def next(self, request):
        user = user_from_request(request)
        lang = request.query_params.get('lang', 'en')
        category = request.query_params.get('category', 'all')
        personalize = request.query_params.get('personalize', '0') in ('1', 'true', 'yes')

        queryset = self.get_queryset()
        if personalize and (not category or category == 'all'):
            queryset = self._personalized_queryset(queryset, user)

        question = self._pick_from_pool(queryset, user)
        if not question:
            return Response({'detail': 'No questions available.'}, status=404)

        if user:
            QuestionView.objects.get_or_create(user=user, question=question)
            Question.objects.filter(pk=question.pk).update(times_shown=F('times_shown') + 1)

        return Response(QuestionSerializer(question).data)

    @action(detail=False, methods=['post'], url_path='generate')
    def generate(self, request):
        user = user_from_request(request)
        lang = request.query_params.get('lang', 'en')
        category = request.query_params.get('category', 'all')

        interests = list(getattr(user, 'interests', []) or []) if user else []
        gen_category = pick_generate_category(user, category if category != 'all' else None)
        avoid = user_avoid_texts(user, lang)

        text = generate_question(
            language=lang,
            category=gen_category,
            interests=interests,
            avoid=avoid,
            preferred_categories=preferred_categories_for_user(user) if user else [],
        )

        if not text:
            return self.next(request)

        question = persist_generated(
            text,
            language=lang,
            category=gen_category if gen_category else 'surreal',
        )

        if user:
            QuestionView.objects.get_or_create(user=user, question=question)
            Question.objects.filter(pk=question.pk).update(times_shown=F('times_shown') + 1)

        return Response(QuestionSerializer(question).data)

    @action(
        detail=False,
        methods=['get', 'post'],
        permission_classes=[IsAuthenticated],
        url_path='suggest',
    )
    def suggest(self, request):
        """Submit or list the current user's prompt suggestions."""
        user = user_from_request(request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)

        if request.method == 'GET':
            qs = QuestionSuggestion.objects.filter(submitted_by=user).order_by('-created_at')[:25]
            return Response(QuestionSuggestionSerializer(qs, many=True).data)

        text = (request.data.get('text') or '').strip()
        category = request.data.get('category') or 'surreal'
        language = request.data.get('language') or request.query_params.get('lang', 'en')

        if not text or len(text) < 8:
            return Response({'detail': 'Question text is too short.'}, status=400)
        if category not in dict(Question.CATEGORY_CHOICES):
            return Response({'detail': 'Invalid category.'}, status=400)
        if language not in ('en', 'ar'):
            language = 'en'

        suggestion, created = QuestionSuggestion.objects.get_or_create(
            text=text,
            language=language,
            defaults={
                'category': category,
                'submitted_by': user,
            },
        )
        status_code = 201 if created else 200
        return Response(QuestionSuggestionSerializer(suggestion).data, status=status_code)

    @action(
        detail=False,
        methods=['get', 'post'],
        permission_classes=[IsAuthenticated],
        url_path='daily',
    )
    def daily(self, request):
        """Today's morning/evening ritual prompt — deterministic per user+date.

        ``GET /api/questions/daily/?period=morning``
            Returns the prompt for the current window (auto-detects period if
            omitted), whether it's been completed, and the current streak.

        ``POST /api/questions/daily/?period=morning``
            Marks the current ritual as completed. Idempotent.
        """
        user = user_from_request(request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)

        lang = request.query_params.get('lang', 'en')
        period = request.query_params.get('period')
        if period not in ('morning', 'evening'):
            period = None  # let ritual module auto-detect

        if request.method == 'POST':
            complete_ritual(user, period=period)

        ritual, question, _created = get_or_create_today_ritual(
            user, period=period, language=lang if lang in ('en', 'ar') else 'en',
        )
        if not ritual or not question:
            # Empty inventory is a normal empty state, not a missing route.
            return Response({
                'available': False,
                'detail': 'No ritual prompt available.',
                'ritual': None,
                'question': None,
            })

        return Response({
            'ritual': {
                'period': ritual.period,
                'date': ritual.date.isoformat(),
                'completed': ritual.completed_at is not None,
            },
            'question': QuestionSerializer(question).data,
            'streak': current_streak(user),
        })

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[IsAuthenticated],
        url_path='deepen',
    )
    def deepen(self, request):
        """Writing Buddy — a reflective question about the user's in-progress draft.

        Body: ``{text, lang?}``. Returns ``{prompt}`` — a single question that
        opens a new angle on what they're writing. Always returns something:
        uses the configured LLM provider when available, else falls back to a
        curated bank of reflective prompts.
        """
        draft = (request.data.get('text') or '').strip()
        if len(draft) < 8:
            return Response(
                {'detail': 'Write a few more words first, then ask for a reflection.'},
                status=400,
            )
        lang = request.data.get('lang') or request.query_params.get('lang', 'en')
        if lang not in ('en', 'ar'):
            lang = 'en'
        user = user_from_request(request)
        interests = list(getattr(user, 'interests', []) or []) if user else []
        prompt = deepen_draft(draft_text=draft, language=lang, interests=interests)
        if not prompt:
            return Response({'detail': 'Could not generate a reflection right now.'}, status=503)
        return Response({'prompt': prompt})

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[IsAuthenticated],
        url_path='stats',
    )
    def stats(self, request):
        """Per-category answered counts for the calling user (feedback loop)."""
        user = user_from_request(request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)
        return Response({
            'answered_by_category': category_stats_for_user(user),
            'skipped_by_category': skipped_stats_for_user(user),
            'preferred_categories': preferred_categories_for_user(user),
            'interests': list(getattr(user, 'interests', []) or []),
        })

    @action(
        detail=True,
        methods=['get'],
        permission_classes=[AllowAny],
        url_path='answered-by',
    )
    def answered_by(self, request, pk=None):
        """List users who answered this question (posted inspired by it).

        Returns a lightweight roster — id, name, avatar — so the UI can show
        "people who answered this" without leaking emails or other PII.
        """
        try:
            question = self.get_queryset().get(pk=pk)
        except Question.DoesNotExist:
            return Response({'detail': 'Question not found.'}, status=404)

        views = (
            QuestionView.objects
            .filter(question=question, answered=True)
            .select_related('user')
            .order_by('-viewed_at')[:50]
        )
        users = []
        for v in views:
            u = v.user
            if not u:
                continue
            avatar = None
            if getattr(u, 'avatar', None) and u.avatar:
                avatar = (
                    request.build_absolute_uri(u.avatar.url)
                    if request
                    else u.avatar.url
                )
            full = f"{u.first_name or ''} {u.last_name or ''}".strip() or u.username
            users.append({
                'id': u.id,
                'username': u.username,
                'name': full,
                'avatar': avatar,
                'answered_at': v.viewed_at.isoformat(),
            })
        return Response({'question_id': question.id, 'count': len(users), 'users': users})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='answer')
    def answer(self, request, pk=None):
        """Mark a question as answered (the user published a post inspired by it)."""
        user = user_from_request(request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)

        try:
            question = self.get_queryset().get(pk=pk)
        except Question.DoesNotExist:
            return Response({'detail': 'Question not found.'}, status=404)

        QuestionView.objects.update_or_create(
            user=user,
            question=question,
            defaults={'answered': True, 'skipped': False},
        )
        Question.objects.filter(pk=question.pk).update(times_answered=F('times_answered') + 1)
        return Response({'answered': True, 'question_id': question.id})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='relay')
    def relay(self, request, pk=None):
        """Up to 5 kindred creators with overlapping interests."""
        user = user_from_request(request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)
        try:
            question = self.get_queryset().get(pk=pk)
        except Question.DoesNotExist:
            return Response({'detail': 'Question not found.'}, status=404)

        my_interests = {str(i).strip().lower() for i in (getattr(user, 'interests', None) or []) if str(i).strip()}
        if not my_interests:
            return Response({'question_id': question.id, 'users': []})

        from users.models import User

        scored = []
        for candidate in User.objects.exclude(id=user.id).only(
            'id', 'username', 'first_name', 'last_name', 'avatar', 'interests'
        )[:200]:
            theirs = {str(i).strip().lower() for i in (candidate.interests or []) if str(i).strip()}
            overlap = my_interests & theirs
            if not overlap:
                continue
            avatar = None
            if getattr(candidate, 'avatar', None) and candidate.avatar:
                avatar = request.build_absolute_uri(candidate.avatar.url) if request else candidate.avatar.url
            name = f"{candidate.first_name or ''} {candidate.last_name or ''}".strip() or candidate.username
            scored.append((len(overlap), {
                'id': candidate.id,
                'username': candidate.username,
                'name': name,
                'avatar': avatar,
                'overlap': sorted(overlap),
            }))
        scored.sort(key=lambda row: row[0], reverse=True)
        return Response({
            'question_id': question.id,
            'users': [row[1] for row in scored[:5]],
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='skip')
    def skip(self, request, pk=None):
        """Record that the user skipped this prompt — lowers category weight."""
        user = user_from_request(request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)
        try:
            question = self.get_queryset().get(pk=pk)
        except Question.DoesNotExist:
            return Response({'detail': 'Question not found.'}, status=404)
        record_question_skipped(user, question)
        return Response({'skipped': True, 'question_id': question.id})

    @action(
        detail=False,
        methods=['get'],
        permission_classes=[IsAuthenticated],
        url_path='history',
    )
    def history(self, request):
        """Recent prompts shown to the user, with answer/skip/publish state."""
        user = user_from_request(request)
        if not user:
            return Response({'detail': 'Authentication required.'}, status=401)
        views = (
            QuestionView.objects
            .filter(user=user)
            .select_related('question')
            .order_by('-viewed_at')[:40]
        )
        published_ids = set(
            Post.objects.filter(user=user, inspiration_question__isnull=False)
            .values_list('inspiration_question_id', flat=True)
        )
        rows = []
        for view in views:
            q = view.question
            if not q.is_active:
                continue
            rows.append({
                'question': QuestionSerializer(q, context={'request': request}).data,
                'viewed_at': view.viewed_at.isoformat(),
                'answered': view.answered,
                'skipped': view.skipped,
                'published': q.id in published_ids,
            })
        return Response({'results': rows, 'count': len(rows)})


@transaction.atomic
def promote_suggestion(suggestion: QuestionSuggestion, *, reviewer_note: str = '') -> Question:
    """Approve a community suggestion: create the Question and mark approved."""
    question, _ = Question.objects.get_or_create(
        text=suggestion.text,
        language=suggestion.language,
        defaults={
            'category': suggestion.category,
            'tags': ['community'],
            'is_active': True,
        },
    )
    suggestion.status = 'approved'
    suggestion.reviewer_note = reviewer_note
    suggestion.reviewed_at = timezone.now()
    suggestion.save(update_fields=['status', 'reviewer_note', 'reviewed_at'])
    return question
