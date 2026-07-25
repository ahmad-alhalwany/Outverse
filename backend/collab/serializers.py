from rest_framework import serializers

from users.models import User

from .models import Project, ProjectMember, ProjectTask


class CollabUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar']


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = CollabUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'user_id', 'role', 'current_task', 'joined_at']


class ProjectTaskSerializer(serializers.ModelSerializer):
    assignee = CollabUserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='assignee', write_only=True,
        required=False, allow_null=True,
    )

    class Meta:
        model = ProjectTask
        fields = ['id', 'project', 'title', 'status', 'assignee', 'assignee_id', 'created_at', 'updated_at']
        read_only_fields = ['project', 'created_at', 'updated_at']


class ProjectSerializer(serializers.ModelSerializer):
    owner = CollabUserSerializer(read_only=True)
    members = ProjectMemberSerializer(many=True, read_only=True)
    tasks = ProjectTaskSerializer(many=True, read_only=True)
    tasks_completed = serializers.SerializerMethodField()
    tasks_total = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'title', 'description', 'status', 'owner', 'deadline',
            'members', 'tasks', 'tasks_completed', 'tasks_total',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['owner', 'created_at', 'updated_at']

    def get_tasks_completed(self, obj):
        return obj.tasks.filter(status='done').count()

    def get_tasks_total(self, obj):
        return obj.tasks.count()
