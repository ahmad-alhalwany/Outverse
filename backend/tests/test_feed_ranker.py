import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from analytics.feed_ranker import (
    get_author_affinity,
    get_collaborative_author_boost,
    get_learned_feature_weights,
    get_tag_affinity,
    get_user_interest_vector,
    invalidate_author_affinity,
    persist_feed_weights_snapshot,
    rebuild_user_interest_vector,
    score_post,
)
from analytics.models import ContentEngagementEvent, FeedRankingSnapshot, UserInterestVector
from analytics.trending import compute_trending_tags
from posts.models import Post

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def viewer(django_user_model):
    return django_user_model.objects.create_user(
        username='viewer',
        email='viewer@example.com',
        password='pass1234',
        interests=['art'],
    )


@pytest.fixture
def creator_a(django_user_model):
    return django_user_model.objects.create_user(
        username='creator_a',
        email='a@example.com',
        password='pass1234',
    )


@pytest.fixture
def creator_b(django_user_model):
    return django_user_model.objects.create_user(
        username='creator_b',
        email='b@example.com',
        password='pass1234',
    )


@pytest.mark.django_db
def test_engagement_events_ingest(api_client, viewer, creator_a):
    post = Post.objects.create(user=creator_a, text='Signal post')
    api_client.force_authenticate(user=viewer)
    res = api_client.post('/api/analytics/events/', {
        'events': [{
            'content_type': 'post',
            'content_id': post.id,
            'author_id': creator_a.id,
            'event_type': 'dwell_10s',
        }],
    }, format='json')
    assert res.status_code == 200, res.content
    assert res.data['accepted'] == 1
    assert ContentEngagementEvent.objects.filter(user=viewer, event_type='dwell_10s').exists()


@pytest.mark.django_db
def test_author_affinity_from_events(viewer, creator_a):
    ContentEngagementEvent.objects.create(
        user=viewer,
        content_type='post',
        content_id=1,
        author_id=creator_a.id,
        event_type='like',
    )
    invalidate_author_affinity(viewer.id)
    affinity = get_author_affinity(viewer.id)
    assert affinity[creator_a.id] > 0


@pytest.mark.django_db
def test_for_you_feed_boosts_engaged_creator(api_client, viewer, creator_a, creator_b):
    low = Post.objects.create(user=creator_b, text='Quiet post', likes_count=1)
    high = Post.objects.create(user=creator_a, text='Hot post', likes_count=50)

    ContentEngagementEvent.objects.create(
        user=viewer,
        content_type='post',
        content_id=high.id,
        author_id=creator_a.id,
        event_type='dwell_10s',
    )
    ContentEngagementEvent.objects.create(
        user=viewer,
        content_type='post',
        content_id=high.id,
        author_id=creator_a.id,
        event_type='share',
    )
    invalidate_author_affinity(viewer.id)

    api_client.force_authenticate(user=viewer)
    res = api_client.get('/api/posts/', {'feed': 'for_you'})
    assert res.status_code == 200
    ids = [p['id'] for p in res.data]
    assert high.id in ids
    assert ids.index(high.id) < ids.index(low.id)


@pytest.mark.django_db
def test_creativity_score_prefers_inspiration_posts(creator_a):
    plain = Post.objects.create(user=creator_a, text='Plain')
    inspired = Post.objects.create(
        user=creator_a,
        text='Inspired',
        post_type='question',
        tags=['art', 'sketch'],
        mood='🎨',
    )
    now = timezone.now()
    plain_score = score_post(
        plain,
        affinity={},
        following_ids=set(),
        interests=['art'],
        now=now,
    )
    inspired_score = score_post(
        inspired,
        affinity={},
        following_ids=set(),
        interests=['art'],
        now=now,
    )
    assert inspired_score > plain_score


@pytest.mark.django_db
def test_tag_affinity_from_engaged_posts(viewer, creator_a):
    post = Post.objects.create(user=creator_a, text='Art signal', tags=['watercolor', 'sketch'])
    ContentEngagementEvent.objects.create(
        user=viewer,
        content_type='post',
        content_id=post.id,
        author_id=creator_a.id,
        event_type='save',
    )
    invalidate_author_affinity(viewer.id)
    tags = get_tag_affinity(viewer.id)
    assert tags.get('watercolor', 0) > 0
    assert tags.get('sketch', 0) > 0

    now = timezone.now()
    matched = Post.objects.create(user=creator_a, text='More art', tags=['watercolor'])
    other = Post.objects.create(user=creator_a, text='Other', tags=['cooking'])
    matched_score = score_post(
        matched, affinity={}, following_ids=set(), interests=[], now=now, tag_affinity=tags,
    )
    other_score = score_post(
        other, affinity={}, following_ids=set(), interests=[], now=now, tag_affinity=tags,
    )
    assert matched_score > other_score


@pytest.mark.django_db
def test_learned_feature_weights_returns_keys():
    weights = get_learned_feature_weights()
    assert 'creativity' in weights
    assert 'tag_affinity' in weights
    assert weights['creativity'] > 0


@pytest.mark.django_db
def test_persist_feed_weights_snapshot(creator_a):
    ContentEngagementEvent.objects.create(
        user=creator_a,
        content_type='post',
        content_id=1,
        author_id=creator_a.id,
        event_type='like',
    )
    snapshot = persist_feed_weights_snapshot(source='engagement_7d')
    assert snapshot.id
    assert snapshot.source == 'engagement_7d'
    assert 'creativity' in snapshot.weights
    assert FeedRankingSnapshot.objects.filter(id=snapshot.id).exists()


@pytest.mark.django_db
def test_collaborative_author_boost_from_co_engagement(
    django_user_model, viewer, creator_a, creator_b,
):
    neighbor = django_user_model.objects.create_user(
        username='neighbor',
        email='neighbor@example.com',
        password='pass1234',
    )
    shared_post = Post.objects.create(user=creator_a, text='Shared taste')
    neighbor_liked = Post.objects.create(user=creator_b, text='Neighbor pick')

    ContentEngagementEvent.objects.create(
        user=viewer,
        content_type='post',
        content_id=shared_post.id,
        author_id=creator_a.id,
        event_type='like',
    )
    ContentEngagementEvent.objects.create(
        user=neighbor,
        content_type='post',
        content_id=shared_post.id,
        author_id=creator_a.id,
        event_type='like',
    )
    ContentEngagementEvent.objects.create(
        user=neighbor,
        content_type='post',
        content_id=neighbor_liked.id,
        author_id=creator_b.id,
        event_type='share',
    )
    invalidate_author_affinity(viewer.id)

    boost = get_collaborative_author_boost(viewer.id)
    assert boost.get(creator_b.id, 0) > 0

    now = timezone.now()
    boosted_post = Post.objects.create(user=creator_b, text='Should rank higher')
    plain_post = Post.objects.create(user=creator_a, text='Baseline')
    boosted_score = score_post(
        boosted_post,
        affinity={},
        following_ids=set(),
        interests=[],
        now=now,
        collaborative_boost=boost,
    )
    plain_score = score_post(
        plain_post,
        affinity={},
        following_ids=set(),
        interests=[],
        now=now,
        collaborative_boost=boost,
    )
    assert boosted_score > plain_score


@pytest.mark.django_db
def test_trending_tags_include_scored_payload(creator_a):
    Post.objects.create(user=creator_a, text='Tagged', tags=['cosmos'], likes_count=12)
    Post.objects.create(user=creator_a, text='Also tagged', tags=['cosmos'], comments_count=4)
    payload = compute_trending_tags(limit=5)
    assert payload
    assert payload[0]['tag'] == 'cosmos'
    assert payload[0]['count'] >= 2
    assert payload[0]['score'] > 0


@pytest.mark.django_db
def test_trending_tags_endpoint(api_client, creator_a):
    Post.objects.create(user=creator_a, text='Trend', tags=['nebula'])
    res = api_client.get('/api/posts/trending_tags/')
    assert res.status_code == 200
    assert any(row.get('tag') == 'nebula' for row in res.data)


@pytest.mark.django_db
def test_interest_vector_boosts_matching_tags(viewer, creator_a):
    engaged = Post.objects.create(user=creator_a, text='Engaged art', tags=['watercolor', 'sketch'])
    ContentEngagementEvent.objects.create(
        user=viewer,
        content_type='post',
        content_id=engaged.id,
        author_id=creator_a.id,
        event_type='save',
    )
    ContentEngagementEvent.objects.create(
        user=viewer,
        content_type='post',
        content_id=engaged.id,
        author_id=creator_a.id,
        event_type='dwell_10s',
    )

    vector = rebuild_user_interest_vector(viewer.id)
    assert vector.weights.get('watercolor', 0) > 0
    assert UserInterestVector.objects.filter(user=viewer).exists()

    invalidate_author_affinity(viewer.id)
    interest_vector = get_user_interest_vector(viewer.id)
    assert interest_vector.get('watercolor', 0) > 0

    now = timezone.now()
    matched = Post.objects.create(user=creator_a, text='More watercolor', tags=['watercolor'])
    other = Post.objects.create(user=creator_a, text='Cooking', tags=['cooking'])
    matched_score = score_post(
        matched,
        affinity={},
        following_ids=set(),
        interests=[],
        now=now,
        interest_vector=interest_vector,
    )
    other_score = score_post(
        other,
        affinity={},
        following_ids=set(),
        interests=[],
        now=now,
        interest_vector=interest_vector,
    )
    assert matched_score > other_score
