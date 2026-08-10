from rest_framework import serializers

from users.models import User

from .models import Character, FailedIdea, FutureMemory


class SpecUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']


class FailedIdeaSerializer(serializers.ModelSerializer):
    user = SpecUserSerializer(read_only=True)
    exhibition_display = serializers.CharField(source='get_exhibition_display', read_only=True)

    class Meta:
        model = FailedIdea
        fields = [
            'id', 'title', 'description', 'lesson_learned', 'exhibition',
            'exhibition_display', 'cover_url', 'user', 'created_at',
        ]
        read_only_fields = ['user', 'created_at']


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

    class Meta:
        model = Character
        fields = [
            'id', 'name', 'description', 'rarity', 'rarity_display',
            'image_url', 'price', 'creator', 'created_at', 'owned',
        ]
        read_only_fields = ['creator', 'created_at']

    def get_owned(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return False
        return obj.owners.filter(user_id=user.id).exists()
