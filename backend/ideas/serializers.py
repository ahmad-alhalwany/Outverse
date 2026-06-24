from rest_framework import serializers

from users.models import User

from .models import CollaborationRequest, Idea, IdeaComment


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
    collaboration_request_count = serializers.IntegerField(read_only=True)
    discussion_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Idea
        fields = [
            'id', 'title', 'description', 'owner', 'owner_id',
            'category', 'cover_url', 'status', 'roles_needed',
            'funding_goal', 'funding_raised', 'supporters',
            'collaborators', 'collaborators_count',
            'collaboration_request_count', 'discussion_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_supporters(self, obj):
        return obj.votes.count()

    def get_collaborators_count(self, obj):
        return obj.collaborators.count()


class CollaborationRequestSerializer(serializers.ModelSerializer):
    user = IdeaUserSerializer(read_only=True)

    class Meta:
        model = CollaborationRequest
        fields = ["id", "idea", "user", "role", "message", "status", "created_at"]
        read_only_fields = ["id", "idea", "user", "status", "created_at"]


class IdeaCommentSerializer(serializers.ModelSerializer):
    user = IdeaUserSerializer(read_only=True)

    class Meta:
        model = IdeaComment
        fields = ["id", "idea", "user", "content", "created_at", "updated_at"]
        read_only_fields = ["id", "idea", "user", "created_at", "updated_at"]
