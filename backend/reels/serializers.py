from django.db.models import Count
from rest_framework import serializers

from outverse.auth_utils import user_from_request

from users.models import User

from .models import Reel, ReelComment, ReelMusicTrack


def reaction_counts_for(queryset):
    data = queryset.values('type').annotate(c=Count('id'))
    return {row['type']: row['c'] for row in data}


def reaction_counts_for_comment(comment):
    return reaction_counts_for(comment.reactions.all())


def my_reaction_for(queryset, user):
    if not user:
        return None
    reaction = queryset.filter(user_id=user.id).first()
    return reaction.type if reaction else None


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


def absolute_media(request, field):
    if not field:
        return ''
    path = field.url
    if request:
        return request.build_absolute_uri(path)
    return path


class ReelMusicTrackSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = ReelMusicTrack
        fields = [
            'id', 'slug', 'title', 'artist_label', 'mood',
            'audio_url', 'order',
        ]

    def get_audio_url(self, obj):
        request = self.context.get('request')
        if obj.audio_file:
            return absolute_media(request, obj.audio_file)
        if obj.source_path and request:
            return request.build_absolute_uri(obj.source_path)
        return obj.source_path or ''


class ReelCommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()

    def validate(self, attrs):
        text = (attrs.get('text') or '').strip()
        gif = (attrs.get('gif_url') or '').strip()
        sticker = (attrs.get('sticker_url') or '').strip()
        if not text and not gif and not sticker:
            raise serializers.ValidationError(
                'Provide text, gif_url, or sticker_url.'
            )
        attrs['text'] = text
        return attrs

    class Meta:
        model = ReelComment
        fields = [
            'id', 'reel', 'parent', 'user', 'text', 'gif_url', 'sticker_url',
            'created_at', 'replies', 'reaction_counts', 'my_reaction',
        ]
        read_only_fields = ['created_at', 'user']

    def get_replies(self, obj):
        if obj.parent_id is not None:
            return []
        return ReelCommentSerializer(
            obj.replies.select_related('user').prefetch_related('reactions'),
            many=True,
            context=self.context,
        ).data

    def get_reaction_counts(self, obj):
        return reaction_counts_for_comment(obj)

    def get_my_reaction(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        return my_reaction_for(obj.reactions.all(), viewer)

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        return ReelComment.objects.create(user=user, **validated_data)


class ReelSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    video = serializers.SerializerMethodField()
    custom_audio_url = serializers.SerializerMethodField()
    music_track = serializers.PrimaryKeyRelatedField(
        queryset=ReelMusicTrack.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    music_track_detail = ReelMusicTrackSerializer(
        source='music_track', read_only=True
    )
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = Reel
        fields = [
            'id', 'user', 'video', 'caption', 'mood', 'filter_style', 'tags',
            'sound_label', 'music_track', 'music_track_detail', 'custom_audio_url',
            'music_start_seconds', 'music_end_seconds',
            'duration_seconds', 'views', 'likes_count', 'comments_count',
            'is_liked', 'is_featured', 'created_at', 'is_active',
        ]
        read_only_fields = [
            'created_at', 'views', 'likes_count', 'comments_count',
            'is_active', 'is_featured',
        ]

    def get_video(self, obj):
        return absolute_media(self.context.get('request'), obj.video)

    def get_custom_audio_url(self, obj):
        return absolute_media(self.context.get('request'), obj.custom_audio)

    def get_is_liked(self, obj):
        liked_ids = self.context.get('liked_ids')
        if liked_ids is not None:
            return obj.id in liked_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return obj.likes.filter(user_id=viewer.id).exists()

    def validate(self, attrs):
        start = attrs.get('music_start_seconds', 0) or 0
        end = attrs.get('music_end_seconds')
        if start < 0:
            raise serializers.ValidationError(
                {'music_start_seconds': 'Must be zero or positive.'}
            )
        if end is not None and end <= start:
            raise serializers.ValidationError(
                {'music_end_seconds': 'End must be after start.'}
            )
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        return Reel.objects.create(user=user, **validated_data)
