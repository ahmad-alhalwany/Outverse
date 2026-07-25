import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from posts.models import Post, PostShareLog, Reaction
from reels.models import Reel, ReelLike, ReelShareLog

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def creator(django_user_model):
    return django_user_model.objects.create_user(
        username='creator',
        email='creator@example.com',
        password='pass1234',
    )


@pytest.fixture
def viewer(django_user_model):
    return django_user_model.objects.create_user(
        username='viewer',
        email='viewer@example.com',
        password='pass1234',
    )


@pytest.mark.django_db
def test_creator_analytics_requires_auth(api_client):
    res = api_client.get('/api/analytics/creator/')
    assert res.status_code == 401


@pytest.mark.django_db
def test_creator_analytics_empty(api_client, creator):
    api_client.force_authenticate(user=creator)
    res = api_client.get('/api/analytics/creator/')
    assert res.status_code == 200, res.content
    assert res.data['summary']['total_content'] == 0
    assert res.data['shares_by_channel'] == {}
    assert res.data['reactions_by_type'] == {}


@pytest.mark.django_db
def test_creator_analytics_aggregates_posts_reels_shares_reactions(
    api_client, creator, viewer,
):
    post = Post.objects.create(
        user=creator,
        text='Analytics post',
        views=120,
        likes_count=5,
        comments_count=2,
        shares_count=3,
        reposts_count=1,
    )
    reel = Reel.objects.create(
        user=creator,
        caption='Analytics signal',
        views=80,
        likes_count=4,
        comments_count=1,
        shares_count=2,
        is_active=True,
    )

    PostShareLog.objects.create(post=post, user=viewer, channel='whatsapp')
    PostShareLog.objects.create(post=post, user=creator, channel='copy')
    ReelShareLog.objects.create(reel=reel, user=viewer, channel='whatsapp')
    Reaction.objects.create(post=post, user=viewer, type='cosmic')
    Reaction.objects.create(post=post, user=creator, type='spark')
    ReelLike.objects.create(reel=reel, user=viewer, type='inspired')

    api_client.force_authenticate(user=creator)
    res = api_client.get('/api/analytics/creator/')
    assert res.status_code == 200, res.content

    summary = res.data['summary']
    assert summary['total_content'] == 2
    assert summary['total_posts'] == 1
    assert summary['total_signals'] == 1
    assert summary['total_views'] == 200
    assert summary['total_reposts'] == 1
    assert summary['total_reactions'] == 3

    assert res.data['shares_by_channel']['whatsapp'] == 2
    assert res.data['shares_by_channel']['copy'] == 1
    assert res.data['reactions_by_type']['cosmic'] == 1
    assert res.data['reactions_by_type']['spark'] == 1
    assert res.data['reactions_by_type']['inspired'] == 1

    assert len(res.data['engagement_trend']) == 7
    assert res.data['top_content'][0]['id'] in (post.id, reel.id)
