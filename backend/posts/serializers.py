from rest_framework import serializers
from .models import Post, PostMedia
from users.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']

class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = ['id', 'media_file', 'media_type', 'order']

class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    
    class Meta:
        model = Post
        fields = ['id', 'user', 'user_id', 'text', 'media', 'created_at', 'views', 'comments_count', 'likes_count']
        read_only_fields = ['created_at', 'views', 'comments_count', 'likes_count'] 