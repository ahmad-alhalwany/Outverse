from rest_framework import serializers

from outverse.auth_utils import user_from_request
from users.models import User

from .models import Segment, SegmentDialogue, Story, StoryCollaborator, StorySave


class NarrativeUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class SegmentDialogueSerializer(serializers.ModelSerializer):
    author = NarrativeUserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()

    class Meta:
        model = SegmentDialogue
        fields = [
            'id', 'author', 'text', 'parent', 'replies', 'created_at',
        ]
        read_only_fields = ['created_at']

    def get_replies(self, obj):
        if obj.parent_id:
            return []
        qs = obj.replies.select_related('author').all()
        return SegmentDialogueSerializer(qs, many=True, context=self.context).data


class SegmentSerializer(serializers.ModelSerializer):
    author = NarrativeUserSerializer(read_only=True)
    dialogues_count = serializers.SerializerMethodField()
    dialogues = serializers.SerializerMethodField()

    class Meta:
        model = Segment
        fields = [
            'id', 'author', 'content', 'order', 'votes', 'status',
            'dialogues_count', 'dialogues', 'created_at',
        ]

    def get_dialogues_count(self, obj):
        return obj.dialogues.count()

    def get_dialogues(self, obj):
        include = self.context.get('include_dialogues')
        if not include:
            return []
        qs = obj.dialogues.filter(parent__isnull=True).select_related('author')
        return SegmentDialogueSerializer(qs, many=True, context=self.context).data


class StoryCollaboratorSerializer(serializers.ModelSerializer):
    user = NarrativeUserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True, required=False,
    )
    username = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = StoryCollaborator
        fields = [
            'id', 'user', 'user_id', 'username', 'role', 'status',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['status', 'created_at', 'updated_at']


class StorySerializer(serializers.ModelSerializer):
    owner = NarrativeUserSerializer(read_only=True)
    owner_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='owner',
        write_only=True,
        required=False,
        allow_null=True,
    )
    genre_display = serializers.CharField(
        source='get_genre_display', read_only=True
    )
    segment_count = serializers.SerializerMethodField()
    approved_segment_count = serializers.SerializerMethodField()
    pending_segment_count = serializers.SerializerMethodField()
    contributors_count = serializers.SerializerMethodField()
    word_count = serializers.SerializerMethodField()
    can_contribute = serializers.SerializerMethodField()
    can_edit_bible = serializers.SerializerMethodField()
    can_approve = serializers.SerializerMethodField()
    can_revise = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    is_studio_member = serializers.SerializerMethodField()
    can_request_join = serializers.SerializerMethodField()
    my_collab_status = serializers.SerializerMethodField()
    my_role = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = [
            'id', 'title', 'premise', 'cover_url', 'cover_prompt', 'genre',
            'genre_display', 'status', 'visibility', 'studio_mode', 'require_approval',
            'tone', 'pov', 'content_rules', 'outline', 'characters', 'world_notes',
            'writing_goal', 'max_segments', 'target_words',
            'is_featured', 'owner', 'owner_id',
            'segment_count', 'approved_segment_count', 'pending_segment_count',
            'contributors_count', 'word_count', 'can_contribute', 'can_edit_bible',
            'can_approve', 'can_revise', 'is_owner', 'is_studio_member',
            'can_request_join', 'my_collab_status', 'my_role', 'is_saved',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['status', 'created_at', 'updated_at']

    def _viewer(self):
        request = self.context.get('request')
        return user_from_request(request) if request else None

    def get_segment_count(self, obj):
        return obj.segments.count()

    def get_approved_segment_count(self, obj):
        return obj.segments.filter(status='approved').count()

    def get_pending_segment_count(self, obj):
        return obj.segments.filter(status='pending').count()

    def get_contributors_count(self, obj):
        from_segments = (
            obj.segments.filter(status='approved')
            .exclude(author__isnull=True)
            .values('author')
            .distinct()
            .count()
        )
        from_collab = obj.collaborators.filter(status='accepted').count()
        return max(from_segments, from_collab)

    def get_word_count(self, obj):
        total = 0
        for content in obj.segments.filter(status='approved').values_list('content', flat=True):
            total += len((content or '').split())
        return total

    def get_can_contribute(self, obj):
        return obj.can_contribute(self._viewer())

    def get_can_edit_bible(self, obj):
        return obj.can_edit_bible(self._viewer())

    def get_can_approve(self, obj):
        return obj.can_approve(self._viewer())

    def get_can_revise(self, obj):
        return obj.can_revise_segments(self._viewer())

    def get_is_owner(self, obj):
        return obj.is_owner(self._viewer())

    def get_is_studio_member(self, obj):
        return obj.is_studio_member(self._viewer())

    def get_can_request_join(self, obj):
        return obj.can_request_join(self._viewer())

    def get_my_collab_status(self, obj):
        return obj.collab_status_for(self._viewer())

    def get_my_role(self, obj):
        return obj.role_for(self._viewer())

    def get_is_saved(self, obj):
        viewer = self._viewer()
        if not viewer:
            return False
        return StorySave.objects.filter(user=viewer, story=obj).exists()

    def create(self, validated_data):
        owner = validated_data.pop('owner', None)
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not owner and viewer:
            owner = viewer
        if not owner:
            raise serializers.ValidationError(
                {'owner': 'Authentication required to create a story.'}
            )
        if validated_data.get('visibility') == 'invite_only' and 'require_approval' not in self.initial_data:
            validated_data['require_approval'] = True
        if validated_data.get('studio_mode') == 'collab' and validated_data.get('visibility') is None:
            validated_data['visibility'] = 'public'
        max_segments = validated_data.get('max_segments') or 12
        validated_data['max_segments'] = max(2, min(int(max_segments), 100))
        if not validated_data.get('outline'):
            validated_data['outline'] = []
        if not validated_data.get('characters'):
            validated_data['characters'] = []
        return Story.objects.create(owner=owner, **validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('owner', None)
        viewer = self._viewer()
        # Non-owners with editor role may only touch bible-ish fields via this serializer
        # when using the dedicated bible action; general PATCH stays owner-only in views.
        if 'max_segments' in validated_data:
            validated_data['max_segments'] = max(2, min(int(validated_data['max_segments']), 100))
        return super().update(instance, validated_data)


class StoryDetailSerializer(StorySerializer):
    segments = serializers.SerializerMethodField()
    collaborators = StoryCollaboratorSerializer(many=True, read_only=True)
    pending_segments = serializers.SerializerMethodField()

    class Meta(StorySerializer.Meta):
        fields = StorySerializer.Meta.fields + [
            'segments', 'collaborators', 'pending_segments',
        ]

    def get_segments(self, obj):
        qs = obj.segments.filter(status='approved').select_related('author')
        ctx = {**self.context, 'include_dialogues': True}
        return SegmentSerializer(qs, many=True, context=ctx).data

    def get_pending_segments(self, obj):
        viewer = self._viewer()
        if obj.can_approve(viewer):
            qs = obj.segments.filter(status='pending').select_related('author')
        elif viewer:
            qs = obj.segments.filter(status='pending', author=viewer).select_related('author')
        else:
            return []
        return SegmentSerializer(qs, many=True, context=self.context).data
