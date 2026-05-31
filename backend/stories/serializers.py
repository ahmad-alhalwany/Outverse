from rest_framework import serializers

from outverse.auth_utils import user_from_request

from .models import Story
from users.models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class StorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Story
        fields = [
            'id', 'user', 'text', 'image', 'video',
            'created_at', 'views', 'is_active',
        ]
        read_only_fields = ['created_at', 'views']

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        return Story.objects.create(user=user, **validated_data)
