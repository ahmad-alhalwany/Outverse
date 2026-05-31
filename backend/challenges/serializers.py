from rest_framework import serializers

from users.models import User

from .models import Challenge, Submission


class ChallengeUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class SubmissionSerializer(serializers.ModelSerializer):
    user = ChallengeUserSerializer(read_only=True)

    class Meta:
        model = Submission
        fields = ['id', 'user', 'content', 'submitted_at', 'is_approved']


class ChallengeSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    type_display = serializers.CharField(
        source='get_type_display', read_only=True
    )

    class Meta:
        model = Challenge
        fields = [
            'id', 'title', 'description', 'type', 'type_display',
            'difficulty', 'cover_url', 'is_daily', 'is_active',
            'created_at', 'end_date', 'participants',
        ]
        read_only_fields = ['created_at']

    def get_participants(self, obj):
        return obj.submissions.count()
