from django.db.models import Count
from rest_framework import serializers

from ideas.models import Idea
from outverse.auth_utils import user_from_request
from questions.models import Question

from users.models import User

from .models import (
    Reel,
    ReelComment,
    ReelCommentVote,
    ReelDim,
    ReelDraft,
    ReelLike,
    ReelMusicTrack,
    ReelTemplate,
    SavedReel,
)


class MultipartJSONField(serializers.JSONField):
    """Accept JSON objects or JSON strings from multipart forms."""

    def to_internal_value(self, data):
        if isinstance(data, str):
            import json
            try:
                data = json.loads(data) if data.strip() else self.default if callable(self.default) else (self.default or {})
            except json.JSONDecodeError as exc:
                raise serializers.ValidationError('Invalid JSON.') from exc
        return super().to_internal_value(data)


class ReelTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReelTemplate
        fields = [
            'id', 'slug', 'title', 'description', 'mood', 'filter_style',
            'overlay_stickers', 'overlay_text', 'default_sound_label',
            'music_track', 'backdrop_preset', 'order',
        ]


def reaction_counts_for(queryset):
    data = queryset.values('type').annotate(c=Count('id'))
    return {row['type']: row['c'] for row in data}


def reaction_counts_for_reel(reel):
    return reaction_counts_for(reel.likes.all())


def reaction_counts_for_comment(comment):
    return reaction_counts_for(comment.reactions.all())


def my_reaction_for(queryset, user):
    if not user:
        return None
    reaction = queryset.filter(user_id=user.id).first()
    return reaction.type if reaction else None


def vote_stats_for_comment(comment, user=None):
    cache = getattr(comment, '_prefetched_objects_cache', {})
    votes = cache.get('votes')
    if votes is not None:
        boost = sum(1 for v in votes if v.value == ReelCommentVote.BOOST)
        dim = sum(1 for v in votes if v.value == ReelCommentVote.DIM)
        my_vote = None
        if user:
            for v in votes:
                if v.user_id == user.id:
                    my_vote = 'boost' if v.value == ReelCommentVote.BOOST else 'dim'
                    break
        return {
            'vote_score': boost - dim,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        }
    if hasattr(comment, 'vote_score'):
        boost = comment.votes.filter(value=ReelCommentVote.BOOST).count()
        dim = comment.votes.filter(value=ReelCommentVote.DIM).count()
        my_vote = None
        if user:
            existing = comment.votes.filter(user_id=user.id).first()
            if existing:
                my_vote = 'boost' if existing.value == ReelCommentVote.BOOST else 'dim'
        return {
            'vote_score': comment.vote_score,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        }
    boost = comment.votes.filter(value=ReelCommentVote.BOOST).count()
    dim = comment.votes.filter(value=ReelCommentVote.DIM).count()
    my_vote = None
    if user:
        existing = comment.votes.filter(user_id=user.id).first()
        if existing:
            my_vote = 'boost' if existing.value == ReelCommentVote.BOOST else 'dim'
    return {
        'vote_score': boost - dim,
        'boost_count': boost,
        'dim_count': dim,
        'my_vote': my_vote,
    }


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


def absolute_media(request, field):
    if not field:
        return ''
    path = field.url
    if request:
        return request.build_absolute_uri(path)
    return path


class ReelMusicTrackSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = ReelMusicTrack
        fields = [
            'id', 'slug', 'title', 'artist_label', 'mood',
            'audio_url', 'order',
        ]

    def get_audio_url(self, obj):
        request = self.context.get('request')
        if obj.audio_file:
            return absolute_media(request, obj.audio_file)
        if obj.source_path and request:
            return request.build_absolute_uri(obj.source_path)
        return obj.source_path or ''


class ReelCommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    replies = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    quoted_comment = serializers.SerializerMethodField()
    is_post_author = serializers.SerializerMethodField()
    resonance_total = serializers.SerializerMethodField()
    vote_score = serializers.SerializerMethodField()
    boost_count = serializers.SerializerMethodField()
    dim_count = serializers.SerializerMethodField()
    my_vote = serializers.SerializerMethodField()
    is_pinned = serializers.SerializerMethodField()

    def validate(self, attrs):
        text = (attrs.get('text') or '').strip()
        gif = (attrs.get('gif_url') or '').strip()
        sticker = (attrs.get('sticker_url') or '').strip()
        if not text and not gif and not sticker:
            raise serializers.ValidationError(
                'Provide text, gif_url, or sticker_url.'
            )
        attrs['text'] = text
        quoted_id = self.initial_data.get('quoted_comment')
        reel_id = self.initial_data.get('reel')
        self._quoted_comment = None
        if quoted_id and reel_id:
            try:
                quoted = ReelComment.objects.get(id=quoted_id, reel_id=reel_id)
            except ReelComment.DoesNotExist:
                raise serializers.ValidationError(
                    {'quoted_comment': 'Quoted comment not found on this reel.'}
                )
            self._quoted_comment = quoted
        return attrs

    class Meta:
        model = ReelComment
        fields = [
            'id', 'reel', 'parent', 'user', 'text', 'gif_url', 'sticker_url',
            'created_at', 'edited_at', 'quoted_comment', 'pin_order', 'is_pinned',
            'sparked_by_author', 'is_post_author', 'resonance_total',
            'vote_score', 'boost_count', 'dim_count', 'my_vote',
            'replies', 'reaction_counts', 'my_reaction',
        ]
        read_only_fields = [
            'created_at', 'edited_at', 'user', 'pin_order', 'is_pinned',
            'sparked_by_author', 'is_post_author', 'resonance_total',
            'vote_score', 'boost_count', 'dim_count', 'my_vote',
        ]

    def _viewer(self):
        request = self.context.get('request')
        return user_from_request(request) if request else None

    def _vote_stats(self, obj):
        cache_key = '_cached_vote_stats'
        if not hasattr(obj, cache_key):
            setattr(obj, cache_key, vote_stats_for_comment(obj, self._viewer()))
        return getattr(obj, cache_key)

    def get_is_pinned(self, obj):
        return obj.pin_order is not None

    def get_vote_score(self, obj):
        return self._vote_stats(obj)['vote_score']

    def get_boost_count(self, obj):
        return self._vote_stats(obj)['boost_count']

    def get_dim_count(self, obj):
        return self._vote_stats(obj)['dim_count']

    def get_my_vote(self, obj):
        return self._vote_stats(obj)['my_vote']

    def get_is_post_author(self, obj):
        return obj.user_id == obj.reel.user_id

    def get_resonance_total(self, obj):
        return sum(reaction_counts_for_comment(obj).values())

    def get_quoted_comment(self, obj):
        if not obj.quoted_comment_id:
            return None
        q = obj.quoted_comment
        if not q:
            return None
        return {
            'id': q.id,
            'text': (q.text or '')[:240],
            'user': UserSerializer(q.user).data,
        }

    def get_replies(self, obj):
        children = obj.replies.select_related('user').prefetch_related(
            'reactions', 'votes',
        ).order_by('created_at')
        if not children:
            return []
        return ReelCommentSerializer(children, many=True, context=self.context).data

    def get_reaction_counts(self, obj):
        return reaction_counts_for_comment(obj)

    def get_my_reaction(self, obj):
        return my_reaction_for(obj.reactions.all(), self._viewer())

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        quoted = getattr(self, '_quoted_comment', None)
        if quoted is not None:
            validated_data['quoted_comment'] = quoted
        return ReelComment.objects.create(user=user, **validated_data)


class ReelSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    video = serializers.SerializerMethodField()
    custom_audio_url = serializers.SerializerMethodField()
    music_track = serializers.PrimaryKeyRelatedField(
        queryset=ReelMusicTrack.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    music_track_detail = ReelMusicTrackSerializer(
        source='music_track', read_only=True
    )
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    inspiration_question = serializers.PrimaryKeyRelatedField(
        queryset=Question.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    source_idea = serializers.PrimaryKeyRelatedField(
        queryset=Idea.objects.all(),
        required=False,
        allow_null=True,
    )
    inspiration_attribution = serializers.SerializerMethodField()
    is_dimmed = serializers.SerializerMethodField()
    template = serializers.PrimaryKeyRelatedField(
        queryset=ReelTemplate.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )
    template_detail = ReelTemplateSerializer(source='template', read_only=True)
    captions = MultipartJSONField(required=False)
    effect_meta = MultipartJSONField(required=False)

    class Meta:
        model = Reel
        fields = [
            'id', 'user', 'video', 'caption', 'mood', 'filter_style', 'tags',
            'sound_label', 'music_track', 'music_track_detail', 'custom_audio_url',
            'music_start_seconds', 'music_end_seconds',
            'duration_seconds', 'views', 'likes_count', 'comments_count',
            'shares_count', 'is_liked', 'is_saved', 'is_dimmed', 'reaction_counts', 'my_reaction',
            'is_featured', 'created_at', 'is_active', 'visibility', 'required_tier',
            'remix_of', 'stitch_of', 'inspiration_question', 'source_idea', 'inspiration_attribution',
            'allow_remix', 'allow_weave', 'allow_download',
            'template', 'template_detail', 'captions', 'captions_status', 'captions_language',
            'effect_meta',
        ]
        read_only_fields = [
            'created_at', 'views', 'likes_count', 'comments_count',
            'shares_count', 'is_active', 'is_featured', 'captions_status',
        ]

    def validate_required_tier(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or value.creator_id != user.id:
            raise serializers.ValidationError('required_tier must be one of your own creator tiers.')
        return value

    def get_video(self, obj):
        return absolute_media(self.context.get('request'), obj.video)

    def get_custom_audio_url(self, obj):
        return absolute_media(self.context.get('request'), obj.custom_audio)

    def get_is_liked(self, obj):
        liked_ids = self.context.get('liked_ids')
        if liked_ids is not None:
            return obj.id in liked_ids
        return self.get_my_reaction(obj) is not None

    def get_reaction_counts(self, obj):
        return reaction_counts_for_reel(obj)

    def get_my_reaction(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return None
        like = obj.likes.filter(user_id=viewer.id).first()
        return like.type if like else None

    def get_inspiration_attribution(self, obj):
        if obj.inspiration_question_id:
            q = obj.inspiration_question
            return {
                'type': 'question',
                'id': q.id,
                'label': (q.text or '')[:120],
            }
        if obj.source_idea_id:
            idea = obj.source_idea
            return {
                'type': 'idea',
                'id': idea.id,
                'label': idea.title,
            }
        return None

    def get_is_saved(self, obj):
        saved_ids = self.context.get('saved_ids')
        if saved_ids is not None:
            return obj.id in saved_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return SavedReel.objects.filter(user_id=viewer.id, reel_id=obj.id).exists()

    def get_is_dimmed(self, obj):
        dimmed_ids = self.context.get('dimmed_ids')
        if dimmed_ids is not None:
            return obj.id in dimmed_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return ReelDim.objects.filter(user_id=viewer.id, reel_id=obj.id).exists()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if viewer and viewer.is_staff:
            self.fields['is_featured'].read_only = False
            self.fields['is_active'].read_only = False

    def validate(self, attrs):
        start = attrs.get('music_start_seconds', 0) or 0
        end = attrs.get('music_end_seconds')
        if start < 0:
            raise serializers.ValidationError(
                {'music_start_seconds': 'Must be zero or positive.'}
            )
        if end is not None and end <= start:
            raise serializers.ValidationError(
                {'music_end_seconds': 'End must be after start.'}
            )

        remix_of = attrs.get('remix_of')
        stitch_of = attrs.get('stitch_of')
        if remix_of is not None and stitch_of is not None:
            raise serializers.ValidationError(
                'A signal can be either a Remix or a Weave, not both.'
            )
        if remix_of is not None and not remix_of.allow_remix:
            raise serializers.ValidationError(
                {'remix_of': 'This creator disabled Remix on that signal.'}
            )
        if stitch_of is not None and not stitch_of.allow_weave:
            raise serializers.ValidationError(
                {'stitch_of': 'This creator disabled Weave on that signal.'}
            )
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = user_from_request(request) if request else None
        if not user:
            raise serializers.ValidationError('Authentication required.')
        # Apply creator Pulse defaults when flags omitted
        if (
            'allow_remix' not in validated_data
            or 'allow_weave' not in validated_data
            or 'allow_download' not in validated_data
        ):
            try:
                prefs = user.preferences
            except Exception:
                prefs = None
            if prefs:
                validated_data.setdefault('allow_remix', prefs.default_allow_remix)
                validated_data.setdefault('allow_weave', prefs.default_allow_weave)
                validated_data.setdefault('allow_download', prefs.default_allow_download)
        template = validated_data.get('template')
        if template:
            validated_data.setdefault('mood', template.mood or 'cosmic')
            validated_data.setdefault('filter_style', template.filter_style or 'none')
            if template.music_track_id and not validated_data.get('music_track'):
                validated_data['music_track'] = template.music_track
            if template.default_sound_label and not validated_data.get('sound_label'):
                validated_data['sound_label'] = template.default_sound_label
            meta = dict(validated_data.get('effect_meta') or {})
            if template.backdrop_preset and not meta.get('backdrop'):
                meta['backdrop'] = template.backdrop_preset
            if template.overlay_stickers and not meta.get('overlays'):
                meta['overlays'] = template.overlay_stickers
            if template.overlay_text and not meta.get('overlay_text'):
                meta['overlay_text'] = template.overlay_text
            validated_data['effect_meta'] = meta
        reel = Reel.objects.create(user=user, **validated_data)
        # Kick captions generation (sync, fast fallback; Whisper if keyed)
        try:
            from .captions import generate_captions_for_reel
            if reel.caption or reel.video:
                generate_captions_for_reel(reel)
        except Exception:
            pass
        return reel


class ReelDraftSerializer(serializers.ModelSerializer):
    music_track = serializers.PrimaryKeyRelatedField(
        queryset=ReelMusicTrack.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ReelDraft
        fields = [
            'id', 'caption', 'mood', 'filter_style', 'tags',
            'music_track', 'sound_label', 'music_start_seconds', 'music_end_seconds',
            'updated_at', 'created_at',
        ]
        read_only_fields = ['id', 'updated_at', 'created_at']
