from rest_framework import serializers

from outverse.auth_utils import user_from_request
from users.models import User

from .models import Idea


class IdeaUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class IdeaSerializer(serializers.ModelSerializer):
    owner = IdeaUserSerializer(read_only=True)
    owner_id = serializers.IntegerField(write_only=True, required=False)
    supporters = serializers.SerializerMethodField()
    collaborators_count = serializers.SerializerMethodField()
    collaborators = IdeaUserSerializer(many=True, read_only=True)

    class Meta:
        model = Idea
        fields = [
            'id', 'title', 'description', 'owner', 'owner_id',
            'category', 'cover_url', 'status', 'roles_needed',
            'funding_goal', 'funding_raised', 'supporters',
            'collaborators', 'collaborators_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_supporters(self, obj):
        return obj.votes.count()

    def get_collaborators_count(self, obj):
        return obj.collaborators.count()

    def create(self, validated_data):
        owner_id = validated_data.pop('owner_id', None)
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not owner_id and viewer:
            owner_id = viewer.id
        if not owner_id:
            raise serializers.ValidationError(
                {'owner': 'Authentication required to create an idea.'}
            )
        return Idea.objects.create(owner_id=owner_id, **validated_data)
