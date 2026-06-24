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
        ]

    def validate_notification_prefs(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('notification_prefs must be an object.')
        normalized = DEFAULT_NOTIFICATION_PREFS.copy()
        for key, enabled in value.items():
            normalized[str(key)] = bool(enabled)
        return normalized

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['notification_prefs'] = {
            **DEFAULT_NOTIFICATION_PREFS,
            **(instance.notification_prefs or {}),
        }
        return data
