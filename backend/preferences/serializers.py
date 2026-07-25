from rest_framework import serializers

from .models import UserPreferences


DEFAULT_NOTIFICATION_PREFS = {
    'likes': True,
    'comments': True,
    'follows': True,
    'reels': True,
    'ideas': True,
    'stories': True,
    'bottles': True,
    'shop': True,
}


class UserPreferencesSerializer(serializers.ModelSerializer):
    notification_prefs = serializers.JSONField(required=False)

    class Meta:
        model = UserPreferences
        fields = [
            'locale',
            'theme',
            'vault_map_style',
            'notification_prefs',
            'profile_visibility',
            'bottle_privacy',
            'online_status_visible',
            'read_receipts_enabled',
            'weirdness_level',
            'message_frequency',
            'dm_policy',
            'comment_policy',
            'mention_policy',
            'tag_policy',
            'hidden_words',
            'quiet_hours_start',
            'quiet_hours_end',
            'default_allow_remix',
            'default_allow_weave',
            'default_allow_download',
            'default_reply_control',
        ]

    def validate_default_reply_control(self, value):
        allowed = {'everyone', 'followers', 'nobody'}
        if value not in allowed:
            raise serializers.ValidationError(
                'default_reply_control must be everyone, followers, or nobody.',
            )
        return value

    def validate_weirdness_level(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError('weirdness_level must be between 0 and 100.')
        return value

    def validate_notification_prefs(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('notification_prefs must be an object.')
        normalized = DEFAULT_NOTIFICATION_PREFS.copy()
        for key, enabled in value.items():
            normalized[str(key)] = bool(enabled)
        return normalized

    def validate_hidden_words(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('hidden_words must be a list.')
        return [str(w).strip() for w in value if str(w).strip()][:50]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['notification_prefs'] = {
            **DEFAULT_NOTIFICATION_PREFS,
            **(instance.notification_prefs or {}),
        }
        return data
