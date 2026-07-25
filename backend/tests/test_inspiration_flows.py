"""Tests for Inspiration Engine v2/v3 flows."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from questions.models import Question, QuestionView

User = get_user_model()


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username='inspire_user', password='testpass123')
    client = APIClient()
    client.force_authenticate(user=user)
    return client, user


@pytest.fixture
def sample_question(db):
    return Question.objects.create(
        text='What if gravity reversed for one hour?',
        category='surreal',
        language='en',
        tags=['test'],
    )


@pytest.mark.django_db
def test_question_skip_marks_view(auth_client, sample_question):
    client, user = auth_client
    QuestionView.objects.create(user=user, question=sample_question)
    res = client.post(f'/api/questions/{sample_question.id}/skip/')
    assert res.status_code == 200
    view = QuestionView.objects.get(user=user, question=sample_question)
    assert view.skipped is True


@pytest.mark.django_db
def test_publish_links_inspiration_question(auth_client, sample_question):
    client, user = auth_client
    res = client.post(
        '/api/posts/',
        {'text': 'My surreal answer', 'post_type': 'normal', 'inspiration_question_id': sample_question.id},
        format='json',
    )
    assert res.status_code == 201
    data = res.json()
    from posts.models import Post

    post = Post.objects.get(pk=data['id'])
    assert post.inspiration_question_id == sample_question.id
    view = QuestionView.objects.get(user=user, question=sample_question)
    assert view.answered is True


@pytest.mark.django_db
def test_question_history_lists_views(auth_client, sample_question):
    client, user = auth_client
    QuestionView.objects.create(user=user, question=sample_question, skipped=True)
    res = client.get('/api/questions/history/')
    assert res.status_code == 200
    body = res.json()
    assert body['count'] >= 1
    assert body['results'][0]['question']['id'] == sample_question.id
    assert body['results'][0]['skipped'] is True


@pytest.mark.django_db
def test_my_stats_includes_inspiration(auth_client, sample_question):
    client, user = auth_client
    client.post(
        '/api/posts/',
        {'text': 'Inspired post', 'post_type': 'normal', 'inspiration_question_id': sample_question.id},
        format='json',
    )
    res = client.get('/api/posts/my_stats/')
    assert res.status_code == 200
    data = res.json()
    assert data['inspiration_published'] == 1
    assert data['inspiration_by_category'].get('surreal') == 1
