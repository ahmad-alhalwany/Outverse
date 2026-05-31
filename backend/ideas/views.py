from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user

from .models import Idea
from .serializers import IdeaSerializer


class IdeaViewSet(viewsets.ModelViewSet):
    serializer_class = IdeaSerializer

    def get_permissions(self):
        if self.action in ('vote', 'create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        qs = Idea.objects.all().annotate(vote_count=Count('votes'))
        category = self.request.query_params.get('category')
        idea_status = self.request.query_params.get('status')
        ordering = self.request.query_params.get('ordering')

        if category and category != 'all':
            qs = qs.filter(category=category)
        if idea_status:
            qs = qs.filter(status=idea_status)

        if ordering == 'trending':
            qs = qs.order_by('-vote_count', '-created_at')
        elif ordering == 'new':
            qs = qs.order_by('-created_at')
        else:
            qs = qs.order_by('-created_at')
        return qs

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        """Toggle a user's support for an idea."""
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.votes.filter(id=user.id).exists():
            idea.votes.remove(user.id)
            voted = False
        else:
            idea.votes.add(user.id)
            voted = True
        return Response({'voted': voted, 'supporters': idea.votes.count()})

    @action(detail=False, methods=['get'])
    def featured(self, request):
        """Top ideas by number of supporters."""
        qs = Idea.objects.annotate(
            vote_count=Count('votes')
        ).order_by('-vote_count', '-created_at')[:5]
        return Response(IdeaSerializer(qs, many=True).data)
