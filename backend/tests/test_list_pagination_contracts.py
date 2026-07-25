"""Regression coverage for the pagination-envelope bug found 2026-07-03.

Every DRF ModelViewSet list action returns {count, next, previous, results}
(project-wide DEFAULT_PAGINATION_CLASS), not a bare array. Several frontend
pages assumed a bare array and crashed with "X.map is not a function" /
"X is not iterable" once real data existed. These tests lock the response
shape for every list endpoint that a frontend page consumes, so a future
change to pagination settings (or a new list-consuming page) fails loudly
here instead of silently breaking the browser.
"""

import pytest
from rest_framework.test import APIClient

from collab.models import Project
from ideas.models import Idea
from narratives.models import Story
from resources.models import Resource
from shop.models import ShopItem
from speculative.models import Character, DrawSession, FailedIdea, FutureMemory
from subscriptions.models import SubscriptionPlan


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        username='list_contract_user',
        email='list_contract@example.com',
        password='pass1234',
    )


def _assert_paginated_envelope(data):
    assert set(data.keys()) == {'count', 'next', 'previous', 'results'}
    assert isinstance(data['results'], list)


@pytest.mark.django_db
def test_resources_list_is_paginated(api_client):
    Resource.objects.create(title='Test Resource', type='template')
    res = api_client.get('/api/resources/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['title'] == 'Test Resource' for item in res.data['results'])


@pytest.mark.django_db
def test_collab_projects_list_is_paginated(api_client, user):
    Project.objects.create(title='Test Project', owner=user)
    api_client.force_authenticate(user=user)
    res = api_client.get('/api/collab/projects/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['title'] == 'Test Project' for item in res.data['results'])


@pytest.mark.django_db
def test_subscription_plans_list_is_paginated(api_client):
    SubscriptionPlan.objects.create(tier='nova', name='Nova', price_usd_cents=999)
    res = api_client.get('/api/subscriptions/plans/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['name'] == 'Nova' for item in res.data['results'])


@pytest.mark.django_db
def test_speculative_failed_ideas_list_is_paginated(api_client, user):
    FailedIdea.objects.create(title='Burned Idea', user=user)
    res = api_client.get('/api/speculative/failed-ideas/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['title'] == 'Burned Idea' for item in res.data['results'])


@pytest.mark.django_db
def test_speculative_draw_sessions_list_is_paginated(api_client, user):
    DrawSession.objects.create(title='Test Session', host=user)
    res = api_client.get('/api/speculative/draw-sessions/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['title'] == 'Test Session' for item in res.data['results'])


@pytest.mark.django_db
def test_speculative_future_memories_list_is_paginated(api_client, user):
    FutureMemory.objects.create(text='A memory from tomorrow', user=user, is_public=True)
    res = api_client.get('/api/speculative/future-memories/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['text'] == 'A memory from tomorrow' for item in res.data['results'])


@pytest.mark.django_db
def test_speculative_characters_list_is_paginated(api_client, user):
    Character.objects.create(name='Test Hero', creator=user)
    res = api_client.get('/api/speculative/characters/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['name'] == 'Test Hero' for item in res.data['results'])


@pytest.mark.django_db
def test_shop_items_list_is_paginated(api_client, user):
    ShopItem.objects.create(name='Test Item', description='desc', price=100, creator=user)
    res = api_client.get('/api/shop/items/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['name'] == 'Test Item' for item in res.data['results'])


@pytest.mark.django_db
def test_ideas_list_is_paginated(api_client, user):
    Idea.objects.create(title='Test Idea', description='desc', owner=user)
    res = api_client.get('/api/ideas/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['title'] == 'Test Idea' for item in res.data['results'])


@pytest.mark.django_db
def test_forge_stories_list_is_paginated(api_client, user):
    Story.objects.create(title='Test Story', premise='Once upon a time...', owner=user)
    res = api_client.get('/api/forge/stories/')
    assert res.status_code == 200
    _assert_paginated_envelope(res.data)
    assert any(item['title'] == 'Test Story' for item in res.data['results'])
