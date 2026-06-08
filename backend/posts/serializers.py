from django.db.models import Count
from rest_framework import serializers

from outverse.auth_utils import user_from_request

from .models import Comment, CommentReaction, Post, PostMedia, Reaction
from users.models import User


def reaction_counts_for(queryset):
    data = queryset.values('type').annotate(c=Count('id'))
    return {row['type']: row['c'] for row in data}


def reaction_counts_for_post(post):
    return reaction_counts_for(post.reactions.all())


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


class PostMediaSerializer(serializers.ModelSerializer):
    media_file = serializers.SerializerMethodField()

    class Meta:
        model = PostMedia
        fields = ['id', 'media_file', 'media_type', 'order']

    def get_media_file(self, obj):
        if not obj.media_file:
            return ''
        request = self.context.get('request')
        path = obj.media_file.url
        if request:
            return request.build_absolute_uri(path)
        return path


class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'user', 'text', 'mood', 'tags', 'media',
            'created_at', 'views', 'comments_count', 'likes_count',
            'shares_count', 'reaction_counts', 'my_reaction', 'is_saved',
        ]
        read_only_fields = [
            'created_at', 'views', 'comments_count', 'likes_count', 'shares_count',
        ]

    def get_reaction_counts(self, obj):
        return reaction_counts_for_post(obj)

    def get_my_reaction(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        return my_reaction_for(obj.reactions.all(), viewer)

    def get_is_saved(self, obj):
        saved_ids = self.context.get('saved_ids')
        if saved_ids is not None:
            return obj.id in saved_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return obj.saves.filter(user_id=viewer.id).exists()


class CommentSerializer(serializers.ModelSerializer):
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
        model = Comment
        fields = [
            'id', 'post', 'parent', 'user', 'text', 'gif_url', 'sticker_url',
            'created_at', 'replies', 'reaction_counts', 'my_reaction',
        ]
        read_only_fields = ['created_at', 'user']

    def get_reaction_counts(self, obj):
        return reaction_counts_for_comment(obj)

    def get_my_reaction(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        return my_reaction_for(obj.reactions.all(), viewer)

    def get_replies(self, obj):
        if obj.parent_id is not None:
            return []
        return CommentSerializer(
            obj.replies.select_related('user').prefetch_related('reactions'),
            many=True,
            context=self.context,
        ).data
