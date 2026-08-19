from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from outverse.auth_utils import require_user, user_from_request

from .models import ContentAppeal, FlaggedContent, UserReport
from .serializers import ContentAppealSerializer, FlaggedContentSerializer


def _user_owns_content(user, content_type: str, object_id: int) -> bool:
    if content_type == 'post':
        from posts.models import Post
        return Post.objects.filter(pk=object_id, user_id=user.id).exists()
    if content_type == 'comment':
        from posts.models import Comment
        return Comment.objects.filter(pk=object_id, user_id=user.id).exists()
    if content_type == 'reel':
        from reels.models import Reel
        return Reel.objects.filter(pk=object_id, user_id=user.id).exists()
    if content_type == 'reel_comment':
        from reels.models import ReelComment
        return ReelComment.objects.filter(pk=object_id, user_id=user.id).exists()
    if content_type == 'story':
        from stories.models import Story
        return Story.objects.filter(pk=object_id, user_id=user.id).exists()
    return False


class FlaggedContentViewSet(viewsets.ModelViewSet):
    queryset = FlaggedContent.objects.all().order_by('-created_at')
    serializer_class = FlaggedContentSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated()]
        return [IsAdminUser()]

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        reporter = user.username if user else 'anonymous'
        serializer.save(reporter=reporter[:100])

    def perform_update(self, serializer):
        flagged = serializer.save()
        from audit.utils import log_action
        log_action(
            self.request, 'MODERATE',
            f'Reviewed flagged {flagged.type} #{flagged.object_id}: {flagged.status}.',
        )


class ContentAppealViewSet(viewsets.ModelViewSet):
    serializer_class = ContentAppealSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = user_from_request(self.request)
        if not user:
            return ContentAppeal.objects.none()
        if user.is_staff:
            return ContentAppeal.objects.all().order_by('-created_at')
        return ContentAppeal.objects.filter(user=user).order_by('-created_at')

    def get_permissions(self):
        if self.action in ('partial_update', 'update'):
            return [IsAdminUser()]
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err

        content_type = (request.data.get('content_type') or '').strip().lower()
        valid_types = {choice[0] for choice in FlaggedContent.CONTENT_TYPES}
        if content_type not in valid_types or content_type == 'live_chat':
            return Response({'error': 'Invalid content_type.'}, status=400)

        try:
            object_id = int(request.data.get('object_id'))
        except (TypeError, ValueError):
            return Response({'error': 'object_id is required.'}, status=400)

        reason = (request.data.get('reason') or '').strip()
        if len(reason) < 10:
            return Response({'error': 'Reason must be at least 10 characters.'}, status=400)

        if not _user_owns_content(user, content_type, object_id):
            return Response({'error': 'You can only appeal your own content.'}, status=403)

        flagged_content = None
        flagged_content_id = request.data.get('flagged_content')
        if flagged_content_id is not None:
            try:
                flagged_content = FlaggedContent.objects.get(pk=int(flagged_content_id))
            except (TypeError, ValueError, FlaggedContent.DoesNotExist):
                return Response({'error': 'Invalid flagged_content.'}, status=400)

        appeal = ContentAppeal.objects.create(
            user=user,
            flagged_content=flagged_content,
            content_type=content_type,
            object_id=object_id,
            reason=reason[:5000],
        )
        serializer = self.get_serializer(appeal)
        return Response(serializer.data, status=201)

    def partial_update(self, request, *args, **kwargs):
        appeal = self.get_object()
        status = (request.data.get('status') or '').strip().lower()
        valid_statuses = {choice[0] for choice in ContentAppeal.STATUS_CHOICES}
        if status and status not in valid_statuses:
            return Response({'error': 'Invalid status.'}, status=400)

        staff_note = request.data.get('staff_note')
        update_fields = []
        if status:
            appeal.status = status
            update_fields.append('status')
        if staff_note is not None:
            appeal.staff_note = str(staff_note)[:5000]
            update_fields.append('staff_note')

        if update_fields:
            appeal.save(update_fields=update_fields)

        if status == 'approved':
            from moderation.hooks import restore_moderated_content

            restore_moderated_content(
                content_type=appeal.content_type,
                object_id=appeal.object_id,
            )
            if appeal.flagged_content_id:
                FlaggedContent.objects.filter(pk=appeal.flagged_content_id).update(status='approved')

        if status == 'rejected' and appeal.flagged_content_id:
            FlaggedContent.objects.filter(pk=appeal.flagged_content_id).update(status='rejected')

        serializer = self.get_serializer(appeal)
        return Response(serializer.data)


class ReportUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user, err = require_user(request)
        if err:
            return err
        from django.contrib.auth import get_user_model
        User = get_user_model()
        reported_id = request.data.get('user_id')
        reason = (request.data.get('reason') or 'other').lower()
        details = (request.data.get('details') or '').strip()
        valid = {c for c, _ in UserReport.REPORT_REASONS}
        if reason not in valid:
            return Response({'error': 'Invalid reason.'}, status=400)
        try:
            reported_id = int(reported_id)
        except (TypeError, ValueError):
            return Response({'error': 'user_id is required.'}, status=400)
        if reported_id == user.id:
            return Response({'error': 'Invalid target.'}, status=400)
        if not User.objects.filter(id=reported_id).exists():
            return Response({'error': 'User not found.'}, status=404)
        report = UserReport.objects.create(
            reporter=user,
            reported_user_id=reported_id,
            reason=reason,
            details=details[:2000],
        )
        return Response({'id': report.id, 'status': report.status}, status=201)
