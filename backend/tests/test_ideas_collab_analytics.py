import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from collab.models import Project, ProjectMember, ProjectTask
from ideas.models import CollaborationRequest, Idea

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
def collaborator(django_user_model):
    return django_user_model.objects.create_user(
        username='collab', email='collab@example.com', password='pass1234',
    )


@pytest.mark.django_db
def test_accept_applicant_creates_collab_project(api_client, owner, collaborator):
    idea = Idea.objects.create(
        owner=owner,
        title='Collab idea',
        description='Build it',
        roles_needed=['designer', 'writer'],
    )
    req = CollaborationRequest.objects.create(
        idea=idea, user=collaborator, role='designer', message='ready',
    )
    api_client.force_authenticate(user=owner)
    res = api_client.post(
        f'/api/ideas/{idea.id}/applicants/{req.id}/respond/',
        {'action': 'accept'},
        format='json',
    )
    assert res.status_code == 200, res.content
    assert res.data['collab_project_id']
    assert res.data['idea_status'] == 'in_progress'
    idea.refresh_from_db()
    assert idea.status == 'in_progress'
    project = Project.objects.get(source_idea=idea)
    assert project.title == 'Collab idea'
    assert ProjectMember.objects.filter(project=project, user=collaborator).exists()
    assert ProjectTask.objects.filter(project=project).count() == 2


@pytest.mark.django_db
def test_launch_collab_endpoint(api_client, owner):
    idea = Idea.objects.create(
        owner=owner,
        title='Manual launch',
        description='Go',
        roles_needed=['dev'],
    )
    api_client.force_authenticate(user=owner)
    res = api_client.post(f'/api/ideas/{idea.id}/launch-collab/')
    assert res.status_code == 200, res.content
    assert res.data['collab_project_id']
    assert Project.objects.filter(source_idea=idea).exists()


@pytest.mark.django_db
def test_creator_analytics_includes_ideas(api_client, owner, collaborator):
    from users.models import Profile

    idea = Idea.objects.create(
        owner=owner,
        title='Analytics idea',
        description='x',
        category='art',
        funding_raised=50,
    )
    idea.votes.add(collaborator)
    Profile.objects.filter(user=owner).update(points=1000)

    api_client.force_authenticate(user=owner)
    res = api_client.get('/api/analytics/creator/')
    assert res.status_code == 200
    assert res.data['ideas']['total_ideas'] == 1
    assert res.data['ideas']['total_supporters'] == 1
    assert res.data['ideas']['total_funding_raised'] == 50
    assert res.data['summary']['total_ideas'] == 1
    assert any(item['type'] == 'idea' for item in res.data['top_content'])
