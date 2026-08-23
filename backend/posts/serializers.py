from django.db.models import Count
from django.utils import timezone
from rest_framework import serializers

from outverse.auth_utils import user_from_request

from .models import (
    Comment, CommentReaction, CommentVote, OrbitList, OrbitListFollower, OrbitListMember,
    PollOption, PollVote, Post, PostDraft, PostEditHistory, PostMedia, PostVote,
    QuestionAnswer, Reaction, SavedCollection, ScheduledMedia, ScheduledPost,
)
from users.models import User


def reaction_counts_for(queryset):
    data = queryset.values('type').annotate(c=Count('id'))
    return {row['type']: row['c'] for row in data}


def reaction_counts_for_post(post):
    return reaction_counts_for(post.reactions.all())


def reaction_counts_for_comment(comment):
    return reaction_counts_for(comment.reactions.all())


def my_reaction_for(queryset, user):
    if not user:
        return None
    reaction = queryset.filter(user_id=user.id).first()
    return reaction.type if reaction else None


def vote_stats_for_comment(comment, user=None):
    """Aggregate boost/dim counts; uses prefetched votes when available."""
    cache = getattr(comment, '_prefetched_objects_cache', {})
    votes = cache.get('votes')
    if votes is not None:
        boost = sum(1 for v in votes if v.value == CommentVote.BOOST)
        dim = sum(1 for v in votes if v.value == CommentVote.DIM)
        my_vote = None
        if user:
            for v in votes:
                if v.user_id == user.id:
                    my_vote = 'boost' if v.value == CommentVote.BOOST else 'dim'
                    break
        return {
            'vote_score': boost - dim,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        }
    if hasattr(comment, 'vote_score'):
        boost = getattr(comment, 'boost_count', None)
        dim = getattr(comment, 'dim_count', None)
        if boost is None or dim is None:
            boost = comment.votes.filter(value=CommentVote.BOOST).count()
            dim = comment.votes.filter(value=CommentVote.DIM).count()
        my_vote = None
        if user:
            existing = comment.votes.filter(user_id=user.id).first()
            if existing:
                my_vote = 'boost' if existing.value == CommentVote.BOOST else 'dim'
        return {
            'vote_score': comment.vote_score,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        }
    boost = comment.votes.filter(value=CommentVote.BOOST).count()
    dim = comment.votes.filter(value=CommentVote.DIM).count()
    my_vote = None
    if user:
        existing = comment.votes.filter(user_id=user.id).first()
        if existing:
            my_vote = 'boost' if existing.value == CommentVote.BOOST else 'dim'
    return {
        'vote_score': boost - dim,
        'boost_count': boost,
        'dim_count': dim,
        'my_vote': my_vote,
    }


def vote_stats_for_post(post, user=None):
    """Aggregate boost/dim counts; uses prefetched votes when available."""
    cache = getattr(post, '_prefetched_objects_cache', {})
    votes = cache.get('votes')
    if votes is not None:
        boost = sum(1 for v in votes if v.value == PostVote.BOOST)
        dim = sum(1 for v in votes if v.value == PostVote.DIM)
        my_vote = None
        if user:
            for v in votes:
                if v.user_id == user.id:
                    my_vote = 'boost' if v.value == PostVote.BOOST else 'dim'
                    break
        return {
            'vote_score': boost - dim,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        }
    if hasattr(post, 'vote_score'):
        boost = getattr(post, 'boost_count', None)
        dim = getattr(post, 'dim_count', None)
        if boost is None or dim is None:
            boost = post.votes.filter(value=PostVote.BOOST).count()
            dim = post.votes.filter(value=PostVote.DIM).count()
        my_vote = None
        if user:
            existing = post.votes.filter(user_id=user.id).first()
            if existing:
                my_vote = 'boost' if existing.value == PostVote.BOOST else 'dim'
        return {
            'vote_score': post.vote_score,
            'boost_count': boost,
            'dim_count': dim,
            'my_vote': my_vote,
        }
    boost = post.votes.filter(value=PostVote.BOOST).count()
    dim = post.votes.filter(value=PostVote.DIM).count()
    my_vote = None
    if user:
        existing = post.votes.filter(user_id=user.id).first()
        if existing:
            my_vote = 'boost' if existing.value == PostVote.BOOST else 'dim'
    return {
        'vote_score': boost - dim,
        'boost_count': boost,
        'dim_count': dim,
        'my_vote': my_vote,
    }


class UserSerializer(serializers.ModelSerializer):
    is_following = serializers.SerializerMethodField()
    karma = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'avatar',
            'badge_verified', 'is_following', 'karma', 'display_name',
        ]

    def get_display_name(self, obj):
        from users.privacy import public_display_name
        return public_display_name(obj)

    def to_representation(self, instance):
        from users.privacy import looks_like_email, public_username
        data = super().to_representation(instance)
        # Never expose an email-shaped username in nested public user payloads.
        if looks_like_email(data.get('username')):
            data['username'] = public_username(instance)
        return data

    def get_karma(self, obj):
        profile = getattr(obj, 'profile', None)
        if profile is not None:
            return getattr(profile, 'karma', 0) or 0
        try:
            from users.models import Profile
            return Profile.objects.filter(user_id=obj.id).values_list('karma', flat=True).first() or 0
        except Exception:
            return 0

    def get_is_following(self, obj):
        following_ids = self.context.get('following_ids')
        if following_ids is not None:
            return obj.id in following_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer or viewer.id == obj.id:
            return False
        from users.models import Follow
        return Follow.objects.filter(follower_id=viewer.id, following_id=obj.id).exists()


class PostMediaSerializer(serializers.ModelSerializer):
    media_file = serializers.SerializerMethodField()

    class Meta:
        model = PostMedia
        fields = ['id', 'media_file', 'media_type', 'alt_text', 'order']

    def get_media_file(self, obj):
        if not obj.media_file:
            return ''
        request = self.context.get('request')
        path = obj.media_file.url
        if request:
            return request.build_absolute_uri(path)
        return path


class PollOptionSerializer(serializers.ModelSerializer):
    vote_count = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'order', 'vote_count']

    def get_vote_count(self, obj):
        return obj.votes.count()


class EmbeddedPostSerializer(serializers.ModelSerializer):
    """Shallow serialization of an original post embedded inside a repost/quote.

    Deliberately does NOT expand ``repost_of`` or thread fields to avoid
    infinite recursion; carries just enough to render the quoted card.
    """

    user = UserSerializer(read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    poll_options = PollOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'user', 'post_type', 'text', 'mood', 'tags', 'media',
            'created_at', 'views', 'comments_count', 'likes_count',
            'shares_count', 'reposts_count', 'poll_options',
            'location_name', 'location_lat', 'location_lng',
        ]
        read_only_fields = [
            'id', 'user', 'post_type', 'text', 'mood', 'tags', 'media',
            'created_at', 'views', 'comments_count', 'likes_count',
            'shares_count', 'reposts_count', 'poll_options',
        ]


class PostSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    media = PostMediaSerializer(many=True, read_only=True)
    reaction_counts = serializers.SerializerMethodField()
    my_reaction = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    post_type = serializers.CharField(read_only=True)
    poll_options = PollOptionSerializer(many=True, read_only=True)
    poll_results = serializers.SerializerMethodField()
    my_poll_vote = serializers.SerializerMethodField()
    question_answers_count = serializers.SerializerMethodField()
    my_question_answered = serializers.SerializerMethodField()
    repost_of = EmbeddedPostSerializer(read_only=True)
    crosspost_of = EmbeddedPostSerializer(read_only=True)
    my_repost = serializers.SerializerMethodField()
    thread_root_id = serializers.IntegerField(read_only=True)
    thread_count = serializers.SerializerMethodField()
    vote_score = serializers.SerializerMethodField()
    boost_count = serializers.SerializerMethodField()
    dim_count = serializers.SerializerMethodField()
    my_vote = serializers.SerializerMethodField()
    community = serializers.SerializerMethodField()
    is_boost_active = serializers.SerializerMethodField()
    shared_reel = serializers.SerializerMethodField()
    top_reactors = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'user', 'post_type', 'text', 'mood', 'tags', 'media',
            'created_at', 'views', 'comments_count', 'likes_count',
            'shares_count', 'reposts_count', 'reaction_counts', 'my_reaction',
            'is_saved', 'poll_options', 'poll_results', 'my_poll_vote',
            'question_answers_count', 'my_question_answered',
            'repost_of', 'my_repost', 'thread_root_id', 'thread_seq',
            'thread_count', 'visibility', 'reply_control', 'required_tier', 'edited_at',
            'vote_score', 'boost_count', 'dim_count', 'my_vote', 'community', 'flair',
            'is_boosted', 'boost_expires_at', 'is_boost_active', 'shared_reel',
            'top_reactors', 'is_profile_pinned', 'profile_pinned_at',
            'is_community_pinned', 'community_pinned_at', 'is_spoiler', 'crosspost_of',
            'location_name', 'location_lat', 'location_lng',
        ]
        read_only_fields = [
            'created_at', 'views', 'comments_count', 'likes_count', 'shares_count',
            'reposts_count', 'post_type', 'poll_options', 'poll_results',
            'my_poll_vote', 'question_answers_count', 'my_question_answered',
            'repost_of', 'my_repost', 'thread_root_id', 'thread_seq',
            'thread_count', 'edited_at',
            'vote_score', 'boost_count', 'dim_count', 'my_vote', 'community',
            'is_boosted', 'boost_expires_at', 'is_boost_active', 'shared_reel',
            'top_reactors', 'is_profile_pinned', 'profile_pinned_at',
            'is_community_pinned', 'community_pinned_at', 'crosspost_of',
        ]

    def validate_required_tier(self, value):
        if value is None:
            return value
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or value.creator_id != user.id:
            raise serializers.ValidationError('required_tier must be one of your own creator tiers.')
        return value

    def get_community(self, obj):
        if not obj.community_id:
            return None
        return {
            'id': obj.community_id,
            'slug': obj.community.slug,
            'name': obj.community.name,
            'is_nsfw': obj.community.is_nsfw,
        }

    def get_is_boost_active(self, obj):
        return obj.is_boost_active

    def get_shared_reel(self, obj):
        reel = obj.shared_reel
        if not reel:
            return None
        request = self.context.get('request')
        video_url = None
        if reel.video:
            video_url = request.build_absolute_uri(reel.video.url) if request else reel.video.url
        return {
            'id': reel.id,
            'caption': (reel.caption or '')[:120],
            'username': reel.user.username if reel.user else '',
            'video_url': video_url,
        }

    def get_top_reactors(self, obj):
        """Up to 2 recent reactors for Facebook-style social-proof lines."""
        viewer = self._viewer()
        cache = getattr(obj, '_prefetched_objects_cache', {})
        reactions = cache.get('reactions')
        if reactions is not None:
            rows = list(reactions)
        else:
            rows = list(
                obj.reactions.select_related('user').order_by('-created_at')[:8]
            )
        out = []
        for r in rows:
            u = r.user
            if viewer and u.id == viewer.id:
                continue
            from users.privacy import public_display_name, public_username
            out.append({
                'id': u.id,
                'name': public_display_name(u),
                'username': public_username(u),
                'type': r.type,
            })
            if len(out) >= 2:
                break
        return out

    def _viewer(self):
        request = self.context.get('request')
        return user_from_request(request) if request else None

    def _vote_stats(self, obj):
        cache_key = '_cached_vote_stats'
        if not hasattr(obj, cache_key):
            setattr(obj, cache_key, vote_stats_for_post(obj, self._viewer()))
        return getattr(obj, cache_key)

    def get_vote_score(self, obj):
        return self._vote_stats(obj)['vote_score']

    def get_boost_count(self, obj):
        return self._vote_stats(obj)['boost_count']

    def get_dim_count(self, obj):
        return self._vote_stats(obj)['dim_count']

    def get_my_vote(self, obj):
        return self._vote_stats(obj)['my_vote']

    def get_my_repost(self, obj):
        """Return a truthy marker if the viewer has a pure echo of this post."""
        reposted_ids = self.context.get('reposted_original_ids')
        if reposted_ids is not None:
            return obj.id if obj.id in reposted_ids else None
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return None
        echo = (
            Post.objects.filter(repost_of_id=obj.id, user_id=viewer.id, text='')
            .values_list('id', flat=True)
            .first()
        )
        return echo

    def get_thread_count(self, obj):
        """Total posts in this post's thread chain (0 if not a thread)."""
        annotated = getattr(obj, 'thread_member_count', None)
        if annotated is not None:
            return annotated + 1 if annotated else 0
        root_id = obj.thread_root_id or obj.id
        members = Post.objects.filter(thread_root_id=root_id).count()
        return members + 1 if members else 0

    def get_reaction_counts(self, obj):
        return reaction_counts_for_post(obj)

    def get_my_reaction(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        return my_reaction_for(obj.reactions.all(), viewer)

    def get_is_saved(self, obj):
        saved_ids = self.context.get('saved_ids')
        if saved_ids is not None:
            return obj.id in saved_ids
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return obj.saves.filter(user_id=viewer.id).exists()

    def get_poll_results(self, obj):
        if obj.post_type != 'poll':
            return {}
        counts = obj.poll_options.annotate(c=Count('votes')).values('id', 'c')
        return {str(item['id']): item['c'] for item in counts}

    def get_my_poll_vote(self, obj):
        if obj.post_type != 'poll':
            return None
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return None
        vote = obj.poll_votes.filter(user_id=viewer.id).select_related('option').first()
        return vote.option_id if vote else None

    def get_question_answers_count(self, obj):
        if obj.post_type != 'question':
            return 0
        return obj.question_answers.count()

    def get_my_question_answered(self, obj):
        if obj.post_type != 'question':
            return False
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        return obj.question_answers.filter(user_id=viewer.id).exists()


class PollVoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollVote
        fields = ['id', 'post', 'option', 'created_at']
        read_only_fields = ['id', 'created_at']


class QuestionAnswerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = QuestionAnswer
        fields = ['id', 'post', 'user', 'text', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class PostDraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostDraft
        fields = ['id', 'text', 'mood', 'tags', 'updated_at', 'created_at']
        read_only_fields = ['id', 'updated_at', 'created_at']

    def validate_text(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Draft text cannot be empty.')
        return value


class ScheduledMediaSerializer(serializers.ModelSerializer):
    media_file = serializers.SerializerMethodField()

    class Meta:
        model = ScheduledMedia
        fields = ['id', 'media_file', 'media_type', 'order', 'created_at']
        read_only_fields = fields

    def get_media_file(self, obj):
        if not obj.media_file:
            return ''
        request = self.context.get('request')
        path = obj.media_file.url
        if request:
            return request.build_absolute_uri(path)
        return path


class ScheduledPostSerializer(serializers.ModelSerializer):
    media = ScheduledMediaSerializer(source='media_files', many=True, read_only=True)

    class Meta:
        model = ScheduledPost
        fields = [
            'id', 'payload', 'publish_at', 'status', 'published_post_id',
            'error', 'created_at', 'media',
        ]
        read_only_fields = ['id', 'status', 'published_post_id', 'error', 'created_at']

    def validate_publish_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError('publish_at must be in the future.')
        return value

    def validate_payload(self, value):
        if not isinstance(value, dict) or not (value.get('text') or '').strip():
            raise serializers.ValidationError('payload.text is required.')
        required_tier_id = value.get('required_tier_id')
        if required_tier_id:
            from subscriptions.models import CreatorTier

            request = self.context.get('request')
            user = getattr(request, 'user', None) if request else None
            owns_tier = user and CreatorTier.objects.filter(pk=required_tier_id, creator_id=user.id).exists()
            if not owns_tier:
                raise serializers.ValidationError('required_tier_id must be one of your own creator tiers.')
        return value


class PostEditHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PostEditHistory
        fields = ['id', 'previous_text', 'edited_at']
        read_only_fields = fields


class SavedCollectionSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = SavedCollection
        fields = [
            'id', 'name', 'description', 'is_public', 'cover_url',
            'item_count', 'created_at',
        ]
        read_only_fields = ['id', 'item_count', 'created_at']

    def get_item_count(self, obj):
        return obj.items.count()

    def validate_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Collection name cannot be empty.')
        return value


class OrbitListMemberSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)

    class Meta:
        model = OrbitListMember
        fields = ['id', 'username', 'first_name', 'last_name', 'added_at']
        read_only_fields = fields


class OrbitListSerializer(serializers.ModelSerializer):
    member_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    owner = UserSerializer(read_only=True)
    members = OrbitListMemberSerializer(many=True, read_only=True)

    class Meta:
        model = OrbitList
        fields = [
            'id', 'owner', 'title', 'description', 'is_private',
            'member_count', 'is_following', 'members', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'owner', 'member_count', 'is_following', 'members',
            'created_at', 'updated_at',
        ]

    def get_member_count(self, obj):
        cache = getattr(obj, '_prefetched_objects_cache', {})
        if 'members' in cache:
            return len(cache['members'])
        return obj.members.count()

    def get_is_following(self, obj):
        viewer = self.context.get('viewer')
        if not viewer:
            request = self.context.get('request')
            viewer = user_from_request(request) if request else None
        if not viewer:
            return False
        if obj.owner_id == viewer.id:
            return True
        return OrbitListFollower.objects.filter(orbit_list=obj, user=viewer).exists()

    def validate_title(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Title is required.')
        return value[:80]


class CommentSerializer(serializers.ModelSerializer):
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
        post_id = self.initial_data.get('post')
        self._quoted_comment = None
        if quoted_id and post_id:
            try:
                quoted = Comment.objects.get(id=quoted_id, post_id=post_id)
            except Comment.DoesNotExist:
                raise serializers.ValidationError(
                    {'quoted_comment': 'Quoted comment not found on this post.'}
                )
            self._quoted_comment = quoted
        return attrs

    def create(self, validated_data):
        quoted = getattr(self, '_quoted_comment', None)
        if quoted is not None:
            validated_data['quoted_comment'] = quoted
        return super().create(validated_data)

    class Meta:
        model = Comment
        fields = [
            'id', 'post', 'parent', 'user', 'text', 'gif_url', 'sticker_url',
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

    def _vote_stats(self, obj):
        cache_key = '_cached_vote_stats'
        if not hasattr(obj, cache_key):
            setattr(obj, cache_key, vote_stats_for_comment(obj, self._viewer()))
        return getattr(obj, cache_key)

    def get_is_post_author(self, obj):
        return obj.user_id == obj.post.user_id

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

    def get_reaction_counts(self, obj):
        return reaction_counts_for_comment(obj)

    def get_my_reaction(self, obj):
        request = self.context.get('request')
        viewer = user_from_request(request) if request else None
        return my_reaction_for(obj.reactions.all(), viewer)

    def get_replies(self, obj):
        # Recurse to any depth (Reddit-style nesting). The parent tree can
        # never contain cycles, so recursion always terminates.
        children = obj.replies.select_related('user').prefetch_related(
            'reactions', 'votes',
        ).order_by('created_at')
        if not children:
            return []
        return CommentSerializer(children, many=True, context=self.context).data
