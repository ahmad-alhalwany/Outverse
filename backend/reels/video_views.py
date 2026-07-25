from django.db import IntegrityError
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request
from users.models import Follow

from .models import (
    LongFormVideo,
    VideoChapter,
    VideoPlaylist,
    VideoPlaylistItem,
)
from .serializers import UserSerializer


def _follows(viewer, author_id):
    if not viewer:
        return False
    return Follow.objects.filter(
        follower_id=viewer.id, following_id=author_id,
    ).exists()


def can_view_longform(video, viewer):
    if video.user_id == getattr(viewer, 'id', None):
        return True
    if video.status != 'published':
        return False
    if video.visibility == 'followers':
        return _follows(viewer, video.user_id)
    if video.visibility == 'subscribers':
        if not viewer:
            return False
        from subscriptions.models import CreatorSubscription

        sub = CreatorSubscription.objects.filter(
            fan_id=viewer.id, creator_id=video.user_id, status='active',
        ).select_related('tier').first()
        if not sub:
            return False
        if video.required_tier_id and sub.tier.price_usd_cents < video.required_tier.price_usd_cents:
            return False
    return video.visibility == 'public' or video.visibility == 'subscribers'


def publish_due_premiere_videos():
    now = timezone.now()
    return LongFormVideo.objects.filter(
        status='scheduled',
        premiere_at__lte=now,
    ).update(
        status='published',
        published_at=now,
        updated_at=now,
    )


class VideoChapterSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoChapter
        fields = ['id', 'video', 'title', 'start_seconds', 'order']
        read_only_fields = ['id', 'video']


class LongFormVideoSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    chapters = VideoChapterSerializer(many=True, read_only=True)
    is_premiere = serializers.SerializerMethodField()

    class Meta:
        model = LongFormVideo
        fields = [
            'id', 'user', 'title', 'description', 'video', 'thumbnail',
            'duration_seconds', 'status', 'premiere_at', 'published_at',
            'visibility', 'required_tier', 'views', 'chapters', 'is_premiere',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'user', 'views', 'published_at', 'chapters', 'is_premiere',
            'created_at', 'updated_at',
        ]

    def validate_required_tier(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or value.creator_id != user.id:
            raise serializers.ValidationError('required_tier must be one of your own creator tiers.')
        return value

    def get_is_premiere(self, obj):
        return bool(obj.premiere_at and obj.premiere_at > timezone.now())

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        return LongFormVideo.objects.create(user=user, **validated_data)


class VideoPlaylistItemSerializer(serializers.ModelSerializer):
    video = LongFormVideoSerializer(read_only=True)
    video_id = serializers.PrimaryKeyRelatedField(
        source='video',
        queryset=LongFormVideo.objects.all(),
        write_only=True,
    )

    class Meta:
        model = VideoPlaylistItem
        fields = ['id', 'video', 'video_id', 'order']
        read_only_fields = ['id', 'video']


class VideoPlaylistSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    items = serializers.SerializerMethodField()

    class Meta:
        model = VideoPlaylist
        fields = [
            'id', 'user', 'title', 'description', 'is_public', 'items',
            'created_at',
        ]
        read_only_fields = ['id', 'user', 'items', 'created_at']

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        return VideoPlaylist.objects.create(user=user, **validated_data)

    def get_items(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        rows = [
            item for item in obj.items.all()
            if can_view_longform(item.video, viewer)
        ]
        return VideoPlaylistItemSerializer(rows, many=True, context=self.context).data


class PremiereSerializer(serializers.Serializer):
    premiere_at = serializers.DateTimeField()


class LongFormVideoViewSet(viewsets.ModelViewSet):
    serializer_class = LongFormVideoSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action in ('list', 'retrieve') or (
            self.action == 'chapters' and self.request.method == 'GET'
        ):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        if self.action in ('list', 'retrieve'):
            publish_due_premiere_videos()
        viewer = user_from_request(self.request)
        qs = LongFormVideo.objects.select_related(
            'user', 'required_tier',
        ).prefetch_related('chapters').order_by('-created_at')
        if self.action == 'list':
            public_q = Q(status='published', visibility='public')
            if viewer:
                return qs.filter(public_q | Q(user_id=viewer.id))
            return qs.filter(public_q)
        return qs

    def retrieve(self, request, *args, **kwargs):
        video = self.get_object()
        if not can_view_longform(video, user_from_request(request)):
            return Response({'detail': 'Not allowed.'}, status=403)
        LongFormVideo.objects.filter(pk=video.pk).update(views=F('views') + 1)
        video.refresh_from_db(fields=['views'])
        return Response(self.get_serializer(video).data)

    def _require_owner(self, request, video):
        user, err = require_user(request)
        if err:
            return None, err
        if video.user_id != user.id and not user.is_staff:
            return None, Response({'detail': 'Not allowed.'}, status=403)
        return user, None

    def partial_update(self, request, *args, **kwargs):
        video = self.get_object()
        _, err = self._require_owner(request, video)
        if err:
            return err
        kwargs['partial'] = True
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        video = self.get_object()
        _, err = self._require_owner(request, video)
        if err:
            return err
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        video = self.get_object()
        _, err = self._require_owner(request, video)
        if err:
            return err
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        video = self.get_object()
        _, err = self._require_owner(request, video)
        if err:
            return err
        now = timezone.now()
        video.status = 'published'
        video.published_at = video.published_at or now
        video.save(update_fields=['status', 'published_at', 'updated_at'])
        return Response(self.get_serializer(video).data)

    @action(detail=True, methods=['post'])
    def premiere(self, request, pk=None):
        video = self.get_object()
        _, err = self._require_owner(request, video)
        if err:
            return err
        serializer = PremiereSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        video.premiere_at = serializer.validated_data['premiere_at']
        if video.premiere_at > timezone.now() and video.status != 'published':
            video.status = 'scheduled'
        video.save(update_fields=['premiere_at', 'status', 'updated_at'])
        return Response(self.get_serializer(video).data)

    @action(detail=True, methods=['get', 'post'])
    def chapters(self, request, pk=None):
        video = self.get_object()
        if request.method.lower() == 'get':
            if not can_view_longform(video, user_from_request(request)):
                return Response({'detail': 'Not allowed.'}, status=403)
            return Response(VideoChapterSerializer(video.chapters.all(), many=True).data)
        _, err = self._require_owner(request, video)
        if err:
            return err
        serializer = VideoChapterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        chapter = serializer.save(video=video)
        return Response(VideoChapterSerializer(chapter).data, status=201)


class VideoPlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = VideoPlaylistSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        viewer = user_from_request(self.request)
        qs = VideoPlaylist.objects.select_related('user').prefetch_related(
            'items__video__user', 'items__video__chapters',
        )
        if self.action == 'list':
            if viewer:
                return qs.filter(Q(is_public=True) | Q(user_id=viewer.id)).distinct()
            return qs.filter(is_public=True)
        return qs

    def _require_owner(self, request, playlist):
        user, err = require_user(request)
        if err:
            return None, err
        if playlist.user_id != user.id and not user.is_staff:
            return None, Response({'detail': 'Not allowed.'}, status=403)
        return user, None

    def retrieve(self, request, *args, **kwargs):
        playlist = self.get_object()
        viewer = user_from_request(request)
        if not playlist.is_public and (not viewer or playlist.user_id != viewer.id):
            return Response({'detail': 'Not allowed.'}, status=403)
        return Response(self.get_serializer(playlist).data)

    def partial_update(self, request, *args, **kwargs):
        playlist = self.get_object()
        _, err = self._require_owner(request, playlist)
        if err:
            return err
        kwargs['partial'] = True
        return super().partial_update(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        playlist = self.get_object()
        _, err = self._require_owner(request, playlist)
        if err:
            return err
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        playlist = self.get_object()
        _, err = self._require_owner(request, playlist)
        if err:
            return err
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='add_item')
    def add_item(self, request, pk=None):
        playlist = self.get_object()
        _, err = self._require_owner(request, playlist)
        if err:
            return err
        video_id = request.data.get('video_id') or request.data.get('video')
        if not video_id:
            return Response({'detail': 'video_id is required.'}, status=400)
        video = LongFormVideo.objects.filter(pk=video_id).first()
        if not video:
            return Response({'detail': 'Video not found.'}, status=404)
        if video.user_id != playlist.user_id:
            return Response({'detail': 'Only your videos can be added.'}, status=403)
        try:
            item, created = VideoPlaylistItem.objects.get_or_create(
                playlist=playlist,
                video=video,
                defaults={'order': request.data.get('order') or 0},
            )
        except IntegrityError:
            item = VideoPlaylistItem.objects.get(playlist=playlist, video=video)
            created = False
        return Response(
            VideoPlaylistItemSerializer(item, context=self.get_serializer_context()).data,
            status=201 if created else 200,
        )

    @action(detail=True, methods=['post', 'delete'], url_path='remove_item')
    def remove_item(self, request, pk=None):
        playlist = self.get_object()
        _, err = self._require_owner(request, playlist)
        if err:
            return err
        video_id = request.data.get('video_id') or request.data.get('video')
        item_id = request.data.get('item_id') or request.data.get('item')
        qs = VideoPlaylistItem.objects.filter(playlist=playlist)
        if item_id:
            qs = qs.filter(pk=item_id)
        elif video_id:
            qs = qs.filter(video_id=video_id)
        else:
            return Response({'detail': 'video_id or item_id is required.'}, status=400)
        deleted, _ = qs.delete()
        if not deleted:
            return Response({'detail': 'Item not found.'}, status=404)
        return Response(status=204)
