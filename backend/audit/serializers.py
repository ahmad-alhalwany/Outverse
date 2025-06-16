from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()
    action_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_email', 'action', 'action_display',
            'description', 'ip_address', 'created_at', 'metadata'
        ]

    def get_user_email(self, obj):
        return obj.user.email if obj.user else 'System'

    def get_action_display(self, obj):
        return obj.get_action_display() 