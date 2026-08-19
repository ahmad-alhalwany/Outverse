import json
import uuid

from rest_framework import serializers

from users.models import User

from .models import CollaborationRequest, Idea, IdeaComment, IdeaPledge


def normalize_milestones(raw):
    if isinstance(raw, str):
        raw = raw.strip()
        if not raw:
            return []
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise serializers.ValidationError('milestones must be a JSON list.') from exc
    if not isinstance(raw, list):
        raise serializers.ValidationError('milestones must be a list.')
    normalized = []
    for item in raw:
        if isinstance(item, str):
            title = item.strip()
            if not title:
                continue
            normalized.append({
                'id': str(uuid.uuid4()),
                'title': title,
                'done': False,
                'due_date': None,
            })
            continue
        if not isinstance(item, dict):
            raise serializers.ValidationError('Each milestone must be an object.')
        title = (item.get('title') or '').strip()
        if not title:
            raise serializers.ValidationError('Each milestone needs a title.')
        milestone_id = (item.get('id') or '').strip() or str(uuid.uuid4())
        due_date = item.get('due_date')
        if due_date == '':
            due_date = None
        normalized.append({
            'id': milestone_id,
            'title': title,
            'done': bool(item.get('done')),
            'due_date': due_date,
        })
    return normalized


def parse_string_list(value, *, field_name):
    if value is None or value == '':
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return [part.strip() for part in text.split(',') if part.strip()]
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    raise serializers.ValidationError(f'{field_name} must be a list.')


class IdeaUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class IdeaSerializer(serializers.ModelSerializer):
    owner = IdeaUserSerializer(read_only=True)
    supporters = serializers.SerializerMethodField()
    collaborators_count = serializers.SerializerMethodField()
    collaborators = IdeaUserSerializer(many=True, read_only=True)
    collaboration_request_count = serializers.IntegerField(read_only=True)
    discussion_count = serializers.IntegerField(read_only=True)
    pledges = serializers.SerializerMethodField()
    is_voted = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    collab_project_id = serializers.SerializerMethodField()
    silent_unlocked = serializers.SerializerMethodField()
    cover_image = serializers.ImageField(required=False, allow_null=True, write_only=True)
    cover_url = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Idea
        fields = [
            'id', 'title', 'description', 'owner',
            'category', 'cover_url', 'cover_image', 'status', 'roles_needed', 'tags',
            'target_date', 'milestones',
            'funding_goal', 'funding_raised', 'supporters',
            'collaborators', 'collaborators_count',
            'collaboration_request_count', 'discussion_count', 'pledges',
            'is_voted', 'is_saved', 'is_owner', 'collab_project_id', 'silent_unlocked',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'status', 'funding_raised']

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

    def validate_milestones(self, value):
        return normalize_milestones(value)

    def validate_roles_needed(self, value):
        return parse_string_list(value, field_name='roles_needed')

    def validate_tags(self, value):
        return parse_string_list(value, field_name='tags')

    def validate_funding_goal(self, value):
        if value in ('', None):
            return None
        return value

    def validate_target_date(self, value):
        if value in ('', None):
            return None
        return value

    def get_supporters(self, obj):
        return obj.votes.count()

    def get_collaborators_count(self, obj):
        return obj.collaborators.count()

    def get_pledges(self, obj):
        rows = []
        for pledge in obj.pledges.select_related('user')[:5]:
            data = IdeaPledgeSerializer(pledge).data
            if pledge.is_anonymous:
                data['user'] = None
            rows.append(data)
        return rows

    def get_is_voted(self, obj):
        voted_ids = self.context.get('voted_idea_ids')
        if voted_ids is None:
            return False
        return obj.id in voted_ids

    def get_is_saved(self, obj):
        saved_ids = self.context.get('saved_idea_ids')
        if saved_ids is None:
            return False
        return obj.id in saved_ids

    def get_is_owner(self, obj):
        viewer = self.context.get('viewer')
        return bool(viewer and viewer.id == obj.owner_id)

    def get_collab_project_id(self, obj):
        project = getattr(obj, 'collab_project', None)
        return project.id if project else None

    def get_silent_unlocked(self, obj):
        goal = obj.funding_goal
        if goal and goal > 0:
            return obj.funding_raised >= goal
        return obj.funding_raised >= 100


class IdeaPledgeSerializer(serializers.ModelSerializer):
    user = IdeaUserSerializer(read_only=True)

    class Meta:
        model = IdeaPledge
        fields = ["id", "idea", "user", "amount", "is_anonymous", "created_at"]
        read_only_fields = ["id", "idea", "user", "created_at"]


class CollaborationRequestSerializer(serializers.ModelSerializer):
    user = IdeaUserSerializer(read_only=True)

    class Meta:
        model = CollaborationRequest
        fields = ["id", "idea", "user", "role", "message", "status", "created_at"]
        read_only_fields = ["id", "idea", "user", "status", "created_at"]


class IdeaCommentSerializer(serializers.ModelSerializer):
    user = IdeaUserSerializer(read_only=True)

    class Meta:
        model = IdeaComment
        fields = ["id", "idea", "user", "content", "created_at", "updated_at"]
        read_only_fields = ["id", "idea", "user", "created_at", "updated_at"]
