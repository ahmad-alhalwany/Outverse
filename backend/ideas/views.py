from django.core.cache import cache
from django.db import transaction
from django.db.models import Case, Count, F, IntegerField, When
from rest_framework import exceptions, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request
from users.models import Profile

from .collab_bridge import sync_collab_project
from .constellation import build_idea_constellation
from .models import CollaborationRequest, Idea, IdeaComment, IdeaPledge, SavedIdea
from .notifications import (
    notify_idea_application_response,
    notify_idea_apply,
    notify_idea_comment,
    notify_idea_pledge,
)
from .serializers import (
    CollaborationRequestSerializer,
    IdeaCommentSerializer,
    IdeaPledgeSerializer,
    IdeaSerializer,
)


def _clear_ideas_list_cache():
    # Best-effort bust for anonymous list caches (locmem/redis without patterns).
    cache.delete('ideas:list:/api/ideas/')


def _moderate_idea(idea, user):
    try:
        from moderation.hooks import enforce_moderation_result, soft_moderate_content

        result = soft_moderate_content(
            text=f'{idea.title}\n{idea.description}',
            content_type='idea',
            object_id=idea.id,
            user=user,
        )
        if result.get('hard_block'):
            enforce_moderation_result(
                result,
                content_type='idea',
                object_id=idea.id,
            )
    except Exception:
        pass


class IdeaViewSet(viewsets.ModelViewSet):
    serializer_class = IdeaSerializer

    def get_permissions(self):
        if self.action in {
            "list", "retrieve", "comments", "constellation", "crew", "featured",
        } and self.request.method == "GET":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        viewer = user_from_request(self.request)
        if viewer:
            ctx['viewer'] = viewer
            ctx['voted_idea_ids'] = set(
                viewer.voted_ideas.values_list('id', flat=True)
            )
            ctx['saved_idea_ids'] = set(
                SavedIdea.objects.filter(user=viewer).values_list('idea_id', flat=True)
            )
        return ctx

    def get_queryset(self):
        queryset = (
            Idea.objects.select_related("owner", "collab_project")
            .prefetch_related("votes", "collaborators")
            .annotate(
                collaboration_request_count=Count("collaboration_requests", distinct=True),
                discussion_count=Count("idea_comments", distinct=True),
            )
        )
        viewer = user_from_request(self.request)
        owner_filter = self.request.query_params.get("owner")
        owner_id = self.request.query_params.get("owner_id")
        if owner_filter == "me" and viewer:
            queryset = queryset.filter(owner=viewer)
        elif owner_filter == "collaborating" and viewer:
            queryset = queryset.filter(collaborators=viewer).exclude(owner=viewer)
        elif owner_filter == "supporting" and viewer:
            queryset = queryset.filter(votes=viewer).exclude(owner=viewer)
        elif owner_id:
            try:
                queryset = queryset.filter(owner_id=int(owner_id))
            except (TypeError, ValueError):
                pass

        category = self.request.query_params.get("category")
        status_filter = self.request.query_params.get("status")
        ordering = self.request.query_params.get("ordering")
        tag = (self.request.query_params.get("tag") or "").strip().lstrip("#")
        if tag:
            queryset = queryset.filter(tags__icontains=f'"{tag}"')
        if category and category not in ("all", ""):
            queryset = queryset.filter(category=category)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if ordering == "trending":
            queryset = queryset.annotate(support_count=Count("votes")).order_by("-support_count", "-created_at")
        elif ordering == "new":
            queryset = queryset.order_by("-created_at")
        else:
            queryset = queryset.order_by("-created_at")
        return queryset

    def list(self, request, *args, **kwargs):
        if user_from_request(request):
            return super().list(request, *args, **kwargs)
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
        idea = serializer.save(owner=user)
        _moderate_idea(idea, user)
        _clear_ideas_list_cache()

    def perform_update(self, serializer):
        idea = self.get_object()
        user, err = require_user(self.request)
        if err:
            raise exceptions.PermissionDenied(err.data.get("error", "Authentication required."))
        if idea.owner_id != user.id and not user.is_staff:
            raise exceptions.PermissionDenied("Only the owner can update this idea.")
        serializer.save()
        _clear_ideas_list_cache()

    def destroy(self, request, *args, **kwargs):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.owner_id != user.id and not user.is_staff:
            return Response({"detail": "Only the owner can delete this idea."}, status=status.HTTP_403_FORBIDDEN)
        response = super().destroy(request, *args, **kwargs)
        _clear_ideas_list_cache()
        return response

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
        _clear_ideas_list_cache()
        return Response({"voted": voted, "supporters": idea.votes.count()})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="pledge")
    def pledge(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        try:
            amount = int(request.data.get("amount"))
        except (TypeError, ValueError):
            amount = 0
        if amount <= 0:
            return Response({"detail": "Amount must be a positive number of coins."}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            idea = Idea.objects.select_for_update().get(pk=pk)
            if idea.owner_id == user.id:
                return Response({"detail": "You cannot pledge to your own idea."}, status=status.HTTP_400_BAD_REQUEST)
            profile = Profile.objects.select_for_update().get_or_create(user=user)[0]
            if profile.points < amount:
                return Response(
                    {"detail": "Insufficient coins.", "balance": profile.points},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.points = F("points") - amount
            profile.save(update_fields=["points"])
            owner_profile = Profile.objects.select_for_update().get_or_create(user_id=idea.owner_id)[0]
            owner_profile.points = F("points") + amount
            owner_profile.save(update_fields=["points"])
            pledge = IdeaPledge.objects.create(
                idea=idea,
                user=user,
                amount=amount,
                is_anonymous=bool(request.data.get('anonymous')),
            )
            Idea.objects.filter(pk=idea.pk).update(funding_raised=F("funding_raised") + amount)
            profile.refresh_from_db(fields=["points"])
            idea.refresh_from_db(fields=["funding_raised"])

        notify_idea_pledge(idea=idea, actor=user, amount=amount)

        return Response(
            {
                "pledge": IdeaPledgeSerializer(pledge).data,
                "funding_raised": idea.funding_raised,
                "balance": profile.points,
            },
            status=status.HTTP_201_CREATED,
        )

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
        notify_idea_apply(idea=idea, actor=user, role=role)
        return Response(CollaborationRequestSerializer(collaboration_request).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated], url_path="toggle-save")
    def toggle_save(self, request, pk=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        with transaction.atomic():
            existing = SavedIdea.objects.select_for_update().filter(user=user, idea=idea).first()
            if existing:
                existing.delete()
                saved = False
            else:
                SavedIdea.objects.get_or_create(user=user, idea=idea)
                saved = True
        return Response({"saved": saved, "is_saved": saved})

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated], url_path="saved")
    def saved(self, request):
        user, err = require_user(request)
        if err:
            return err
        idea_ids = list(
            SavedIdea.objects.filter(user=user)
            .order_by('-created_at')
            .values_list('idea_id', flat=True)
        )
        if not idea_ids:
            return Response([])
        ordering = Case(
            *[When(id=idea_id, then=position) for position, idea_id in enumerate(idea_ids)],
            output_field=IntegerField(),
        )
        ideas = Idea.objects.filter(id__in=idea_ids).order_by(ordering)
        serializer = self.get_serializer(ideas, many=True)
        return Response(serializer.data)

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

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[IsAuthenticated],
        url_path=r"applicants/(?P<request_id>[^/.]+)/respond",
    )
    def respond_applicant(self, request, pk=None, request_id=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.owner_id != user.id:
            return Response({"detail": "Only the idea owner can respond to applicants."}, status=status.HTTP_403_FORBIDDEN)
        try:
            collab_req = CollaborationRequest.objects.select_related("user").get(
                pk=request_id, idea=idea,
            )
        except CollaborationRequest.DoesNotExist:
            return Response({"detail": "Applicant not found."}, status=status.HTTP_404_NOT_FOUND)
        action_name = (request.data.get("action") or "").strip().lower()
        project = None
        if action_name == "accept":
            collab_req.status = CollaborationRequest.STATUS_ACCEPTED
            collab_req.save(update_fields=["status"])
            idea.collaborators.add(collab_req.user)
            project = sync_collab_project(
                idea,
                new_member=collab_req.user,
                member_role=collab_req.role,
            )
            if idea.status == 'proposed':
                idea.status = 'in_progress'
                idea.save(update_fields=['status'])
            notify_idea_application_response(idea=idea, applicant=collab_req.user, accepted=True)
        elif action_name == "reject":
            collab_req.status = CollaborationRequest.STATUS_REJECTED
            collab_req.save(update_fields=["status"])
            notify_idea_application_response(idea=idea, applicant=collab_req.user, accepted=False)
        else:
            return Response({"detail": "action must be accept or reject."}, status=status.HTTP_400_BAD_REQUEST)
        payload = CollaborationRequestSerializer(collab_req).data
        if project is not None:
            payload['collab_project_id'] = project.id
            payload['idea_status'] = idea.status
        return Response(payload)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated], url_path='launch-collab')
    def launch_collab(self, request, pk=None):
        idea = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if idea.owner_id != user.id:
            return Response(
                {"detail": "Only the idea owner can launch a collab project."},
                status=status.HTTP_403_FORBIDDEN,
            )
        project = sync_collab_project(idea)
        if idea.status == 'proposed':
            idea.status = 'in_progress'
            idea.save(update_fields=['status'])
        return Response({'collab_project_id': project.id, 'status': idea.status})

    @action(detail=True, methods=['get'], url_path='constellation')
    def constellation(self, request, pk=None):
        idea = self.get_object()
        return Response(build_idea_constellation(idea))

    @action(detail=False, methods=['post'], url_path='coach')
    def coach(self, request):
        """Idea Coach — clearer title, milestones, constellation questions."""
        user, err = require_user(request)
        if err:
            return err
        from outverse.ai_coaches import coach_idea
        lang = (request.data.get('lang') or request.query_params.get('lang') or 'en')[:2]
        result = coach_idea(
            title=request.data.get('title') or '',
            description=request.data.get('description') or '',
            language=lang if lang in ('en', 'ar') else 'en',
        )
        return Response(result)

    @action(detail=True, methods=['get'], url_path='crew')
    def crew(self, request, pk=None):
        idea = self.get_object()
        project = getattr(idea, 'collab_project', None)
        if project is None:
            return Response({
                'collab_project_id': None,
                'members': [],
                'milestones': idea.milestones or [],
                'tasks': [],
                'pledges': {'count': 0, 'total_amount': 0, 'anonymous_count': 0},
                'chat_room_id': None,
                'collab_url': None,
            })

        from chat.models import ChatRoom

        members = [
            {
                'id': m.user_id,
                'username': m.user.username,
                'first_name': m.user.first_name,
                'last_name': m.user.last_name,
                'avatar': m.user.avatar.url if getattr(m.user, 'avatar', None) and m.user.avatar else None,
                'role': m.role,
            }
            for m in project.members.select_related('user')
        ]
        tasks = list(
            project.tasks.values('id', 'title', 'status', 'assignee_id').order_by('status', '-updated_at')
        )
        pledge_qs = idea.pledges.all()
        pledges = {
            'count': pledge_qs.count(),
            'total_amount': sum(p.amount for p in pledge_qs),
            'anonymous_count': pledge_qs.filter(is_anonymous=True).count(),
        }
        room_name = f'Crew: {idea.title[:80]}'
        room = (
            ChatRoom.objects.filter(name=room_name, created_by=idea.owner)
            .order_by('-created_at')
            .first()
        )
        return Response({
            'collab_project_id': project.id,
            'members': members,
            'milestones': idea.milestones or [],
            'tasks': tasks,
            'pledges': pledges,
            'chat_room_id': room.id if room else None,
            'collab_url': f'/collab?project={project.id}',
        })

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
        notify_idea_comment(idea=idea, actor=user)
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