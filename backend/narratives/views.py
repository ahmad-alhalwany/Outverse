from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request
from users.models import User

from . import ai_buddy
from .consumers import broadcast_forge_event
from .cover import resolve_cover_url
from .models import Segment, SegmentDialogue, SegmentRevision, Story, StoryCollaborator, StorySave
from .pdf_export import build_story_pdf
from .serializers import (
    SegmentDialogueSerializer,
    SegmentSerializer,
    StoryCollaboratorSerializer,
    StoryDetailSerializer,
    StorySerializer,
)


def _notify(recipient_id, actor_id, verb, text):
    try:
        from notifications.utils import create_notification
        create_notification(
            recipient_id=recipient_id,
            actor_id=actor_id,
            verb=verb,
            text=text,
            notification_type=verb,
        )
    except Exception:
        pass


class StoryViewSet(viewsets.ModelViewSet):
    def get_permissions(self):
        public_get = {
            'list', 'retrieve', 'featured', 'segments', 'dialogues', 'collaborators',
        }
        if self.action in public_get and self.request.method in ('GET', 'HEAD', 'OPTIONS'):
            return [AllowAny()]
        if self.action in (
            'create', 'segments', 'invite', 'respond_invite', 'approve_segment',
            'reject_segment', 'revise_segment', 'dialogues', 'generate_cover',
            'export_pdf', 'publish', 'toggle_save', 'remove_collaborator',
            'ai_continue', 'ai_rewrite', 'ai_outline', 'ai_character', 'ai_critique',
            'ai_inspire', 'bible', 'my_library', 'request_join', 'review_join_request',
        ):
            return [IsAuthenticated()]
        if self.action in ('update', 'partial_update', 'destroy'):
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return StoryDetailSerializer
        return StorySerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        qs = Story.objects.all().select_related('owner')
        params = self.request.query_params
        genre = params.get('genre')
        status_filter = params.get('status')
        ordering = params.get('ordering')
        owner = params.get('owner')
        library = params.get('library')
        viewer = user_from_request(self.request)

        if self.action == 'list':
            if library and viewer:
                if library == 'owned':
                    qs = qs.filter(owner=viewer)
                elif library == 'saved':
                    qs = qs.filter(saves__user=viewer)
                elif library == 'collaborating':
                    qs = qs.filter(
                        collaborators__user=viewer,
                        collaborators__status='accepted',
                    )
                else:
                    qs = qs.filter(
                        Q(owner=viewer)
                        | Q(saves__user=viewer)
                        | Q(collaborators__user=viewer, collaborators__status='accepted')
                    ).distinct()
            elif viewer and viewer.is_staff and params.get('admin') == '1':
                pass  # staff moderation view (opt-in via ?admin=1) — no visibility filter
            elif viewer:
                qs = qs.filter(
                    Q(visibility='public')
                    | Q(owner=viewer)
                    | Q(collaborators__user=viewer, collaborators__status__in=['invited', 'accepted', 'requested'])
                ).distinct()
            else:
                qs = qs.filter(visibility='public')

        if owner:
            qs = qs.filter(owner_id=owner)
        if genre and genre != 'all':
            qs = qs.filter(genre=genre)
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)
        if ordering == 'new':
            return qs.order_by('-created_at')
        return qs.order_by('-updated_at')

    def retrieve(self, request, *args, **kwargs):
        story = self.get_object()
        viewer = user_from_request(request)
        if story.visibility == 'invite_only' and not story.is_owner(viewer):
            # Members / pending can always open. Logged-in outsiders may open
            # the gate page to send a join request (story stays out of public lists).
            if not viewer:
                return Response({'error': 'This story is invite-only. Sign in to request access.'}, status=403)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        story = self.get_object()
        user = user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required.'}, status=401)
        if not story.is_owner(user):
            return Response({'error': 'Not allowed.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        story = self.get_object()
        user = user_from_request(request)
        if not user:
            return Response({'error': 'Authentication required.'}, status=401)
        if not story.is_owner(user):
            return Response({'error': 'Not allowed.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def featured(self, request):
        stories = Story.objects.filter(
            is_featured=True, visibility='public',
        ).order_by('-updated_at')[:6]
        serializer = StorySerializer(
            stories, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my')
    def my_library(self, request):
        user, err = require_user(request)
        if err:
            return err
        kind = request.query_params.get('kind') or 'all'
        qs = Story.objects.all().select_related('owner')
        if kind == 'owned':
            qs = qs.filter(owner=user)
        elif kind == 'saved':
            qs = qs.filter(saves__user=user)
        elif kind == 'collaborating':
            qs = qs.filter(collaborators__user=user, collaborators__status='accepted')
        else:
            qs = qs.filter(
                Q(owner=user)
                | Q(saves__user=user)
                | Q(collaborators__user=user, collaborators__status='accepted')
            ).distinct()
        serializer = StorySerializer(qs.order_by('-updated_at')[:100], many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'])
    def segments(self, request, pk=None):
        story = self.get_object()
        if request.method == 'POST':
            user, err = require_user(request)
            if err:
                return err
            if not story.can_contribute(user):
                return Response(
                    {'error': 'You are not allowed to contribute to this story.'},
                    status=403,
                )
            content = (request.data.get('content') or '').strip()
            if not content:
                return Response({'error': 'Content is required.'}, status=400)
            if len(content) > 8000:
                return Response({'error': 'Segment too long (max 8000 chars).'}, status=400)
            with transaction.atomic():
                story = Story.objects.select_for_update().get(pk=story.pk)
                if story.status == 'completed':
                    return Response({'error': 'This story is already complete.'}, status=400)
                approved_count = story.segments.filter(status='approved').count()
                if approved_count >= story.max_segments:
                    story.status = 'completed'
                    story.save(update_fields=['status'])
                    return Response({'error': 'This story is full.'}, status=400)
                status = 'pending' if story.require_approval and not story.is_owner(user) else 'approved'
                if story.is_owner(user) or story.role_for(user) == 'editor':
                    status = 'approved'
                next_order = story.segments.exclude(status='rejected').count() + 1
                order = approved_count + 1 if status == 'approved' else next_order
                segment = Segment.objects.create(
                    story=story,
                    author=user,
                    content=content,
                    order=order,
                    status=status,
                )
                story.save(update_fields=['updated_at'])
                if status == 'approved' and approved_count + 1 >= story.max_segments:
                    story.status = 'completed'
                    story.save(update_fields=['status'])
                if status == 'pending' and story.owner_id:
                    _notify(
                        story.owner_id,
                        user.id,
                        'forge_pending',
                        f'New part pending approval on "{story.title}"',
                    )
            broadcast_forge_event(story.id, 'segment_created', {'segment_id': segment.id, 'status': segment.status}, user.id)
            return Response(
                SegmentSerializer(segment, context=self.get_serializer_context()).data,
                status=201,
            )

        viewer = user_from_request(request)
        if story.can_approve(viewer):
            segments = story.segments.exclude(status='rejected').select_related('author')
        else:
            segments = story.segments.filter(status='approved').select_related('author')
        return Response(
            SegmentSerializer(segments, many=True, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=['post'], url_path=r'segments/(?P<segment_id>[^/.]+)/approve')
    def approve_segment(self, request, pk=None, segment_id=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.can_approve(user):
            return Response({'error': 'Not allowed.'}, status=403)
        segment = get_object_or_404(Segment, pk=segment_id, story=story)
        if segment.status != 'approved':
            with transaction.atomic():
                approved_count = story.segments.filter(status='approved').count()
                segment.status = 'approved'
                segment.order = approved_count + 1
                segment.save(update_fields=['status', 'order'])
                story.save(update_fields=['updated_at'])
                if approved_count + 1 >= story.max_segments:
                    story.status = 'completed'
                    story.save(update_fields=['status'])
            if segment.author_id:
                _notify(segment.author_id, user.id, 'forge_approved', f'Your part on "{story.title}" was approved')
            broadcast_forge_event(story.id, 'segment_approved', {'segment_id': segment.id}, user.id)
        return Response(SegmentSerializer(segment, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path=r'segments/(?P<segment_id>[^/.]+)/reject')
    def reject_segment(self, request, pk=None, segment_id=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.can_approve(user):
            return Response({'error': 'Not allowed.'}, status=403)
        segment = get_object_or_404(Segment, pk=segment_id, story=story)
        segment.status = 'rejected'
        segment.save(update_fields=['status'])
        if segment.author_id:
            _notify(segment.author_id, user.id, 'forge_rejected', f'Your part on "{story.title}" was rejected')
        broadcast_forge_event(story.id, 'segment_rejected', {'segment_id': segment.id}, user.id)
        return Response(SegmentSerializer(segment, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['patch'], url_path=r'segments/(?P<segment_id>[^/.]+)')
    def revise_segment(self, request, pk=None, segment_id=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.can_revise_segments(user):
            return Response({'error': 'Not allowed.'}, status=403)
        segment = get_object_or_404(Segment, pk=segment_id, story=story)
        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'error': 'Content is required.'}, status=400)
        if len(content) > 8000:
            return Response({'error': 'Segment too long (max 8000 chars).'}, status=400)
        SegmentRevision.objects.create(
            segment=segment,
            editor=user,
            previous_content=segment.content,
        )
        segment.content = content
        segment.save(update_fields=['content'])
        story.save(update_fields=['updated_at'])
        broadcast_forge_event(story.id, 'segment_revised', {'segment_id': segment.id}, user.id)
        return Response(SegmentSerializer(segment, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['get', 'post'], url_path=r'segments/(?P<segment_id>[^/.]+)/dialogues')
    def dialogues(self, request, pk=None, segment_id=None):
        story = self.get_object()
        segment = get_object_or_404(Segment, pk=segment_id, story=story)
        if segment.status != 'approved' and not story.can_approve(user_from_request(request)):
            return Response({'error': 'Segment not available.'}, status=404)

        if request.method == 'POST':
            user, err = require_user(request)
            if err:
                return err
            text = (request.data.get('text') or '').strip()
            if not text:
                return Response({'error': 'Text is required.'}, status=400)
            if len(text) > 280:
                return Response({'error': 'Dialogue max 280 characters.'}, status=400)
            parent = None
            parent_id = request.data.get('parent')
            if parent_id:
                parent = SegmentDialogue.objects.filter(pk=parent_id, segment=segment).first()
            dialogue = SegmentDialogue.objects.create(
                segment=segment, author=user, text=text, parent=parent,
            )
            return Response(
                SegmentDialogueSerializer(dialogue, context=self.get_serializer_context()).data,
                status=201,
            )

        qs = segment.dialogues.filter(parent__isnull=True).select_related('author')
        return Response(
            SegmentDialogueSerializer(qs, many=True, context=self.get_serializer_context()).data
        )

    @action(detail=True, methods=['patch', 'put'])
    def bible(self, request, pk=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.can_edit_bible(user):
            return Response({'error': 'Not allowed.'}, status=403)
        allowed = {
            'outline', 'characters', 'world_notes', 'tone', 'pov',
            'content_rules', 'writing_goal', 'cover_prompt',
        }
        data = {k: v for k, v in request.data.items() if k in allowed}
        for key, value in data.items():
            setattr(story, key, value)
        story.save()
        broadcast_forge_event(story.id, 'bible_updated', {}, user.id)
        return Response(StoryDetailSerializer(story, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['get', 'post'])
    def collaborators(self, request, pk=None):
        story = self.get_object()
        if request.method == 'GET':
            qs = story.collaborators.exclude(status='removed').select_related('user')
            return Response(
                StoryCollaboratorSerializer(qs, many=True, context=self.get_serializer_context()).data
            )
        return self.invite(request, pk=pk)

    @action(detail=True, methods=['post'])
    def invite(self, request, pk=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.is_owner(user):
            return Response({'error': 'Not allowed.'}, status=403)
        if story.studio_mode == 'solo':
            story.studio_mode = 'collab'
            story.save(update_fields=['studio_mode', 'updated_at'])

        username = (request.data.get('username') or '').strip()
        user_id = request.data.get('user_id')
        role = request.data.get('role') or 'writer'
        if role not in dict(StoryCollaborator.ROLE_CHOICES):
            role = 'writer'

        invitee = None
        if user_id:
            invitee = User.objects.filter(pk=user_id).first()
        elif username:
            invitee = User.objects.filter(username__iexact=username).first()
        if not invitee:
            return Response({'error': 'User not found.'}, status=404)
        if invitee.id == story.owner_id:
            return Response({'error': 'Owner is already on the story.'}, status=400)

        collab, created = StoryCollaborator.objects.get_or_create(
            story=story,
            user=invitee,
            defaults={'role': role, 'status': 'invited', 'invited_by': user},
        )
        if not created:
            if collab.status == 'removed':
                collab.status = 'invited'
            collab.role = role
            collab.invited_by = user
            collab.save()

        _notify(invitee.id, user.id, 'forge_invite', f'You were invited to collaborate on "{story.title}"')
        return Response(
            StoryCollaboratorSerializer(collab, context=self.get_serializer_context()).data,
            status=201 if created else 200,
        )

    @action(detail=True, methods=['post'], url_path='join')
    def request_join(self, request, pk=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.can_request_join(user):
            status = story.collab_status_for(user)
            if status == 'requested':
                return Response({'error': 'Join request already pending.', 'status': 'requested'}, status=400)
            if status == 'invited':
                return Response({'error': 'You already have an invite — accept it instead.', 'status': 'invited'}, status=400)
            if story.is_studio_member(user):
                return Response({'error': 'You already have studio access.', 'status': 'accepted'}, status=400)
            return Response({'error': 'Cannot request to join this story.'}, status=403)

        role = request.data.get('role') or 'writer'
        if role not in dict(StoryCollaborator.ROLE_CHOICES):
            role = 'writer'

        collab, created = StoryCollaborator.objects.get_or_create(
            story=story,
            user=user,
            defaults={'role': role, 'status': 'requested', 'invited_by': None},
        )
        if not created:
            if collab.status == 'removed':
                collab.status = 'requested'
                collab.role = role
                collab.save(update_fields=['status', 'role', 'updated_at'])
            elif collab.status != 'requested':
                return Response({'error': f'Already {collab.status}.'}, status=400)

        if story.owner_id:
            _notify(
                story.owner_id,
                user.id,
                'forge_invite',
                f'{user.username} requested to join "{story.title}"',
            )
        broadcast_forge_event(story.id, 'join_requested', {'user_id': user.id}, user.id)
        return Response(
            StoryCollaboratorSerializer(collab, context=self.get_serializer_context()).data,
            status=201 if created else 200,
        )

    @action(detail=True, methods=['post'], url_path=r'collaborators/(?P<user_id>[^/.]+)/review')
    def review_join_request(self, request, pk=None, user_id=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.is_owner(user):
            return Response({'error': 'Not allowed.'}, status=403)
        collab = get_object_or_404(StoryCollaborator, story=story, user_id=user_id)
        if collab.status != 'requested':
            return Response({'error': 'No pending join request for this user.'}, status=400)

        accept = request.data.get('accept', True)
        role = request.data.get('role') or collab.role or 'writer'
        if role not in dict(StoryCollaborator.ROLE_CHOICES):
            role = 'writer'

        if accept:
            if story.studio_mode == 'solo':
                story.studio_mode = 'collab'
                story.save(update_fields=['studio_mode', 'updated_at'])
            collab.status = 'accepted'
            collab.role = role
            collab.invited_by = user
            collab.save(update_fields=['status', 'role', 'invited_by', 'updated_at'])
            _notify(
                collab.user_id,
                user.id,
                'forge_invite',
                f'Your join request for "{story.title}" was approved',
            )
            broadcast_forge_event(story.id, 'join_accepted', {'user_id': collab.user_id}, user.id)
        else:
            collab.status = 'removed'
            collab.save(update_fields=['status', 'updated_at'])
            _notify(
                collab.user_id,
                user.id,
                'forge_invite',
                f'Your join request for "{story.title}" was declined',
            )
            broadcast_forge_event(story.id, 'join_rejected', {'user_id': collab.user_id}, user.id)

        return Response(StoryCollaboratorSerializer(collab, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path='collaborators/respond')
    def respond_invite(self, request, pk=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        accept = request.data.get('accept', True)
        collab = story.collaborators.filter(user=user).exclude(status='removed').first()
        if not collab:
            return Response({'error': 'No invitation found.'}, status=404)
        if collab.status == 'requested':
            return Response({'error': 'Waiting for the owner to review your join request.'}, status=400)
        if collab.status != 'invited':
            return Response({'error': 'No pending invitation.'}, status=400)
        collab.status = 'accepted' if accept else 'removed'
        collab.save(update_fields=['status', 'updated_at'])
        if story.owner_id and accept:
            _notify(story.owner_id, user.id, 'forge_invite', f'{user.username} accepted your invite on "{story.title}"')
        return Response(StoryCollaboratorSerializer(collab, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path=r'collaborators/(?P<user_id>[^/.]+)/remove')
    def remove_collaborator(self, request, pk=None, user_id=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.is_owner(user):
            return Response({'error': 'Not allowed.'}, status=403)
        collab = get_object_or_404(StoryCollaborator, story=story, user_id=user_id)
        collab.status = 'removed'
        collab.save(update_fields=['status', 'updated_at'])
        return Response({'ok': True})

    def _ai_gate(self, request, story):
        user, err = require_user(request)
        if err:
            return None, err
        if not story.is_studio_member(user):
            return None, Response({'error': 'Studio access required.'}, status=403)
        return user, None

    @action(detail=True, methods=['post'], url_path='ai/continue')
    def ai_continue(self, request, pk=None):
        story = self.get_object()
        user, err = self._ai_gate(request, story)
        if err:
            return err
        return Response(ai_buddy.buddy_continue(story))

    @action(detail=True, methods=['post'], url_path='ai/rewrite')
    def ai_rewrite(self, request, pk=None):
        story = self.get_object()
        user, err = self._ai_gate(request, story)
        if err:
            return err
        draft = (request.data.get('draft') or '').strip()
        style = request.data.get('style') or 'stronger'
        return Response(ai_buddy.buddy_rewrite(story, draft, style))

    @action(detail=True, methods=['post'], url_path='ai/outline')
    def ai_outline(self, request, pk=None):
        story = self.get_object()
        user, err = self._ai_gate(request, story)
        if err:
            return err
        result = ai_buddy.buddy_outline(story)
        if request.data.get('apply') and story.can_edit_bible(user):
            story.outline = result['outline']
            story.save(update_fields=['outline', 'updated_at'])
            result['applied'] = True
        return Response(result)

    @action(detail=True, methods=['post'], url_path='ai/character')
    def ai_character(self, request, pk=None):
        story = self.get_object()
        user, err = self._ai_gate(request, story)
        if err:
            return err
        result = ai_buddy.buddy_character(story)
        if request.data.get('apply') and story.can_edit_bible(user):
            chars = list(story.characters or [])
            chars.append(result['character'])
            story.characters = chars
            story.save(update_fields=['characters', 'updated_at'])
            result['applied'] = True
        return Response(result)

    @action(detail=True, methods=['post'], url_path='ai/critique')
    def ai_critique(self, request, pk=None):
        story = self.get_object()
        user, err = self._ai_gate(request, story)
        if err:
            return err
        draft = (request.data.get('draft') or '').strip()
        return Response(ai_buddy.buddy_critique(story, draft))

    @action(detail=True, methods=['post'], url_path='ai/inspire')
    def ai_inspire(self, request, pk=None):
        story = self.get_object()
        user, err = self._ai_gate(request, story)
        if err:
            return err
        mode = (request.data.get('mode') or 'spark').strip()
        draft = (request.data.get('draft') or '').strip()
        return Response(ai_buddy.buddy_inspire(story, mode, draft))

    @action(detail=True, methods=['post'])
    def generate_cover(self, request, pk=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.is_owner(user):
            return Response({'error': 'Not allowed.'}, status=403)
        custom = (request.data.get('prompt') or story.cover_prompt or '').strip()
        if custom:
            story.cover_prompt = custom[:500]
        cover_url, source = resolve_cover_url(
            story.title, story.premise, story.genre, story.cover_prompt,
        )
        if cover_url.startswith('data:') and len(cover_url) > 2000:
            story.cover_url = (
                f'https://placehold.co/1024x1024/1a1040/c4b5fd/png'
                f'?text={story.title[:40].replace(" ", "+")}'
            )
        else:
            story.cover_url = cover_url[:2000] if len(cover_url) > 2000 else cover_url
        story.save(update_fields=['cover_url', 'cover_prompt', 'updated_at'])
        data = StorySerializer(story, context=self.get_serializer_context()).data
        data['cover_source'] = source
        if source == 'decorative':
            data['cover_preview'] = cover_url
        return Response(data)

    @action(detail=True, methods=['get'])
    def export_pdf(self, request, pk=None):
        story = self.get_object()
        viewer = user_from_request(request)
        if story.visibility == 'invite_only' and not story.is_owner(viewer):
            allowed = viewer and story.collaborators.filter(user=viewer, status='accepted').exists()
            if not allowed:
                return Response({'error': 'Not allowed.'}, status=403)
        segments = [
            {
                'order': s.order,
                'content': s.content,
                'author': (s.author.get_full_name() or s.author.username) if s.author else 'Anonymous',
            }
            for s in story.segments.filter(status='approved').select_related('author')
        ]
        owner_name = ''
        if story.owner:
            owner_name = story.owner.get_full_name() or story.owner.username
        pdf_bytes = build_story_pdf(
            title=story.title,
            premise=story.premise,
            genre=story.get_genre_display(),
            owner_name=owner_name,
            segments=segments,
        )
        filename = f"cosmory-{story.id}-{story.title[:40].replace(' ', '-')}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def publish(self, request, pk=None):
        story = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not story.is_owner(user):
            return Response({'error': 'Not allowed.'}, status=403)
        story.status = 'completed'
        story.save(update_fields=['status', 'updated_at'])
        broadcast_forge_event(story.id, 'published', {}, user.id)
        return Response(StorySerializer(story, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def toggle_save(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        story = self.get_object()
        existing = StorySave.objects.filter(user=user, story=story).first()
        if existing:
            existing.delete()
            saved = False
        else:
            StorySave.objects.create(user=user, story=story)
            saved = True
        return Response({'saved': saved})
