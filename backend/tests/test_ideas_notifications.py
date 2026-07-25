import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from ideas.models import Idea
from notifications.models import Notification

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
def test_idea_comment_notifies_owner(api_client, owner, viewer):
    idea = Idea.objects.create(owner=owner, title='Notify me', description='body')
    api_client.force_authenticate(user=viewer)
    res = api_client.post(f'/api/ideas/{idea.id}/comments/', {
        'content': 'Great concept!',
    }, format='json')
    assert res.status_code == 201, res.content
    note = Notification.objects.filter(recipient=owner, verb='idea_comment').first()
    assert note is not None
    assert note.idea_id == idea.id
    assert note.actor_id == viewer.id


@pytest.mark.django_db
def test_idea_apply_notifies_owner(api_client, owner, viewer):
    idea = Idea.objects.create(
        owner=owner,
        title='Collab',
        description='body',
        roles_needed=['designer'],
    )
    api_client.force_authenticate(user=viewer)
    res = api_client.post(f'/api/ideas/{idea.id}/apply/', {
        'role': 'designer',
        'message': 'I can help',
    }, format='json')
    assert res.status_code == 201, res.content
    assert Notification.objects.filter(recipient=owner, verb='idea_apply').exists()


@pytest.mark.django_db
def test_accept_applicant_notifies_applicant(api_client, owner, viewer):
    from ideas.models import CollaborationRequest

    idea = Idea.objects.create(
        owner=owner,
        title='Team up',
        description='body',
        roles_needed=['writer'],
    )
    req = CollaborationRequest.objects.create(
        idea=idea, user=viewer, role='writer', message='pick me',
    )
    api_client.force_authenticate(user=owner)
    res = api_client.post(
        f'/api/ideas/{idea.id}/applicants/{req.id}/respond/',
        {'action': 'accept'},
        format='json',
    )
    assert res.status_code == 200, res.content
    assert Notification.objects.filter(recipient=viewer, verb='idea_accepted').exists()
    assert idea.collaborators.filter(id=viewer.id).exists()


@pytest.mark.django_db
def test_owner_id_filter(api_client, owner, viewer):
    Idea.objects.create(owner=owner, title='Owner idea', description='x')
    Idea.objects.create(owner=viewer, title='Other', description='x')

    res = api_client.get(f'/api/ideas/?owner_id={owner.id}')
    assert res.status_code == 200
    results = res.data['results'] if isinstance(res.data, dict) else res.data
    assert len(results) == 1
    assert results[0]['title'] == 'Owner idea'
