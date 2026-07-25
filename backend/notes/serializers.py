from rest_framework import serializers

from users.models import User
from .models import Note


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class NoteSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = Note
        fields = [
            'id', 'user', 'text', 'theme',
            'created_at', 'expires_at', 'is_expired',
        ]
        read_only_fields = ['created_at', 'expires_at', 'is_expired']
