from rest_framework import serializers

from users.models import User

from .character_ai import emoji_for
from .models import Character, FailedIdea, FailedIdeaComment, FutureMemory


class SpecUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']


class FailedIdeaCommentSerializer(serializers.ModelSerializer):
    user = SpecUserSerializer(read_only=True)

    class Meta:
        model = FailedIdeaComment
        fields = ['id', 'failed_idea', 'user', 'content', 'created_at']
        read_only_fields = ['id', 'failed_idea', 'user', 'created_at']


class FailedIdeaSerializer(serializers.ModelSerializer):
    user = SpecUserSerializer(read_only=True)
    exhibition_display = serializers.CharField(source='get_exhibition_display', read_only=True)
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = FailedIdea
        fields = [
            'id', 'title', 'description', 'lesson_learned', 'exhibition',
            'exhibition_display', 'cover_url', 'user', 'likes_count',
            'comments_count', 'is_liked', 'created_at',
        ]
        read_only_fields = ['user', 'created_at']

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_is_liked(self, obj):
        liked_ids = self.context.get('liked_failed_idea_ids')
        if liked_ids is None:
            return False
        return obj.id in liked_ids


class FutureMemorySerializer(serializers.ModelSerializer):
    user = SpecUserSerializer(read_only=True)

    class Meta:
        model = FutureMemory
        fields = ['id', 'text', 'tag', 'is_public', 'user', 'created_at']
        read_only_fields = ['user', 'created_at']


class CharacterSerializer(serializers.ModelSerializer):
    creator = SpecUserSerializer(read_only=True)
    rarity_display = serializers.CharField(source='get_rarity_display', read_only=True)
    owned = serializers.SerializerMethodField()
    emoji = serializers.SerializerMethodField()

    class Meta:
        model = Character
        fields = [
            'id', 'name', 'description', 'rarity', 'rarity_display',
            'image_url', 'emoji', 'price', 'creator', 'is_ai_generated',
            'is_public', 'created_at', 'owned',
        ]
        read_only_fields = ['creator', 'is_ai_generated', 'created_at']

    def get_emoji(self, obj):
        return emoji_for(obj.id, obj.emoji)

    def get_owned(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return False
        return obj.owners.filter(user_id=user.id).exists()
