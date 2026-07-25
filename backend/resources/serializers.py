from rest_framework import serializers

from .models import Resource


class ResourceSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    mood_display = serializers.CharField(source='get_mood_display', read_only=True)
    creator_username = serializers.CharField(source='creator.username', read_only=True, default=None)

    class Meta:
        model = Resource
        fields = [
            'id', 'title', 'description', 'type', 'type_display', 'mood', 'mood_display',
            'file_url', 'cover_url', 'file_size_label', 'download_count',
            'creator_username', 'created_at',
        ]
        read_only_fields = ['download_count', 'created_at']
