from rest_framework import serializers
from .models import ContentAppeal, FlaggedContent


class FlaggedContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FlaggedContent
        fields = '__all__'
        read_only_fields = ['reporter']


class ContentAppealSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentAppeal
        fields = [
            'id',
            'user',
            'flagged_content',
            'content_type',
            'object_id',
            'reason',
            'status',
            'created_at',
            'staff_note',
        ]
        read_only_fields = ['id', 'user', 'status', 'created_at', 'staff_note']