from rest_framework import serializers

from outverse.auth_utils import user_from_request

from .models import Community


class CommunitySerializer(serializers.ModelSerializer):
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    is_member = serializers.SerializerMethodField()
    is_moderator = serializers.SerializerMethodField()
    is_pending = serializers.SerializerMethodField()
    is_banned = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = [
            'id', 'slug', 'name', 'description', 'cover_url', 'privacy', 'rules', 'flair_options',
            'is_nsfw', 'spoilers_enabled', 'posting_permission',
            'creator_username', 'members_count', 'posts_count', 'created_at',
            'is_member', 'is_moderator', 'is_pending', 'is_banned',
        ]
        read_only_fields = ['id', 'slug', 'members_count', 'posts_count', 'created_at']

    def validate_posting_permission(self, value):
        if value not in ('members', 'mods'):
            raise serializers.ValidationError('posting_permission must be members or mods.')
        return value

    def validate_rules(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Rules must be a list of strings.')
        return [str(item).strip() for item in value if str(item).strip()]

    def validate_flair_options(self, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Flair options must be a list of strings.')
        return [str(item).strip()[:40] for item in value if str(item).strip()]

    def _viewer(self):
        request = self.context.get('request')
        return user_from_request(request) if request else None

    def _membership(self, obj):
        viewer = self._viewer()
        if not viewer:
            return None
        return obj.memberships.filter(user_id=viewer.id).first()

    def get_is_member(self, obj):
        m = self._membership(obj)
        return bool(m and m.status == 'approved')

    def get_is_moderator(self, obj):
        viewer = self._viewer()
        if viewer and obj.creator_id == viewer.id:
            return True
        m = self._membership(obj)
        return bool(m and m.status == 'approved' and m.is_moderator)

    def get_is_pending(self, obj):
        m = self._membership(obj)
        return bool(m and m.status == 'pending')

    def get_is_banned(self, obj):
        m = self._membership(obj)
        return bool(m and m.status == 'banned')
