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
        ch = obj.challenge
        cover = ch.cover_url or ''
        if ch.cover_image:
            url = ch.cover_image.url
            request = self.context.get('request')
            cover = request.build_absolute_uri(url) if request else url
        return {
            'id': obj.challenge_id,
            'title': ch.title,
            'type': ch.type,
            'cover_url': cover,
        }


class ChallengeSerializer(serializers.ModelSerializer):
    participants = serializers.SerializerMethodField()
    type_display = serializers.CharField(
        source='get_type_display', read_only=True
    )
    created_by = ChallengeUserSerializer(read_only=True)
    is_owner = serializers.SerializerMethodField()
    cover_image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    cover_url = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Challenge
        fields = [
            'id', 'title', 'description', 'type', 'type_display',
            'difficulty', 'cover_url', 'cover_image', 'is_daily', 'is_active',
            'is_ai_generated', 'created_by', 'is_owner',
            'created_at', 'end_date', 'participants',
        ]
        read_only_fields = [
            'created_at', 'is_daily', 'is_ai_generated', 'created_by',
            'is_owner', 'type_display', 'participants',
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['cover_url'] = self._resolved_cover_url(instance)
        return data

    def _resolved_cover_url(self, obj):
        if obj.cover_image:
            url = obj.cover_image.url
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(url)
            return url
        return obj.cover_url or ''

    def get_participants(self, obj):
        return obj.submissions.count()

    def get_is_owner(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return False
        if user.is_staff:
            return True
        return bool(obj.created_by_id and obj.created_by_id == user.id)

    def validate_type(self, value):
        allowed = {c[0] for c in Challenge.CHALLENGE_TYPES}
        if value not in allowed:
            raise serializers.ValidationError('Invalid challenge type.')
        return value

    def validate_difficulty(self, value):
        allowed = {c[0] for c in Challenge.DIFFICULTY_CHOICES}
        if value not in allowed:
            raise serializers.ValidationError('Invalid difficulty.')
        return value
