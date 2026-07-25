import json

from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers

from notifications.utils import create_notification
from outverse.auth_utils import user_from_request

from .models import Story, StoryConstellation, StoryQuestionResponse, StoryReaction, StoryReply, StoryView
from users.models import User
from users.privacy import can_tag


class MultipartJSONField(serializers.JSONField):
    """Parses a JSON-encoded string on input (multipart can't send native
    JSON alongside files) but serializes back out as real JSON on output,
    unlike JSONField(binary=True) which re-stringifies on both ends."""

    def to_internal_value(self, data):
        if isinstance(data, (str, bytes)):
            try:
                data = json.loads(data)
            except (TypeError, ValueError):
                self.fail('invalid')
        return super().to_internal_value(data)


def reaction_counts_for(queryset):
    data = queryset.values('type').annotate(c=Count('id'))
    return {row['type']: row['c'] for row in data}


def my_reaction_for(queryset, user):
    if not user:
        return None
    reaction = queryset.filter(user_id=user.id).first()
    return reaction.type if reaction else None


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class StorySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    is_viewed = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    viewer_count = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    unlocks_in = serializers.SerializerMethodField()
    constellation = serializers.SerializerMethodField()
    poll_results = serializers.SerializerMethodField()
    question_response_counts = serializers.SerializerMethodField()
    shared_post = serializers.SerializerMethodField()
    shared_post_id = serializers.IntegerField(write_only=True, required=False)
    # binary=True so a JSON-encoded string sent from multipart/form-data
    # (files + JSON can't mix as native JSON) is parsed back into Python data.
    overlays = MultipartJSONField(required=False)
    drawing = MultipartJSONField(required=False)

    class Meta:
        model = Story
        fields = [
            'id', 'user', 'text', 'image', 'video',
            'created_at', 'expires_at', 'views', 'is_active',
            'filter_style', 'background_style', 'overlays', 'drawing',
            'mood', 'unlock_at', 'is_locked', 'unlocks_in', 'constellation',
            'is_viewed', 'is_saved', 'viewer_count', 'reaction_counts', 'my_reaction',
            'poll_results', 'question_response_counts',
            'audience', 'shared_post', 'shared_post_id',
            'location_name', 'location_lat', 'location_lng',
        ]
        read_only_fields = ['created_at', 'expires_at', 'views', 'is_active']

    def get_is_viewed(self, obj):
        viewed_ids = self.context.get('viewed_ids')
        if viewed_ids is not None:
            return obj.id in viewed_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return obj.viewers.filter(viewer_id=viewer.id).exists()

    def get_is_saved(self, obj):
        saved_ids = self.context.get('saved_ids')
        if saved_ids is not None:
            return obj.id in saved_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return obj.saved_by.filter(user_id=viewer.id).exists()

    def get_viewer_count(self, obj):
        return obj.viewers.count()

    def get_reaction_counts(self, obj):
        return reaction_counts_for(obj.reactions.all())

    def get_my_reaction(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        return my_reaction_for(obj.reactions.all(), viewer)

    def get_is_locked(self, obj):
        return obj.is_locked

    def get_unlocks_in(self, obj):
        if not obj.unlock_at:
            return None
        return max(0, int((obj.unlock_at - timezone.now()).total_seconds()))

    def get_constellation(self, obj):
        if not obj.constellation_id:
            return None
        return {'id': obj.constellation_id, 'title': obj.constellation.title}

    def get_poll_results(self, obj):
        results = {}
        for overlay in (obj.overlays or []):
            if not isinstance(overlay, dict) or overlay.get('type') != 'poll':
                continue
            oid = overlay.get('id')
            if not oid:
                continue
            votes = obj.poll_votes.filter(overlay_id=oid)
            counts_qs = votes.values('option_index').annotate(c=Count('id'))
            counts = {str(row['option_index']): row['c'] for row in counts_qs}
            request = self.context.get('request')
            viewer = user_from_request(request) if request else None
            my_vote = None
            if viewer:
                mine = votes.filter(voter_id=viewer.id).first()
                my_vote = mine.option_index if mine else None
            results[oid] = {'counts': counts, 'total': votes.count(), 'my_vote': my_vote}
        return results

    def get_question_response_counts(self, obj):
        counts = {}
        for overlay in (obj.overlays or []):
            if not isinstance(overlay, dict) or overlay.get('type') != 'question':
                continue
            oid = overlay.get('id')
            if not oid:
                continue
            counts[oid] = obj.question_responses.filter(overlay_id=oid).count()
        return counts

    def get_shared_post(self, obj):
        post = obj.shared_post
        if not post:
            return None
        media = post.media.filter(media_type='image').first()
        request = self.context.get('request')
        image_url = None
        if media and media.media_file:
            image_url = request.build_absolute_uri(media.media_file.url) if request else media.media_file.url
        return {
            'id': post.id,
            'username': post.user.username,
            'text': (post.text or '')[:100],
            'image': image_url,
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Time Capsule: content stays sealed from EVERYONE, including the
        # owner, until unlock_at — that's the point of the surprise mechanic.
        if instance.is_locked:
            data['image'] = None
            data['video'] = None
            data['text'] = ''
            data['overlays'] = []
            data['drawing'] = []
            data['filter_style'] = 'none'
            data['background_style'] = ''
            data['poll_results'] = {}
            data['question_response_counts'] = {}
        return data

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        # DRF's BooleanField injects False for a field absent from multipart data
        # (rather than leaving it unset), even when writable only for staff —
        # new stories always start active regardless of who's posting.
        validated_data['is_active'] = True
        shared_post_id = validated_data.pop('shared_post_id', None)
        if shared_post_id:
            validated_data['shared_post_id'] = shared_post_id
        story = Story.objects.create(user=user, **validated_data)
        for overlay in (story.overlays or []):
            if isinstance(overlay, dict) and overlay.get('type') == 'mention' and overlay.get('userId'):
                tagged = User.objects.filter(id=overlay['userId']).first()
                if not tagged or not can_tag(user, tagged):
                    continue
                create_notification(
                    recipient_id=tagged.id,
                    actor_id=user.id,
                    verb='mention',
                    story=story,
                    text='mentioned you in their story',
                )
        return story

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if viewer and viewer.is_staff:
            self.fields['is_active'].read_only = False


class StoryConstellationSerializer(serializers.ModelSerializer):
    stories_count = serializers.SerializerMethodField()
    cover = serializers.SerializerMethodField()

    class Meta:
        model = StoryConstellation
        fields = ['id', 'title', 'created_at', 'stories_count', 'cover']

    def get_stories_count(self, obj):
        return obj.stories.count()

    def get_cover(self, obj):
        latest = obj.stories.order_by('-created_at').first()
        if not latest:
            return None
        url = latest.image.url if latest.image else (latest.video.url if latest.video else None)
        if not url:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url


class StoryViewerSerializer(serializers.ModelSerializer):
    viewer = UserSerializer(read_only=True)

    class Meta:
        model = StoryView
        fields = ['viewer', 'created_at']


class StoryQuestionResponseSerializer(serializers.ModelSerializer):
    responder = UserSerializer(read_only=True)

    class Meta:
        model = StoryQuestionResponse
        fields = ['id', 'overlay_id', 'text', 'responder', 'created_at']


class StoryReplySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = StoryReply
        fields = ['id', 'text', 'user', 'created_at']
        read_only_fields = ['created_at', 'user']
