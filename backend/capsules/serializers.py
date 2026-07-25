from rest_framework import serializers

from .models import TimeCapsule


class TimeCapsuleSerializer(serializers.ModelSerializer):
    """Serializer that hides text + voice for capsules that haven't unlocked yet.

    The list endpoint returns metadata (id, dates) for locked capsules so the
    UI can show countdowns, but the payload itself is sealed until open_at.
    """

    is_unlocked = serializers.BooleanField(read_only=True)
    is_opened = serializers.BooleanField(read_only=True)
    voice_url = serializers.SerializerMethodField()

    class Meta:
        model = TimeCapsule
        fields = [
            'id',
            'text',
            'voice_url',
            'created_at',
            'open_at',
            'opened_at',
            'is_unlocked',
            'is_opened',
        ]
        read_only_fields = ['created_at', 'opened_at', 'is_unlocked', 'is_opened', 'voice_url']

    def get_voice_url(self, obj):
        if not obj.voice:
            return ''
        request = self.context.get('request')
        path = obj.voice.url
        if request:
            return request.build_absolute_uri(path)
        return path

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Seal the payload until the capsule unlocks.
        if not instance.is_unlocked:
            ret['text'] = ''
            ret['voice_url'] = ''
        return ret


class TimeCapsuleCreateSerializer(serializers.ModelSerializer):
    """Write-only serializer for creating capsules with a duration shortcut."""

    class Meta:
        model = TimeCapsule
        fields = ['text', 'voice', 'open_at']

    def validate_text(self, value):
        if not value or not value.strip() or len(value.strip()) < 4:
            raise serializers.ValidationError('Write a slightly longer message.')
        return value.strip()
