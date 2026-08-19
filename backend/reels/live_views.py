"""
Live Streaming views — endpoints for LiveSession, LiveChat, LiveReactions, LiveViewer.
"""
from __future__ import annotations

import secrets
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request
from outverse.throttles import (
    BurstThrottle,
    SustainedThrottle,
    ContentPostCreateThrottle,
)

from . import live_provider
from .models import (
    LiveSession,
    LiveViewer,
    LiveChatMessage,
    LiveReaction,
    LiveSessionView,
    Reel,  # noqa: F401 — re-exported for convenience
)


# ---------------------------------------------------------------------------
# Serializers (inline — KISS, no separate file for 5 small serializers)
# ---------------------------------------------------------------------------

from rest_framework import serializers


class LiveSessionSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    is_live = serializers.BooleanField(read_only=True)
    duration_seconds = serializers.IntegerField(read_only=True)
    slowmode_seconds = serializers.IntegerField(min_value=0, max_value=600, default=0)

    # Ingest credentials — stripped from the response for anyone but the host
    # in to_representation() below, since they'd let a viewer hijack the stream.
    HOST_ONLY_FIELDS = ('stream_key', 'rtmp_url', 'webrtc_publish_url')

    class Meta:
        model = LiveSession
        fields = [
            'id', 'user', 'title', 'description', 'thumbnail',
            'stream_protocol', 'stream_key', 'rtmp_url', 'webrtc_publish_url', 'playback_url',
            'status', 'scheduled_at', 'started_at', 'ended_at',
            'current_viewers', 'peak_viewers', 'total_views',
            'is_public', 'chat_enabled', 'recording_enabled', 'recording_url',
            'moderation_enabled', 'auto_moderation',
            'slowmode_seconds',
            'is_live', 'duration_seconds',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'stream_key', 'rtmp_url', 'webrtc_publish_url', 'playback_url',
            'current_viewers', 'peak_viewers', 'total_views',
            'is_live', 'duration_seconds',
            'started_at', 'ended_at', 'recording_url',
            'created_at', 'updated_at', 'user',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        is_owner = bool(
            request and request.user.is_authenticated and request.user.id == instance.user_id
        )
        if not is_owner:
            for field in self.HOST_ONLY_FIELDS:
                data.pop(field, None)
        return data


class LiveChatMessageSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    user_id = serializers.IntegerField(source='user.id', read_only=True)

    class Meta:
        model = LiveChatMessage
        fields = ['id', 'session', 'user', 'user_id', 'text', 'created_at', 'is_deleted']
        read_only_fields = ['user', 'user_id', 'is_deleted', 'created_at']


class LiveReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiveReaction
        fields = ['id', 'session', 'user', 'type', 'created_at']
        read_only_fields = ['user', 'created_at']


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------

RECENT_CHAT_LIMIT = 100


class LiveSessionViewSet(viewsets.ModelViewSet):
    """CRUD for live sessions + start/end/join/leave/chat/reactions."""
    queryset = LiveSession.objects.select_related('user').all()
    serializer_class = LiveSessionSerializer
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'live', 'join', 'vods'):
            return [AllowAny()]
        return [IsAuthenticated()]

    # ----- create / patch -----
    def create(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        data = request.data.copy()
        data['user'] = user.id
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        session = serializer.save(user=user)
        # Try to provision a real Cloudflare Stream live input; fall back to a
        # local-only stream key (no rtmp/playback URL) if unconfigured or it fails.
        provisioned = live_provider.create_live_input(
            session.title,
            recording=bool(session.recording_enabled),
        )
        if provisioned:
            session.provider_input_id = provisioned['provider_input_id']
            session.stream_key = provisioned['stream_key']
            session.rtmp_url = provisioned['rtmp_url']
            session.webrtc_publish_url = provisioned['webrtc_publish_url']
            session.playback_url = provisioned['playback_url']
            session.save(update_fields=[
                'provider_input_id', 'stream_key', 'rtmp_url',
                'webrtc_publish_url', 'playback_url',
            ])
        else:
            session.stream_key = secrets.token_urlsafe(32)
            session.save(update_fields=['stream_key'])
        return Response(
            self.get_serializer(session).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        instance = self.get_object()
        if instance.user_id != user.id:
            return Response({'detail': 'Not your session.'}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user, err = require_user(request)
        if err:
            return err
        instance = self.get_object()
        if instance.user_id != user.id:
            return Response({'detail': 'Not your session.'}, status=403)
        return super().destroy(request, *args, **kwargs)

    # ----- list filtering -----
    def get_queryset(self):
        qs = super().get_queryset()
        if self.action in ('list', 'retrieve'):
            user = self.request.user
            if user.is_authenticated:
                # Public sessions, plus the requester's own (so hosts can
                # manage their scheduled/private sessions from "my sessions").
                qs = qs.filter(Q(is_public=True) | Q(user=user))
            else:
                qs = qs.filter(is_public=True)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        # For live (or default discover) listings, surface the most-watched first.
        if self.action == 'list' and (not status_filter or status_filter == 'live'):
            qs = qs.order_by('-current_viewers', '-started_at')
        return qs

    # ----- actions -----
    @action(detail=False, methods=['get'], url_path='vods')
    def vods(self, request):
        """List ended live sessions that have a recording_url (creator VOD library)."""
        qs = (
            LiveSession.objects.filter(status='ended', recording_url__gt='')
            .exclude(recording_url='')
            .select_related('user')
            .order_by('-ended_at', '-id')
        )
        mine = request.query_params.get('mine') in ('1', 'true', 'yes')
        user = request.user if request.user.is_authenticated else None
        if mine:
            if not user:
                return Response({'error': 'auth required'}, status=401)
            qs = qs.filter(user=user)
        elif user:
            qs = qs.filter(Q(is_public=True) | Q(user=user))
        else:
            qs = qs.filter(is_public=True)

        try:
            limit = int(request.query_params.get('limit') or 20)
        except (TypeError, ValueError):
            limit = 20
        limit = max(1, min(limit, 50))
        try:
            offset = int(request.query_params.get('offset') or 0)
        except (TypeError, ValueError):
            offset = 0
        offset = max(0, offset)

        count = qs.count()
        page = list(qs[offset:offset + limit])
        return Response({
            'results': self.get_serializer(page, many=True).data,
            'count': count,
            'has_more': offset + limit < count,
        })

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """Start the live stream."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if session.user_id != user.id:
            return Response({'detail': 'Not your session.'}, status=403)
        if session.status != 'scheduled':
            return Response({'detail': 'Session already started/ended.'}, status=400)
        session.start_stream()
        # Notify followers that the host went live
        try:
            from users.models import Follow
            from notifications.utils import create_notification
            from notifications.realtime import push_live_event

            follower_ids = list(
                Follow.objects.filter(following_id=user.id)
                .values_list('follower_id', flat=True)[:500]
            )
            title = (session.title or 'Live now').strip()[:80]
            for fid in follower_ids:
                create_notification(
                    recipient_id=fid,
                    actor_id=user.id,
                    verb='going_live',
                    text=f'{user.username} is live: {title}',
                    notification_type='going_live',
                )
            push_live_event(session.id, {
                'type': 'live.started',
                'session_id': session.id,
                'current_viewers': session.current_viewers,
            })
        except Exception:
            pass
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=['post'])
    def end(self, request, pk=None):
        """End the live stream."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if session.user_id != user.id:
            return Response({'detail': 'Not your session.'}, status=403)
        if not session.is_live:
            return Response({'detail': 'Session is not live.'}, status=400)
        session.end_stream()
        # Mark all active viewers as left
        session.viewers.filter(is_active=True).update(
            left_at=timezone.now(), is_active=False,
        )
        if session.provider_input_id:
            if session.recording_enabled:
                recording_url = live_provider.get_recording_url(session.provider_input_id)
                if recording_url:
                    session.recording_url = recording_url
                    session.save(update_fields=['recording_url', 'updated_at'])
            live_provider.delete_live_input(session.provider_input_id)
        try:
            from notifications.realtime import push_live_event
            push_live_event(session.id, {
                'type': 'live.ended',
                'session_id': session.id,
                'recording_url': session.recording_url or '',
            })
        except Exception:
            pass
        return Response(self.get_serializer(session).data)

    @action(detail=True, methods=['get'])
    def live(self, request, pk=None):
        """Get current live state of a session (public)."""
        session = self.get_object()
        return Response({
            'id': session.id,
            'is_live': session.is_live,
            'status': session.status,
            'current_viewers': session.current_viewers,
            'peak_viewers': session.peak_viewers,
            'total_views': session.total_views,
            'duration_seconds': session.duration_seconds,
            'playback_url': session.playback_url,
        })

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def join(self, request, pk=None):
        """Join a live session as a viewer."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if not session.is_live:
            return Response({'detail': 'Session is not live.'}, status=400)
        viewer, created = LiveViewer.objects.get_or_create(
            session=session, user=user,
            defaults={'is_active': True},
        )
        if not created and not viewer.is_active:
            viewer.is_active = True
            viewer.left_at = None
            viewer.save(update_fields=['is_active', 'left_at'])
        # increment viewer count
        session.current_viewers = session.viewers.filter(is_active=True).count()
        if session.current_viewers > session.peak_viewers:
            session.peak_viewers = session.current_viewers
        session.total_views += 1 if created else 0
        session.save(update_fields=['current_viewers', 'peak_viewers', 'total_views'])
        try:
            from notifications.realtime import push_live_event
            push_live_event(session.id, {
                'type': 'live.viewers',
                'session_id': session.id,
                'current_viewers': session.current_viewers,
            })
        except Exception:
            pass
        return Response({'detail': 'joined', 'session_id': session.id})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def leave(self, request, pk=None):
        """Leave a live session."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        try:
            viewer = session.viewers.get(user=user, is_active=True)
        except LiveViewer.DoesNotExist:
            return Response({'detail': 'Not an active viewer.'}, status=400)
        viewer.leave()
        session.current_viewers = session.viewers.filter(is_active=True).count()
        session.save(update_fields=['current_viewers'])
        try:
            from notifications.realtime import push_live_event
            push_live_event(session.id, {
                'type': 'live.viewers',
                'session_id': session.id,
                'current_viewers': session.current_viewers,
            })
        except Exception:
            pass
        return Response({'detail': 'left'})

    @action(detail=True, methods=['get'])
    def chat(self, request, pk=None):
        """Get recent chat messages (public)."""
        session = self.get_object()
        if not session.chat_enabled:
            return Response({'detail': 'Chat disabled.'}, status=403)
        messages = session.chat_messages.filter(is_deleted=False)[:RECENT_CHAT_LIMIT]
        return Response(LiveChatMessageSerializer(messages, many=True).data)

    @action(detail=True, methods=['post'])
    def send_message(self, request, pk=None):
        """Send a chat message in a live session."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if not session.is_live:
            return Response({'detail': 'Session is not live.'}, status=400)
        if not session.chat_enabled:
            return Response({'detail': 'Chat disabled.'}, status=403)
        if session.chat_banned_users.filter(pk=user.pk).exists():
            return Response({'detail': 'You are banned from this chat.'}, status=403)
        if session.slowmode_seconds and user.pk != session.user_id:
            cache_key = f'live:slowmode:{session.pk}:{user.pk}'
            if cache.get(cache_key):
                return Response(
                    {'detail': f'Slow mode: wait {session.slowmode_seconds}s between messages.'},
                    status=429,
                )
            cache.set(cache_key, 1, timeout=session.slowmode_seconds)
        text = (request.data.get('text') or '').strip()
        if not text or len(text) > 500:
            return Response({'detail': 'Invalid text.'}, status=400)
        msg = LiveChatMessage.objects.create(
            session=session, user=user, text=text[:500],
        )
        if session.auto_moderation:
            try:
                from moderation.hooks import soft_moderate_content
                result = soft_moderate_content(
                    text=text,
                    content_type='live_chat',
                    object_id=msg.id,
                    user=user,
                )
                if result.get('flagged') and not result.get('error'):
                    msg.is_deleted = True
                    msg.deleted_at = timezone.now()
                    msg.save(update_fields=['is_deleted', 'deleted_at'])
            except Exception:
                pass
        payload = LiveChatMessageSerializer(msg).data
        if not msg.is_deleted:
            try:
                from notifications.realtime import push_live_event
                push_live_event(session.id, {
                    'type': 'live.chat',
                    'session_id': session.id,
                    'message': payload,
                })
            except Exception:
                pass
        return Response(payload, status=201)

    @action(detail=True, methods=['post'])
    def react(self, request, pk=None):
        """Send a reaction (heart, fire, etc.)."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if not session.is_live:
            return Response({'detail': 'Session is not live.'}, status=400)
        reaction_type = (request.data.get('type') or 'heart').lower()
        valid = {r[0] for r in LiveReaction.REACTION_TYPES}
        if reaction_type not in valid:
            return Response({'detail': 'Invalid reaction type.'}, status=400)
        reaction = LiveReaction.objects.create(
            session=session, user=user, type=reaction_type,
        )
        return Response(LiveReactionSerializer(reaction).data, status=201)

    @action(detail=True, methods=['post'])
    def delete_message(self, request, pk=None):
        """Delete a chat message (host or admin only)."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if session.user_id != user.id:
            return Response({'detail': 'Only the host can delete messages.'}, status=403)
        msg_id = request.data.get('message_id')
        if not msg_id:
            return Response({'detail': 'message_id required.'}, status=400)
        try:
            msg = session.chat_messages.get(id=msg_id)
        except LiveChatMessage.DoesNotExist:
            return Response({'detail': 'Message not found.'}, status=404)
        msg.is_deleted = True
        msg.deleted_by = user
        msg.deleted_at = timezone.now()
        msg.save(update_fields=['is_deleted', 'deleted_by', 'deleted_at'])
        return Response({'detail': 'deleted'})

    @action(detail=True, methods=['post'], url_path='ban_chat')
    def ban_chat(self, request, pk=None):
        """Host bans a user from the live chat."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if session.user_id != user.id:
            return Response({'detail': 'Only the host can ban viewers.'}, status=403)
        target_id = request.data.get('user_id')
        if not target_id:
            return Response({'detail': 'user_id required.'}, status=400)
        from users.models import User as UserModel
        try:
            target = UserModel.objects.get(pk=target_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=404)
        session.chat_banned_users.add(target)
        return Response({'detail': 'banned', 'user_id': target.id})

    @action(detail=True, methods=['post'], url_path='unban_chat')
    def unban_chat(self, request, pk=None):
        """Host unbans a user from the live chat."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if session.user_id != user.id:
            return Response({'detail': 'Only the host can unban viewers.'}, status=403)
        target_id = request.data.get('user_id')
        if not target_id:
            return Response({'detail': 'user_id required.'}, status=400)
        from users.models import User as UserModel
        try:
            target = UserModel.objects.get(pk=target_id)
        except UserModel.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=404)
        session.chat_banned_users.remove(target)
        return Response({'detail': 'unbanned', 'user_id': target.id})

    @action(detail=True, methods=['post'], url_path='set_slowmode')
    def set_slowmode(self, request, pk=None):
        """Host configures slow-mode delay (0 = off, max 600s)."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if session.user_id != user.id:
            return Response({'detail': 'Only the host can set slowmode.'}, status=403)
        try:
            seconds = int(request.data.get('seconds', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'seconds must be an integer.'}, status=400)
        seconds = max(0, min(seconds, 600))
        session.slowmode_seconds = seconds
        session.save(update_fields=['slowmode_seconds', 'updated_at'])
        return Response({'slowmode_seconds': session.slowmode_seconds})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def gift(self, request, pk=None):
        """Send coin gift to the session host; debits sender's Profile.points."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        try:
            amount = int(request.data.get('amount', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'amount must be a positive integer.'}, status=400)
        if amount <= 0:
            return Response({'detail': 'amount must be positive.'}, status=400)
        if session.user_id == user.id:
            return Response({'detail': 'Cannot gift yourself.'}, status=400)
        from users.models import Profile
        from shop.models import Tip
        profile, _ = Profile.objects.select_for_update().get_or_create(user=user)
        if profile.points < amount:
            return Response({'detail': 'Insufficient coins.'}, status=400)
        profile.points -= amount
        profile.save(update_fields=['points'])
        Tip.objects.create(sender=user, recipient=session.user, amount=amount)
        try:
            from notifications.realtime import push_live_event
            push_live_event(session.id, {
                'type': 'live.gift',
                'session_id': session.id,
                'sender': user.username,
                'amount': amount,
            })
        except Exception:
            pass
        return Response({'detail': 'gift sent', 'amount': amount, 'remaining_coins': profile.points})

    @action(detail=True, methods=['post'], url_path='host-assist')
    def host_assist(self, request, pk=None):
        """Suggest 3 audience questions for the host."""
        user, err = require_user(request)
        if err:
            return err
        session = self.get_object()
        if session.user_id != user.id:
            return Response({'detail': 'Only the host can use host assist.'}, status=403)
        from outverse.ai_coaches import live_host_prompts
        lang = (request.data.get('lang') or 'en')[:2]
        return Response(live_host_prompts(
            title=session.title or '',
            description=session.description or '',
            language=lang if lang in ('en', 'ar') else 'en',
        ))

    @action(detail=True, methods=['post'], url_path='host-recap')
    def host_recap(self, request, pk=None):
        """Warm summary after a live ends (host or public after ended)."""
        session = self.get_object()
        user = user_from_request(request)
        if session.status != 'ended' and (not user or session.user_id != getattr(user, 'id', None)):
            return Response({'detail': 'Recap available after the stream ends (or for host).'}, status=400)
        from outverse.ai_coaches import live_host_recap
        snippets = list(
            session.chat_messages.filter(is_deleted=False)
            .order_by('-created_at')
            .values_list('text', flat=True)[:12]
        )
        lang = (request.data.get('lang') or request.query_params.get('lang') or 'en')[:2]
        return Response(live_host_recap(
            title=session.title or '',
            chat_snippets=snippets,
            language=lang if lang in ('en', 'ar') else 'en',
        ))


class LiveChatMessageViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to chat messages across sessions."""
    queryset = LiveChatMessage.objects.filter(is_deleted=False).select_related('user', 'session')
    serializer_class = LiveChatMessageSerializer
    permission_classes = [AllowAny]


class LiveReactionViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to reactions across sessions."""
    queryset = LiveReaction.objects.select_related('session').all()
    serializer_class = LiveReactionSerializer
    permission_classes = [AllowAny]
