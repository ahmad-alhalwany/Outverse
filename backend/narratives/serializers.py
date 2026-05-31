from rest_framework import serializers

from outverse.auth_utils import user_from_request
from users.models import User

from .models import Segment, Story


class NarrativeUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class SegmentSerializer(serializers.ModelSerializer):
    author = NarrativeUserSerializer(read_only=True)

    class Meta:
        model = Segment
        fields = ['id', 'author', 'content', 'order', 'votes', 'created_at']


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
    contributors_count = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = [
            'id', 'title', 'premise', 'cover_url', 'genre', 'genre_display',
            'status', 'max_segments', 'is_featured', 'owner', 'owner_id',
            'segment_count', 'contributors_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['status', 'created_at', 'updated_at']

    def get_segment_count(self, obj):
        return obj.segments.count()

    def get_contributors_count(self, obj):
        return (
            obj.segments.exclude(author__isnull=True)
            .values('author')
            .distinct()
            .count()
        )

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
        return Story.objects.create(owner=owner, **validated_data)


class StoryDetailSerializer(StorySerializer):
    segments = SegmentSerializer(many=True, read_only=True)

    class Meta(StorySerializer.Meta):
        fields = StorySerializer.Meta.fields + ['segments']
