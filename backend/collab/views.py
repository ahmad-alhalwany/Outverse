from django.db.models import Q
from rest_framework import exceptions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, ThrottleMixin

from outverse.auth_utils import require_user

from users.models import User

from .models import Project, ProjectMember, ProjectTask
from .serializers import ProjectSerializer, ProjectTaskSerializer


class ProjectViewSet(ThrottleMixin, viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    throttle_scopes = {
        'create': 'content.post_create',
        'perform_create': 'content.post_create',
        'update': 'content.draft_write',
        'partial_update': 'content.draft_write',
        'perform_update': 'content.draft_write',
        'destroy': 'content.draft_write',
        'perform_destroy': 'content.draft_write',
        'list': 'anon.read',
        'retrieve': 'anon.read',
    }

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            Project.objects.filter(Q(owner_id=user.id) | Q(members__user_id=user.id))
            .distinct()
            .prefetch_related('members__user', 'tasks__assignee')
            .select_related('owner')
        )

    def perform_create(self, serializer):
        project = serializer.save(owner=self.request.user)
        ProjectMember.objects.create(project=project, user=self.request.user, role='Owner')

    def perform_update(self, serializer):
        project = self.get_object()
        if not self._is_owner(project, self.request.user):
            raise exceptions.PermissionDenied('Only the project owner can update this project.')
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        project = self.get_object()
        if not self._is_owner(project, request.user):
            return Response({'error': 'Only the project owner can delete this project.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    def _is_owner(self, project, user):
        return project.owner_id == user.id

    @action(detail=True, methods=['post'])
    def members(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        project = self.get_object()
        if not self._is_owner(project, user):
            return Response({'error': 'Only the project owner can add members.'}, status=status.HTTP_403_FORBIDDEN)
        username = (request.data.get('username') or '').strip()
        try:
            member_user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        member, created = ProjectMember.objects.get_or_create(
            project=project,
            user=member_user,
            defaults={
                'role': request.data.get('role', ''),
                'current_task': request.data.get('current_task', ''),
            },
        )
        if not created:
            return Response({'error': 'User is already a member.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def tasks(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        project = self.get_object()
        if not self._is_owner(project, user):
            return Response({'error': 'Only the project owner can add tasks.'}, status=status.HTTP_403_FORBIDDEN)
        title = (request.data.get('title') or '').strip()
        if not title:
            return Response({'error': 'A task title is required.'}, status=status.HTTP_400_BAD_REQUEST)
        assignee_id = request.data.get('assignee_id') or None
        if assignee_id is not None and not project.members.filter(user_id=assignee_id).exists():
            return Response({'error': 'Assignee must be a project member.'}, status=status.HTTP_400_BAD_REQUEST)
        task = ProjectTask.objects.create(
            project=project,
            title=title,
            assignee_id=assignee_id,
        )
        return Response(ProjectTaskSerializer(task).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='update-task')
    def update_task(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        project = self.get_object()
        is_member = self._is_owner(project, user) or project.members.filter(user_id=user.id).exists()
        if not is_member:
            return Response({'error': 'Only project members can update tasks.'}, status=status.HTTP_403_FORBIDDEN)
        new_status = request.data.get('status')
        if new_status not in dict(ProjectTask.STATUS_CHOICES):
            return Response({'error': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            task = project.tasks.get(pk=request.data.get('task_id'))
        except ProjectTask.DoesNotExist:
            return Response({'error': 'Task not found.'}, status=status.HTTP_404_NOT_FOUND)
        task.status = new_status
        task.save(update_fields=['status', 'updated_at'])
        return Response(ProjectTaskSerializer(task).data)
