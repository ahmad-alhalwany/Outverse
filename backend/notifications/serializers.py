from rest_framework import serializers

from .models import MarketingCampaign, Notification


class MarketingCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingCampaign
        fields = [
            'id', 'subject', 'body_html', 'segment', 'status',
            'recipient_count', 'created_at', 'updated_at', 'sent_at',
        ]
        read_only_fields = ['status', 'recipient_count', 'created_at', 'updated_at', 'sent_at']


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
    type = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'actor', 'verb', 'type', 'post', 'reel', 'story', 'idea', 'studio_session', 'text',
            'is_read', 'created_at',
        ]

    def get_type(self, obj):
        return obj.type or obj.verb
