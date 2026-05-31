from rest_framework import serializers
<<<<<<< HEAD

from outverse.auth_utils import user_from_request

from .models import Story
from users.models import User


=======
from .models import Story
from users.models import User

>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']

<<<<<<< HEAD

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
=======
class StorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)
    
    class Meta:
        model = Story
        fields = ['id', 'user', 'user_id', 'text', 'image', 'video', 'created_at', 'views', 'is_active']
        read_only_fields = ['created_at', 'views'] 
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
