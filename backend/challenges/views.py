from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request

from .models import Challenge, Submission
from .serializers import ChallengeSerializer, SubmissionSerializer


class ChallengeViewSet(viewsets.ModelViewSet):
    serializer_class = ChallengeSerializer

    def get_permissions(self):
        if self.action == 'submissions' and self.request.method == 'POST':
            return [IsAuthenticated()]
        if self.action == 'user_entries':
            return [AllowAny()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        qs = Challenge.objects.all()
        ctype = self.request.query_params.get('type')
        if ctype and ctype != 'all':
            qs = qs.filter(type=ctype)
        return qs.order_by('-created_at')

    @action(detail=False, methods=['get'])
    def daily(self, request):
        challenge = (
            Challenge.objects.filter(is_daily=True, is_active=True)
            .order_by('-created_at')
            .first()
        )
        if not challenge:
            challenge = Challenge.objects.order_by('-created_at').first()
        if not challenge:
            return Response(None)
        return Response(ChallengeSerializer(challenge).data)

    @action(detail=False, methods=['get'])
    def archive(self, request):
        qs = Challenge.objects.filter(is_daily=False).order_by('-created_at')
        ctype = request.query_params.get('type')
        if ctype and ctype != 'all':
            qs = qs.filter(type=ctype)
        page = max(int(request.query_params.get('page', 1) or 1), 1)
        page_size = max(min(int(request.query_params.get('page_size', 12) or 12), 24), 1)
        start = (page - 1) * page_size
        end = start + page_size
        items = list(qs[start:end])
        return Response({
            'results': ChallengeSerializer(items, many=True).data,
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
            'challenges': Challenge.objects.count(),
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
            submission = Submission.objects.create(
                challenge=challenge,
                user=user,
                content=content,
            )
            return Response(SubmissionSerializer(submission).data, status=201)
        subs = challenge.submissions.select_related('challenge', 'user').all()[:20]
        return Response(SubmissionSerializer(subs, many=True).data)