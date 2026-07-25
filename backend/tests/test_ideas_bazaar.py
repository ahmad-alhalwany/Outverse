import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from ideas.models import Idea, SavedIdea

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def owner(django_user_model):
    return django_user_model.objects.create_user(
        username='owner', email='owner@example.com', password='pass1234',
    )


@pytest.fixture
def viewer(django_user_model):
    return django_user_model.objects.create_user(
        username='viewer', email='viewer@example.com', password='pass1234',
    )


@pytest.mark.django_db
def test_create_idea_persists_tags(api_client, owner):
    api_client.force_authenticate(user=owner)
    res = api_client.post('/api/ideas/', {
        'title': 'Tagged idea',
        'description': 'Desc',
        'category': 'art',
        'tags': ['cosmos', 'sketch'],
    }, format='json')
    assert res.status_code == 201, res.content
    idea = Idea.objects.get(title='Tagged idea')
    assert idea.tags == ['cosmos', 'sketch']


@pytest.mark.django_db
def test_idea_serializer_flags(api_client, owner, viewer):
    idea = Idea.objects.create(
        owner=owner,
        title='Flags',
        description='Body',
        tags=['art'],
    )
    idea.votes.add(viewer)
    SavedIdea.objects.create(user=viewer, idea=idea)

    api_client.force_authenticate(user=viewer)
    res = api_client.get(f'/api/ideas/{idea.id}/')
    assert res.status_code == 200
    assert res.data['is_voted'] is True
    assert res.data['is_saved'] is True
    assert res.data['is_owner'] is False
    assert res.data['tags'] == ['art']


@pytest.mark.django_db
def test_toggle_save_idea(api_client, owner, viewer):
    idea = Idea.objects.create(owner=owner, title='Save me', description='x')
    api_client.force_authenticate(user=viewer)

    res = api_client.post(f'/api/ideas/{idea.id}/toggle-save/')
    assert res.status_code == 200
    assert res.data['saved'] is True
    assert SavedIdea.objects.filter(user=viewer, idea=idea).exists()

    res = api_client.post(f'/api/ideas/{idea.id}/toggle-save/')
    assert res.data['saved'] is False
    assert not SavedIdea.objects.filter(user=viewer, idea=idea).exists()


@pytest.mark.django_db
def test_owner_filter_me(api_client, owner, viewer):
    Idea.objects.create(owner=owner, title='Mine', description='x')
    Idea.objects.create(owner=viewer, title='Theirs', description='y')

    api_client.force_authenticate(user=owner)
    res = api_client.get('/api/ideas/?owner=me')
    assert res.status_code == 200
    results = res.data['results'] if isinstance(res.data, dict) else res.data
    assert len(results) == 1
    assert results[0]['title'] == 'Mine'
    assert results[0]['is_owner'] is True


@pytest.mark.django_db
def test_tag_filter(api_client, owner):
    Idea.objects.create(owner=owner, title='A', description='x', tags=['nebula'])
    Idea.objects.create(owner=owner, title='B', description='x', tags=['garden'])

    res = api_client.get('/api/ideas/?tag=nebula')
    assert res.status_code == 200
    results = res.data['results'] if isinstance(res.data, dict) else res.data
    assert len(results) == 1
    assert results[0]['title'] == 'A'


@pytest.mark.django_db
def test_create_idea_with_target_date_and_milestones(api_client, owner):
    api_client.force_authenticate(user=owner)
    res = api_client.post('/api/ideas/', {
        'title': 'Roadmap idea',
        'description': 'Desc',
        'target_date': '2026-12-31',
        'milestones': [
            {'title': 'Prototype', 'done': False},
            {'title': 'Launch', 'done': False, 'due_date': '2026-06-01'},
        ],
    }, format='json')
    assert res.status_code == 201, res.content
    idea = Idea.objects.get(title='Roadmap idea')
    assert str(idea.target_date) == '2026-12-31'
    assert len(idea.milestones) == 2
    assert idea.milestones[0]['title'] == 'Prototype'
    assert idea.milestones[0]['id']


@pytest.mark.django_db
def test_patch_milestones(api_client, owner):
    idea = Idea.objects.create(owner=owner, title='Milestones', description='x')
    api_client.force_authenticate(user=owner)
    res = api_client.patch(f'/api/ideas/{idea.id}/', {
        'milestones': [{'id': 'm1', 'title': 'Ship', 'done': True}],
    }, format='json')
    assert res.status_code == 200
    idea.refresh_from_db()
    assert idea.milestones[0]['done'] is True
