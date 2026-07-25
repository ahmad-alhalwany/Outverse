import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from posts.models import FeedFeedback, Post
from users.models import UserBlock, UserMute

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def alice(django_user_model):
    return django_user_model.objects.create_user(
        username='alice', email='alice@example.com', password='pass1234',
    )


@pytest.fixture
def bob(django_user_model):
    return django_user_model.objects.create_user(
        username='bob', email='bob@example.com', password='pass1234',
    )


@pytest.mark.django_db
def test_block_user(api_client, alice, bob):
    api_client.force_authenticate(user=alice)
    res = api_client.post('/api/users/social/', {
        'user_id': bob.id, 'action': 'block',
    }, format='json')
    assert res.status_code == 200, res.content
    assert res.data['social']['is_blocked'] is True
    assert UserBlock.objects.filter(blocker=alice, blocked=bob).exists()


@pytest.mark.django_db
def test_blocked_profile_hidden(api_client, alice, bob):
    api_client.force_authenticate(user=alice)
    api_client.post('/api/users/social/', {'user_id': bob.id, 'action': 'block'}, format='json')
    res = api_client.get(f'/api/users/{bob.id}/')
    assert res.status_code == 404


@pytest.mark.django_db
def test_mute_hides_posts_from_feed(api_client, alice, bob):
    Post.objects.create(user=bob, text='Bob post')
    api_client.force_authenticate(user=alice)
    api_client.post('/api/users/social/', {'user_id': bob.id, 'action': 'mute'}, format='json')
    res = api_client.get('/api/posts/')
    assert res.status_code == 200
    assert len(res.data) == 0


@pytest.mark.django_db
def test_feed_feedback_see_less(api_client, alice, bob):
    Post.objects.create(user=bob, text='Hidden soon')
    api_client.force_authenticate(user=alice)
    post = Post.objects.get(user=bob)
    res = api_client.post(f'/api/posts/{post.id}/feedback/', {
        'type': 'see_less',
    }, format='json')
    assert res.status_code == 200
    assert FeedFeedback.objects.filter(user=alice, author=bob, feedback_type='see_less').exists()
    feed = api_client.get('/api/posts/')
    assert len(feed.data) == 0


@pytest.mark.django_db
def test_dm_blocked(api_client, alice, bob):
    api_client.force_authenticate(user=alice)
    api_client.post('/api/users/social/', {'user_id': bob.id, 'action': 'block'}, format='json')
    res = api_client.post('/api/chat/send/', {
        'peer_id': bob.id, 'text': 'hello',
    }, format='json')
    assert res.status_code == 403


@pytest.mark.django_db
def test_report_user(api_client, alice, bob):
    api_client.force_authenticate(user=alice)
    res = api_client.post('/api/moderation/report-user/', {
        'user_id': bob.id, 'reason': 'spam', 'details': 'test',
    }, format='json')
    assert res.status_code == 201, res.content


@pytest.mark.django_db
def test_privacy_prefs_update(api_client, alice):
    api_client.force_authenticate(user=alice)
    res = api_client.put('/api/preferences/', {
        'dm_policy': 'followers',
        'comment_policy': 'none',
        'hidden_words': ['spam'],
    }, format='json')
    assert res.status_code == 200, res.content
    assert res.data['dm_policy'] == 'followers'
    assert res.data['hidden_words'] == ['spam']
