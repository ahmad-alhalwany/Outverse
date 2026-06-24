from django.core.cache import cache
from django.db.models import Count
from rest_framework import exceptions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user

from .models import CollaborationRequest, Idea, IdeaComment
from .serializers import CollaborationRequestSerializer, IdeaCommentSerializer, IdeaSerializer


class IdeaViewSet(viewsets.ModelViewSet):
    serializer_class = IdeaSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve", "comments"} and self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = (
            Idea.objects.select_related("owner")
            .prefetch_related("supporters", "collaborators")
            .annotate(
                collaboration_request_count=Count("collaboration_requests", distinct=True),
                discussion_count=Count("idea_comments", distinct=True),
            )
        )
        category = self.request.query_params.get("category")
        status_filter = self.request.query_params.get("status")
        if category:
            queryset = queryset.filter(category=category)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def list(self, request, *args, **kwargs):
        cache_key = f"ideas:list:{request.get_full_path()}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)
        response = super().list(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, 60)
        return response

    @action(detail=False, methods=["get"], permission_classes=[AllowAny], url_path="featured")
    def featured(self, request):
        ideas = self.get_queryset()[:5]
        return Response(IdeaSerializer(ideas, many=True).data)

    def perform_create(self, serializer):
        user, err = require_user(self.request)
        if err:
            raise exceptions.PermissionDenied(err.data.get("error", "Authentication required."))
        serializer.save(owner=user)

    def perform_update(self, serializer):
        idea = self.get_object()
        user, err = require_user(self.request)
        if err:
            raise exceptions.PermissionDenied(err.data.get("error", "Authentication required."))
        if idea.owner_id != user.id:
            raise exceptions.PermissionDenied("Only the owner can update this idea.")
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.owner_id != user.id:
            return Response({"detail": "Only the owner can delete this idea."}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="vote")
    def vote(self, request, pk=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.votes.filter(id=user.id).exists():
            idea.votes.remove(user)
            voted = False
        else:
            idea.votes.add(user)
            voted = True
        return Response({"voted": voted, "supporters": idea.votes.count()})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="apply")
    def apply(self, request, pk=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.owner_id == user.id:
            return Response({"detail": "You cannot apply to collaborate on your own idea."}, status=status.HTTP_400_BAD_REQUEST)
        if not idea.roles_needed:
            return Response({"detail": "This idea is not currently seeking collaborators."}, status=status.HTTP_400_BAD_REQUEST)

        serializer = CollaborationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        if CollaborationRequest.objects.filter(idea=idea, user=user, role=role).exists():
            return Response({"detail": "You have already applied for this role."}, status=status.HTTP_400_BAD_REQUEST)

        collaboration_request = CollaborationRequest.objects.create(
            idea=idea,
            user=user,
            role=role,
            message=serializer.validated_data.get("message", ""),
        )
        return Response(CollaborationRequestSerializer(collaboration_request).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], permission_classes=[IsAuthenticated], url_path="applicants")
    def applicants(self, request, pk=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.owner_id != user.id:
            return Response({"detail": "Only the idea owner can view applicants."}, status=status.HTTP_403_FORBIDDEN)
        applicants = CollaborationRequest.objects.filter(idea=idea).select_related("user", "idea")
        return Response(CollaborationRequestSerializer(applicants, many=True).data)

    @action(detail=True, methods=["get", "post"], url_path="comments")
    def comments(self, request, pk=None):
        idea = self.get_object()
        if request.method == "GET":
            comments = IdeaComment.objects.filter(idea=idea).select_related("user", "idea")
            return Response(IdeaCommentSerializer(comments, many=True).data)

        user, err = require_user(request)
        if err:
            return err
        serializer = IdeaCommentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = IdeaComment.objects.create(
            idea=idea,
            user=user,
            content=serializer.validated_data["content"],
        )
        return Response(IdeaCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], permission_classes=[IsAuthenticated], url_path=r"comments/(?P<comment_id>[^/.]+)")
    def comment_detail(self, request, pk=None, comment_id=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        try:
            comment = IdeaComment.objects.select_related("user", "idea").get(id=comment_id, idea=idea)
        except IdeaComment.DoesNotExist:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        if comment.user_id != user.id:
            return Response({"detail": "You can only modify your own comments."}, status=status.HTTP_403_FORBIDDEN)

        if request.method == "DELETE":
            comment.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = IdeaCommentSerializer(comment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)