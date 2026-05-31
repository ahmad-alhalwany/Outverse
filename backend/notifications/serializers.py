from rest_framework import serializers

from .models import Notification


class NotificationActorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    avatar = serializers.SerializerMethodField()

    def get_avatar(self, obj):
        request = self.context.get('request')
        if getattr(obj, 'avatar', None):
            url = obj.avatar.url
            return request.build_absolute_uri(url) if request else url
        return None


class NotificationSerializer(serializers.ModelSerializer):
    actor = NotificationActorSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'actor', 'verb', 'post', 'text',
            'is_read', 'created_at',
        ]
