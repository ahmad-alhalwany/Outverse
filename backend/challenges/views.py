from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request

from .models import Challenge, Submission
from .serializers import ChallengeSerializer, SubmissionSerializer


class ChallengeViewSet(viewsets.ModelViewSet):
    serializer_class = ChallengeSerializer

    def get_permissions(self):
        if self.action in ('submissions',):
            if self.request.method == 'POST':
                return [IsAuthenticated()]
        if self.action == 'user_entries':
            return [AllowAny()]
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
        return Response(ChallengeSerializer(qs[:12], many=True).data)

    @action(detail=False, methods=['get'])
    def user_entries(self, request):
        """Submissions for a user (?user=id for profiles, else authenticated user)."""
        viewer = user_from_request(request)
        user_id = request.query_params.get('user') or request.query_params.get('user_id')
        if not user_id and viewer:
            user_id = viewer.id
        if not user_id:
            return Response([])
        subs = (
            Submission.objects.filter(user_id=user_id)
            .select_related('challenge')
            .order_by('-submitted_at')[:24]
        )
        results = []
        for s in subs:
            results.append({
                'id': s.id,
                'content': s.content,
                'submitted_at': s.submitted_at,
                'is_approved': s.is_approved,
                'challenge': {
                    'id': s.challenge_id,
                    'title': s.challenge.title,
                    'type': s.challenge.type,
                    'cover_url': s.challenge.cover_url,
                },
            })
        return Response(results)

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
            return Response(
                SubmissionSerializer(submission).data, status=201
            )
        subs = challenge.submissions.all()[:20]
        return Response(SubmissionSerializer(subs, many=True).data)
