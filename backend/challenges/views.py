from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request

from .ai import ensure_today_daily
from .models import Challenge, Submission
from .serializers import ChallengeSerializer, SubmissionSerializer


def _serializer(challenge, request):
    return ChallengeSerializer(challenge, context={'request': request})


class ChallengeViewSet(viewsets.ModelViewSet):
    serializer_class = ChallengeSerializer

    def get_permissions(self):
        if self.action in ('create',):
            return [IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        if self.action == 'submissions' and self.request.method == 'POST':
            return [IsAuthenticated()]
        if self.action == 'approve_submission':
            return [IsAuthenticated()]
        if self.action == 'ensure_daily':
            return [AllowAny()]
        return [AllowAny()]

    def get_queryset(self):
        qs = Challenge.objects.select_related('created_by').all()
        ctype = self.request.query_params.get('type')
        if ctype and ctype != 'all':
            qs = qs.filter(type=ctype)
        return qs.order_by('-created_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        """Community-published challenge; staff may also mark daily."""
        user, err = require_user(request)
        if err:
            return err
        ser = ChallengeSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        end_date = ser.validated_data.get('end_date') or (timezone.now() + timedelta(days=14))
        want_daily = bool(user.is_staff and request.data.get('is_daily'))
        if want_daily:
            Challenge.objects.filter(is_daily=True, is_active=True).update(is_daily=False)
        cover_image = ser.validated_data.get('cover_image') or request.FILES.get('cover')
        challenge = Challenge.objects.create(
            title=ser.validated_data['title'].strip(),
            description=(ser.validated_data.get('description') or '').strip(),
            type=ser.validated_data.get('type') or 'writing',
            difficulty=ser.validated_data.get('difficulty') or 'medium',
            cover_url=(ser.validated_data.get('cover_url') or '').strip(),
            cover_image=cover_image,
            is_daily=want_daily,
            is_active=True,
            is_ai_generated=False,
            created_by=user,
            end_date=end_date,
        )
        return Response(_serializer(challenge, request).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        challenge = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not (user.is_staff or challenge.created_by_id == user.id):
            return Response({'detail': 'Only the challenge author can edit this.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        challenge = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not (user.is_staff or challenge.created_by_id == user.id):
            return Response({'detail': 'Only the challenge author can delete this.'}, status=403)
        if challenge.is_daily and not user.is_staff:
            return Response({'detail': 'Daily challenges cannot be deleted by community authors.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get', 'post'])
    def daily(self, request):
        lang = (request.query_params.get('lang') or request.data.get('lang') or 'en')[:8]
        force = False
        if request.method == 'POST':
            user = user_from_request(request)
            if not (user and user.is_staff):
                return Response({'detail': 'Staff only.'}, status=403)
            force = bool(request.data.get('force'))
        challenge = ensure_today_daily(language=lang if lang in ('en', 'ar') else 'en', force=force)
        return Response(_serializer(challenge, request).data)

    @action(detail=False, methods=['post'], url_path='ensure-daily')
    def ensure_daily(self, request):
        """Idempotent: create today's bright daily if missing."""
        lang = (request.data.get('lang') or request.query_params.get('lang') or 'en')[:8]
        challenge = ensure_today_daily(language=lang if lang in ('en', 'ar') else 'en', force=False)
        return Response(_serializer(challenge, request).data)

    @action(detail=False, methods=['get'])
    def archive(self, request):
        qs = Challenge.objects.filter(is_daily=False, is_active=True).select_related('created_by').order_by('-created_at')
        ctype = request.query_params.get('type')
        if ctype and ctype != 'all':
            qs = qs.filter(type=ctype)
        page = max(int(request.query_params.get('page', 1) or 1), 1)
        page_size = max(min(int(request.query_params.get('page_size', 12) or 12), 24), 1)
        start = (page - 1) * page_size
        end = start + page_size
        items = list(qs[start:end])
        return Response({
            'results': ChallengeSerializer(items, many=True, context={'request': request}).data,
            'page': page,
            'page_size': page_size,
            'has_more': qs.count() > end,
        })

    @action(detail=False, methods=['get'])
    def user_entries(self, request):
        viewer = user_from_request(request)
        user_id = request.query_params.get('user') or request.query_params.get('user_id')
        if not user_id and viewer:
            user_id = viewer.id
        if not user_id:
            return Response([])
        subs = (
            Submission.objects.filter(user_id=user_id)
            .select_related('challenge', 'user')
            .order_by('-submitted_at')
        )
        return Response(SubmissionSerializer(subs, many=True).data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Submission.objects.count()
        approved = Submission.objects.filter(is_approved=True).count()
        success = round((approved / total) * 100) if total else 0
        return Response({
            'participants': total,
            'success_rate': success,
            'challenges': Challenge.objects.filter(is_active=True).count(),
        })

    @action(detail=True, methods=['get', 'post'])
    def submissions(self, request, pk=None):
        challenge = self.get_object()
        if request.method == 'POST':
            user, err = require_user(request)
            if err:
                return err
            content = (request.data.get('content') or '').strip()
            if not content:
                return Response({'error': 'Content is required.'}, status=400)
            if Submission.objects.filter(challenge=challenge, user=user).exists():
                return Response({'error': 'You already submitted to this challenge.'}, status=400)
            # Daily AI prompts auto-publish entries; community challenges need owner approval.
            auto_approve = bool(challenge.is_daily or challenge.is_ai_generated)
            submission = Submission.objects.create(
                challenge=challenge,
                user=user,
                content=content,
                is_approved=auto_approve,
            )
            return Response(SubmissionSerializer(submission).data, status=201)

        subs = challenge.submissions.select_related('challenge', 'user').all()
        viewer = user_from_request(request)
        is_owner = bool(
            viewer
            and (viewer.is_staff or (challenge.created_by_id and challenge.created_by_id == viewer.id))
        )
        if is_owner:
            # Owner sees all entries to moderate.
            pass
        elif viewer:
            subs = subs.filter(Q(is_approved=True) | Q(user_id=viewer.id))
        else:
            subs = subs.filter(is_approved=True)
        return Response(SubmissionSerializer(list(subs[:40]), many=True).data)

    @action(
        detail=True,
        methods=['patch'],
        url_path=r'submissions/(?P<submission_id>[^/.]+)/approve',
    )
    def approve_submission(self, request, pk=None, submission_id=None):
        challenge = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not (user.is_staff or (challenge.created_by_id and challenge.created_by_id == user.id)):
            return Response({'detail': 'Only the challenge author can moderate entries.'}, status=403)
        try:
            submission = Submission.objects.get(pk=submission_id, challenge=challenge)
        except Submission.DoesNotExist:
            return Response({'error': 'Submission not found.'}, status=404)
        approved = request.data.get('is_approved', True)
        submission.is_approved = bool(approved)
        submission.save(update_fields=['is_approved'])
        return Response(SubmissionSerializer(submission).data)
