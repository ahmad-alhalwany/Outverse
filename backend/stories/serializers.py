from rest_framework import serializers
from .models import Story
from users.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']

class StorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Story
        fields = ['id', 'user', 'user_id', 'text', 'image', 'video', 'created_at', 'views', 'is_active']
        read_only_fields = ['created_at', 'views'] 