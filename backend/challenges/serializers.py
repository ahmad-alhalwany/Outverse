from rest_framework import serializers

from users.models import User

from .models import Challenge, Submission


class ChallengeUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class SubmissionSerializer(serializers.ModelSerializer):
    user = ChallengeUserSerializer(read_only=True)
    challenge = serializers.SerializerMethodField()
    challenge_title = serializers.CharField(source='challenge.title', read_only=True)
    created_at = serializers.DateTimeField(source='submitted_at', read_only=True)

    class Meta:
        model = Submission
        fields = ['id', 'challenge', 'challenge_title', 'user', 'content', 'submitted_at', 'created_at', 'is_approved']
        read_only_fields = ['user', 'submitted_at', 'created_at', 'is_approved', 'challenge_title']

    def get_challenge(self, obj):
        return {
            'id': obj.challenge_id,
            'title': obj.challenge.title,
            'type': obj.challenge.type,
            'cover_url': obj.challenge.cover_url,
        }


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