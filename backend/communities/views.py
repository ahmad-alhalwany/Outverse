from datetime import timedelta

from django.db.models import Count, F, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from outverse.throttles import AnonReadThrottle, ContentPostCreateThrottle, ThrottleMixin

from outverse.auth_utils import require_user, user_from_request

from .models import Community, CommunityMembership, CommunityWikiPage
from .serializers import CommunitySerializer
from chat.models import ChatRoom, RoomMessage, RoomReadState

TRENDING_WINDOW_DAYS = 7


def _unique_slug(name: str) -> str:
    base = slugify(name)[:32] or 'space'
    slug = base
    suffix = 1
    while Community.objects.filter(slug=slug).exists():
        suffix += 1
        slug = f'{base}-{suffix}'
    return slug


def _membership_role(user, community):
    if not user:
        return None
    if community.creator_id == user.id:
        return 'admin'
    m = CommunityMembership.objects.filter(
        community=community, user=user, status='approved',
    ).only('role', 'is_moderator').first()
    if not m:
        return None
    if m.role in ('admin', 'moderator'):
        return m.role
    if m.is_moderator:
        return 'moderator'
    return 'member'


def _is_moderator(user, community):
    role = _membership_role(user, community)
    return role in ('moderator', 'admin')


def _is_admin(user, community):
    return _membership_role(user, community) == 'admin'


def _is_banned(user, community):
    if not user:
        return False
    return CommunityMembership.objects.filter(
        community=community, user=user, status='banned',
    ).exists()


def _valid_channel_type(channel_type):
    return channel_type in {choice[0] for choice in ChatRoom.CHANNEL_TYPE_CHOICES}


def _serialize_channel(room, unread_count=0):
    return {
        'id': room.id,
        'name': room.name,
        'category': room.category or 'General',
        'slowmode_seconds': room.slowmode_seconds,
        'channel_type': room.channel_type,
        'unread_count': unread_count,
        'created_at': room.created_at.isoformat(),
    }


def _apply_channel_updates(room, data):
    update_fields = []
    if 'name' in data:
        name = (data.get('name') or '').strip()
        if not name:
            return 'name cannot be empty.'
        room.name = name[:120]
        update_fields.append('name')
    if 'category' in data:
        room.category = (data.get('category') or '').strip()[:80]
        update_fields.append('category')
    if 'slowmode_seconds' in data:
        try:
            slowmode = int(data.get('slowmode_seconds') or 0)
        except (TypeError, ValueError):
            return 'slowmode_seconds must be an integer.'
        if slowmode < 0 or slowmode > 600:
            return 'slowmode_seconds must be between 0 and 600.'
        room.slowmode_seconds = slowmode
        update_fields.append('slowmode_seconds')
    if 'channel_type' in data:
        channel_type = (data.get('channel_type') or '').strip().lower()
        if not _valid_channel_type(channel_type):
            return 'channel_type must be text, voice, or stage.'
        room.channel_type = channel_type
        update_fields.append('channel_type')
    if update_fields:
        room.save(update_fields=update_fields)
    return None


class CommunityViewSet(ThrottleMixin, viewsets.ModelViewSet):
    queryset = Community.objects.all()
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

    serializer_class = CommunitySerializer
    lookup_field = 'slug'

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'members'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = Community.objects.all()
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(name__icontains=q)
        if self.request.query_params.get('mine'):
            viewer = user_from_request(self.request)
            if viewer:
                qs = qs.filter(memberships__user_id=viewer.id, memberships__status='approved')
        if self.request.query_params.get('ordering') == 'trending':
            since = timezone.now() - timedelta(days=TRENDING_WINDOW_DAYS)
            qs = qs.annotate(
                recent_members=Count(
                    'memberships',
                    filter=Q(memberships__joined_at__gte=since, memberships__status='approved'),
                    distinct=True,
                ),
                recent_posts=Count(
                    'posts',
                    filter=Q(posts__created_at__gte=since),
                    distinct=True,
                ),
            ).order_by('-recent_members', '-recent_posts', '-members_count')
        return qs

    def perform_create(self, serializer):
        # 'create' requires IsAuthenticated (see get_permissions), so the
        # user is guaranteed to be authenticated by the time we get here.
        user = self.request.user
        name = (self.request.data.get('name') or '').strip()
        slug = _unique_slug(name)
        community = serializer.save(slug=slug, creator=user)
        CommunityMembership.objects.create(
            community=community, user=user, is_moderator=True, status='approved',
        )
        community.members_count = 1
        community.save(update_fields=['members_count'])

    def update(self, request, *args, **kwargs):
        community = self.get_object()
        if not _is_moderator(user_from_request(request), community):
            return Response({'error': 'Forbidden.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        community = self.get_object()
        if not _is_moderator(user_from_request(request), community):
            return Response({'error': 'Forbidden.'}, status=403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        community = self.get_object()
        user = user_from_request(request)
        if not user or community.creator_id != user.id:
            return Response({'error': 'Only the creator can delete this community.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def join(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if _is_banned(user, community):
            return Response({'error': 'You are banned from this community.'}, status=403)
        status_value = 'pending' if community.privacy == 'private' else 'approved'
        membership, created = CommunityMembership.objects.get_or_create(
            community=community, user=user,
            defaults={'is_moderator': False, 'status': status_value},
        )
        if not created and membership.status == 'banned':
            return Response({'error': 'You are banned from this community.'}, status=403)
        if created and status_value == 'approved':
            Community.objects.filter(pk=community.pk).update(members_count=F('members_count') + 1)
        community.refresh_from_db(fields=['members_count'])
        return Response(CommunitySerializer(community, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def leave(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        deleted, _ = CommunityMembership.objects.filter(
            community=community, user=user, status='approved',
        ).delete()
        if deleted:
            Community.objects.filter(pk=community.pk, members_count__gt=0).update(
                members_count=F('members_count') - 1,
            )
        CommunityMembership.objects.filter(community=community, user=user, status='pending').delete()
        community.refresh_from_db(fields=['members_count'])
        return Response(CommunitySerializer(community, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def members(self, request, slug=None):
        community = self.get_object()
        rows = community.memberships.filter(status='approved').select_related('user').order_by(
            '-is_moderator', '-joined_at',
        )[:100]
        return Response([
            {
                'id': m.user.id,
                'username': m.user.username,
                'is_moderator': m.is_moderator or m.role in ('moderator', 'admin'),
                'role': m.role if m.role else ('moderator' if m.is_moderator else 'member'),
                'is_creator': m.user_id == community.creator_id,
                'flair': m.flair,
                'joined_at': m.joined_at.isoformat(),
            }
            for m in rows
        ])

    @action(detail=True, methods=['get'], url_path='pending-members')
    def pending_members(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        rows = community.memberships.filter(status='pending').select_related('user').order_by('joined_at')[:100]
        return Response([
            {
                'id': m.user.id,
                'username': m.user.username,
                'requested_at': m.joined_at.isoformat(),
            }
            for m in rows
        ])

    @action(detail=True, methods=['post'])
    def approve(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        member_id = request.data.get('user_id')
        if not member_id:
            return Response({'error': 'user_id is required.'}, status=400)
        updated = CommunityMembership.objects.filter(
            community=community, user_id=member_id, status='pending',
        ).update(status='approved')
        if updated:
            Community.objects.filter(pk=community.pk).update(members_count=F('members_count') + 1)
        community.refresh_from_db(fields=['members_count'])
        return Response(CommunitySerializer(community, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        member_id = request.data.get('user_id')
        if not member_id:
            return Response({'error': 'user_id is required.'}, status=400)
        CommunityMembership.objects.filter(
            community=community, user_id=member_id, status='pending',
        ).delete()
        return Response({'ok': True})

    @action(detail=True, methods=['post'])
    def kick(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        member_id = request.data.get('user_id')
        if not member_id:
            return Response({'error': 'user_id is required.'}, status=400)
        if int(member_id) == community.creator_id:
            return Response({'error': 'Cannot remove the community creator.'}, status=400)
        deleted, _ = CommunityMembership.objects.filter(
            community=community, user_id=member_id, status='approved',
        ).delete()
        if deleted:
            Community.objects.filter(pk=community.pk, members_count__gt=0).update(
                members_count=F('members_count') - 1,
            )
        community.refresh_from_db(fields=['members_count'])
        return Response(CommunitySerializer(community, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def ban(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        member_id = request.data.get('user_id')
        if not member_id:
            return Response({'error': 'user_id is required.'}, status=400)
        if int(member_id) == community.creator_id:
            return Response({'error': 'Cannot ban the community creator.'}, status=400)
        membership = CommunityMembership.objects.filter(
            community=community, user_id=member_id,
        ).first()
        if membership:
            was_approved = membership.status == 'approved'
            membership.status = 'banned'
            membership.is_moderator = False
            membership.role = 'member'
            membership.save(update_fields=['status', 'is_moderator', 'role'])
            if was_approved:
                Community.objects.filter(pk=community.pk, members_count__gt=0).update(
                    members_count=F('members_count') - 1,
                )
        else:
            CommunityMembership.objects.create(
                community=community, user_id=member_id, status='banned', is_moderator=False,
            )
        community.refresh_from_db(fields=['members_count'])
        return Response(CommunitySerializer(community, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def unban(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        member_id = request.data.get('user_id')
        if not member_id:
            return Response({'error': 'user_id is required.'}, status=400)
        CommunityMembership.objects.filter(
            community=community, user_id=member_id, status='banned',
        ).delete()
        return Response({'ok': True})

    @action(detail=True, methods=['get'], url_path='mod-queue')
    def mod_queue(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        from moderation.models import FlaggedContent
        from posts.models import Post

        post_ids = list(
            Post.objects.filter(community_id=community.id).values_list('id', flat=True),
        )
        if not post_ids:
            return Response([])
        posts_by_id = {
            p.id: p
            for p in Post.objects.filter(id__in=post_ids).select_related('user')[:500]
        }
        flags = FlaggedContent.objects.filter(
            type='post',
            object_id__in=post_ids,
            status__in=['pending', 'auto_flagged'],
        ).order_by('-created_at')[:50]
        rows = []
        for flag in flags:
            post = posts_by_id.get(flag.object_id)
            rows.append({
                'id': flag.id,
                'type': flag.type,
                'object_id': flag.object_id,
                'content': flag.content,
                'reporter': flag.reporter,
                'status': flag.status,
                'ai_flagged': flag.ai_flagged,
                'created_at': flag.created_at.isoformat(),
                'post': {
                    'id': post.id,
                    'text': (post.text or '')[:200],
                    'username': post.user.username if post and post.user else '',
                    'flair': post.flair if post else '',
                } if post else None,
            })
        return Response(rows)

    @action(detail=True, methods=['post'], url_path='mod-resolve')
    def mod_resolve(self, request, slug=None):
        """Orbit Desk: resolve a flagged post — approve, remove, or ban author."""
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        from moderation.models import FlaggedContent
        from posts.models import Post

        flag_id = request.data.get('flag_id')
        action_name = (request.data.get('action') or '').lower()
        if action_name not in ('approve', 'remove', 'ban'):
            return Response({'error': 'action must be approve, remove, or ban.'}, status=400)
        flag = FlaggedContent.objects.filter(pk=flag_id, type='post').first()
        if not flag:
            return Response({'error': 'Flag not found.'}, status=404)
        post = Post.objects.filter(pk=flag.object_id, community_id=community.id).first()
        if not post:
            return Response({'error': 'Post not in this community.'}, status=404)

        if action_name == 'approve':
            flag.status = 'approved'
            flag.save(update_fields=['status'])
            return Response({'ok': True, 'status': 'approved'})

        if action_name == 'remove':
            post.is_active = False
            post.save(update_fields=['is_active'])
            flag.status = 'rejected'
            flag.save(update_fields=['status'])
            return Response({'ok': True, 'status': 'removed'})

        # ban author + remove post
        membership = CommunityMembership.objects.filter(
            community=community, user_id=post.user_id,
        ).first()
        if membership:
            membership.status = 'banned'
            membership.is_moderator = False
            membership.role = 'member'
            membership.save(update_fields=['status', 'is_moderator', 'role'])
        else:
            CommunityMembership.objects.create(
                community=community, user_id=post.user_id, status='banned', is_moderator=False,
            )
        post.is_active = False
        post.save(update_fields=['is_active'])
        flag.status = 'rejected'
        flag.save(update_fields=['status'])
        return Response({'ok': True, 'status': 'banned'})

    @action(detail=True, methods=['post'], url_path='set-flair')
    def set_flair(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        flair = str(request.data.get('flair') or '')[:40]
        updated = CommunityMembership.objects.filter(
            community=community, user=user, status='approved',
        ).update(flair=flair)
        if not updated:
            return Response({'error': 'Not a member.'}, status=400)
        return Response({'flair': flair})

    @action(detail=True, methods=['post'], url_path='set-moderator')
    def set_moderator(self, request, slug=None):
        user, err = require_user(request)
        if err:
            return err
        community = self.get_object()
        if not _is_admin(user, community):
            return Response({'error': 'Only admins can manage roles.'}, status=403)
        member_id = request.data.get('user_id')
        if not member_id:
            return Response({'error': 'user_id is required.'}, status=400)
        if int(member_id) == community.creator_id:
            return Response({'error': 'The creator is always an admin.'}, status=400)
        role = (request.data.get('role') or '').strip().lower()
        if role not in ('member', 'moderator', 'admin'):
            # Legacy bool API
            is_moderator = bool(request.data.get('is_moderator'))
            role = 'moderator' if is_moderator else 'member'
        membership = CommunityMembership.objects.filter(
            community=community, user_id=member_id, status='approved',
        ).first()
        if not membership:
            return Response({'error': 'Member not found.'}, status=404)
        membership.role = role
        membership.is_moderator = role in ('moderator', 'admin')
        membership.save(update_fields=['role', 'is_moderator'])
        return Response({'ok': True, 'role': membership.role})

    @action(detail=True, methods=['get', 'post'])
    def channels(self, request, slug=None):
        """List or create Discord-style community chat channels."""
        community = self.get_object()
        if request.method == 'GET':
            rooms = ChatRoom.objects.filter(community=community).order_by('category', 'name')
            unread_counts = {}
            viewer = user_from_request(request)
            if viewer:
                room_ids = [room.id for room in rooms]
                states = {
                    state.room_id: state.last_read_message_id
                    for state in RoomReadState.objects.filter(room_id__in=room_ids, user=viewer)
                }
                for room in rooms:
                    unread_qs = RoomMessage.objects.filter(room=room).exclude(sender=viewer)
                    last_read_id = states.get(room.id)
                    if last_read_id:
                        unread_qs = unread_qs.filter(id__gt=last_read_id)
                    unread_counts[room.id] = unread_qs.count()
            return Response([
                _serialize_channel(room, unread_counts.get(room.id, 0))
                for room in rooms
            ])

        user, err = require_user(request)
        if err:
            return err
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        name = (request.data.get('name') or '').strip()[:120]
        if not name:
            return Response({'error': 'name is required.'}, status=400)
        category = (request.data.get('category') or 'General').strip()[:80]
        try:
            slowmode = int(request.data.get('slowmode_seconds') or 0)
        except (TypeError, ValueError):
            return Response({'error': 'slowmode_seconds must be an integer.'}, status=400)
        if slowmode < 0 or slowmode > 600:
            return Response({'error': 'slowmode_seconds must be between 0 and 600.'}, status=400)
        channel_type = (request.data.get('channel_type') or 'text').strip().lower()
        if not _valid_channel_type(channel_type):
            return Response({'error': 'channel_type must be text, voice, or stage.'}, status=400)
        room = ChatRoom.objects.create(
            name=name,
            created_by=user,
            community=community,
            category=category,
            slowmode_seconds=slowmode,
            channel_type=channel_type,
        )
        room.members.add(user)
        return Response(_serialize_channel(room), status=201)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'channels/(?P<channel_id>[^/.]+)')
    def channel_detail(self, request, slug=None, channel_id=None):
        """Update or delete a Discord-style community channel."""
        community = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        room = ChatRoom.objects.filter(pk=channel_id, community=community).first()
        if not room:
            return Response({'error': 'Channel not found.'}, status=404)
        if request.method == 'DELETE':
            room.delete()
            return Response(status=204)
        err = _apply_channel_updates(room, request.data)
        if err:
            return Response({'error': err}, status=400)
        return Response(_serialize_channel(room))

    @action(detail=True, methods=['post'], url_path=r'channels/(?P<channel_id>[^/.]+)/join')
    def join_channel(self, request, slug=None, channel_id=None):
        """Join a community chat channel (Discord-style). Requires approved membership."""
        community = self.get_object()
        user, err = require_user(request)
        if err:
            return err
        if _is_banned(user, community):
            return Response({'error': 'Banned.'}, status=403)
        membership = community.memberships.filter(user_id=user.id, status='approved').first()
        if not membership:
            return Response({'error': 'Join the community first.'}, status=403)
        room = ChatRoom.objects.filter(pk=channel_id, community=community).first()
        if not room:
            return Response({'error': 'Channel not found.'}, status=404)
        room.members.add(user)
        return Response({
            'id': room.id,
            'name': room.name,
            'category': room.category or 'General',
            'slowmode_seconds': room.slowmode_seconds,
            'channel_type': room.channel_type,
            'joined': True,
        })

    @action(detail=True, methods=['get', 'post'])
    def wiki(self, request, slug=None):
        """List or create community wiki pages."""
        community = self.get_object()
        if request.method == 'GET':
            pages = community.wiki_pages.all()
            return Response([
                {
                    'id': p.id,
                    'slug': p.slug,
                    'title': p.title,
                    'body': p.body,
                    'edited_at': p.edited_at.isoformat() if p.edited_at else None,
                    'edited_by': p.edited_by.username if p.edited_by_id else None,
                }
                for p in pages
            ])

        user, err = require_user(request)
        if err:
            return err
        if not _is_moderator(user, community):
            return Response({'error': 'Forbidden.'}, status=403)
        title = (request.data.get('title') or '').strip()[:120]
        if not title:
            return Response({'error': 'title is required.'}, status=400)
        page_slug = slugify(request.data.get('slug') or title)[:80] or 'page'
        body = (request.data.get('body') or '')[:20000]
        page, created = CommunityWikiPage.objects.update_or_create(
            community=community,
            slug=page_slug,
            defaults={'title': title, 'body': body, 'edited_by': user},
        )
        return Response({
            'id': page.id,
            'slug': page.slug,
            'title': page.title,
            'body': page.body,
            'created': created,
        }, status=201 if created else 200)

    @action(detail=True, methods=['get'], url_path='wiki/(?P<page_slug>[^/.]+)')
    def wiki_page(self, request, slug=None, page_slug=None):
        community = self.get_object()
        page = community.wiki_pages.filter(slug=page_slug).first()
        if not page:
            return Response({'error': 'Not found.'}, status=404)
        if request.method == 'GET':
            return Response({
                'id': page.id,
                'slug': page.slug,
                'title': page.title,
                'body': page.body,
                'edited_at': page.edited_at.isoformat() if page.edited_at else None,
                'edited_by': page.edited_by.username if page.edited_by_id else None,
            })
        return Response({'error': 'Method not allowed.'}, status=405)

    @action(detail=True, methods=['get'])
    def posts(self, request, slug=None):
        """Community posts with new/top/hot ordering and optional flair filter."""
        from django.db.models import Case, Count, IntegerField, Sum, When
        from posts.models import Post, PostVote
        from posts.serializers import PostSerializer

        community = self.get_object()
        qs = Post.objects.filter(community=community, is_active=True).select_related('user')
        flair = (request.query_params.get('flair') or '').strip()
        if flair:
            qs = qs.filter(flair__iexact=flair)
        tag = (request.query_params.get('tag') or '').strip().lstrip('#')
        if tag:
            qs = qs.filter(tags__icontains=tag)

        ordering = (request.query_params.get('ordering') or 'new').lower()
        qs = qs.annotate(
            _net=Coalesce(
                Sum(
                    Case(
                        When(votes__value=PostVote.BOOST, then=1),
                        When(votes__value=PostVote.DIM, then=-1),
                        default=0,
                        output_field=IntegerField(),
                    )
                ),
                0,
            )
        )
        if ordering == 'top':
            qs = qs.order_by('-is_community_pinned', '-community_pinned_at', '-_net', '-created_at')
        elif ordering == 'hot':
            since = timezone.now() - timedelta(days=2)
            qs = qs.annotate(
                _recent_votes=Count('votes', filter=Q(votes__created_at__gte=since)),
            ).order_by(
                '-is_community_pinned', '-community_pinned_at',
                '-_recent_votes', '-_net', '-created_at',
            )
        elif ordering == 'controversial':
            from django.db.models.functions import Abs
            qs = qs.annotate(
                _boost_c=Coalesce(Sum(Case(
                    When(votes__value=PostVote.BOOST, then=1),
                    default=0, output_field=IntegerField(),
                )), 0),
                _dim_c=Coalesce(Sum(Case(
                    When(votes__value=PostVote.DIM, then=1),
                    default=0, output_field=IntegerField(),
                )), 0),
            ).annotate(
                _controversy=(F('_boost_c') + F('_dim_c')) * 1.0 / (Abs(F('_boost_c') - F('_dim_c')) + 1),
            ).order_by(
                '-is_community_pinned', '-community_pinned_at',
                '-_controversy', '-created_at',
            )
        else:
            qs = qs.order_by('-is_community_pinned', '-community_pinned_at', '-created_at')

        page = qs[:50]
        return Response(PostSerializer(page, many=True, context={'request': request}).data)