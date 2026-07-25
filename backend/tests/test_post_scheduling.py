from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APIClient

from posts.models import Post, ScheduledPost
from subscriptions.models import CreatorTier


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(username='scheduler1', email='s1@example.com', password='x')


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user(username='scheduler2', email='s2@example.com', password='x')


@pytest.mark.django_db
def test_create_requires_future_publish_at(api_client, user):
    api_client.force_authenticate(user=user)
    res = api_client.post('/api/scheduled-posts/', {
        'payload': {'text': 'hello'},
        'publish_at': (timezone.now() - timedelta(hours=1)).isoformat(),
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_create_requires_text(api_client, user):
    api_client.force_authenticate(user=user)
    res = api_client.post('/api/scheduled-posts/', {
        'payload': {'text': '   '},
        'publish_at': (timezone.now() + timedelta(hours=1)).isoformat(),
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_create_rejects_other_creators_tier(api_client, user, other_user):
    tier = CreatorTier.objects.create(creator=other_user, name='VIP', price_usd_cents=500)
    api_client.force_authenticate(user=user)
    res = api_client.post('/api/scheduled-posts/', {
        'payload': {'text': 'gated', 'visibility': 'subscribers', 'required_tier_id': tier.id},
        'publish_at': (timezone.now() + timedelta(hours=1)).isoformat(),
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_create_and_list_scoped_to_owner(api_client, user, other_user):
    ScheduledPost.objects.create(
        user=other_user, payload={'text': 'not yours'}, publish_at=timezone.now() + timedelta(hours=1),
    )
    api_client.force_authenticate(user=user)
    res = api_client.post('/api/scheduled-posts/', {
        'payload': {'text': 'mine'},
        'publish_at': (timezone.now() + timedelta(hours=1)).isoformat(),
    }, format='json')
    assert res.status_code == 201, res.content

    res = api_client.get('/api/scheduled-posts/')
    assert res.status_code == 200
    results = res.data['results'] if isinstance(res.data, dict) else res.data
    assert len(results) == 1
    assert results[0]['payload']['text'] == 'mine'


@pytest.mark.django_db
def test_cancel_pending_then_reject_double_cancel(api_client, user):
    scheduled = ScheduledPost.objects.create(
        user=user, payload={'text': 'cancel me'}, publish_at=timezone.now() + timedelta(hours=1),
    )
    api_client.force_authenticate(user=user)
    res = api_client.delete(f'/api/scheduled-posts/{scheduled.id}/')
    assert res.status_code == 204
    scheduled.refresh_from_db()
    assert scheduled.status == 'canceled'

    res = api_client.delete(f'/api/scheduled-posts/{scheduled.id}/')
    assert res.status_code == 400


@pytest.mark.django_db
def test_cannot_cancel_already_published(api_client, user):
    post = Post.objects.create(user=user, text='already live')
    scheduled = ScheduledPost.objects.create(
        user=user, payload={'text': 'already live'}, publish_at=timezone.now() - timedelta(minutes=1),
        status='published', published_post=post,
    )
    api_client.force_authenticate(user=user)
    res = api_client.delete(f'/api/scheduled-posts/{scheduled.id}/')
    assert res.status_code == 400


@pytest.mark.django_db
def test_management_command_publishes_due_and_skips_future(user):
    due = ScheduledPost.objects.create(
        user=user, payload={'text': 'due now', 'mood': 'excited', 'tags': ['a', 'b']},
        publish_at=timezone.now() - timedelta(minutes=1),
    )
    future = ScheduledPost.objects.create(
        user=user, payload={'text': 'not yet'}, publish_at=timezone.now() + timedelta(hours=1),
    )

    call_command('publish_scheduled_posts')

    due.refresh_from_db()
    future.refresh_from_db()
    assert due.status == 'published'
    assert due.published_post is not None
    assert due.published_post.text == 'due now'
    assert due.published_post.mood == 'excited'
    assert due.published_post.tags == ['a', 'b']
    assert future.status == 'pending'
    assert future.published_post is None


@pytest.mark.django_db
def test_management_command_does_not_republish(user):
    due = ScheduledPost.objects.create(
        user=user, payload={'text': 'once only'}, publish_at=timezone.now() - timedelta(minutes=1),
    )
    call_command('publish_scheduled_posts')
    call_command('publish_scheduled_posts')

    due.refresh_from_db()
    assert Post.objects.filter(text='once only').count() == 1
    assert due.status == 'published'


@pytest.mark.django_db
def test_management_command_marks_failed_on_empty_text(user):
    due = ScheduledPost.objects.create(
        user=user, payload={'text': ''}, publish_at=timezone.now() - timedelta(minutes=1),
    )
    call_command('publish_scheduled_posts')
    due.refresh_from_db()
    assert due.status == 'failed'
    assert due.error
