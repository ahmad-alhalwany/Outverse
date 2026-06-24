import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from posts.models import Post
from reels.models import Reel, ReelComment
from notifications.models import Notification


def _login(client, user):
    client.force_authenticate(user=user)
    return user


def _login_token(client, user):
    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return token


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        username='test_user',
        email='test@example.com',
        password='pass1234',
        first_name='Test',
        last_name='User',
    )


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user(
        username='other_user',
        email='other@example.com',
        password='pass1234',
    )


@pytest.mark.django_db
def test_register_login_flow(api_client, django_user_model):
    res = api_client.post('/api/users/register/', {
        'username': 'new_user',
        'email': 'new@example.com',
        'password': 'newpass123',
    }, format='json')
    assert res.status_code == 201, res.content
    assert django_user_model.objects.filter(username='new_user').exists()

    res = api_client.post('/api/users/login/', {
        'username': 'new_user',
        'password': 'newpass123',
    }, format='json')
    assert res.status_code == 200, res.content
    assert 'token' in res.data


@pytest.mark.django_db
def test_user_profile_flow(api_client, user, other_user):
    _login(api_client, user)

    res = api_client.get('/api/users/me/')
    assert res.status_code == 200
    assert res.data['username'] == user.username

    res = api_client.post('/api/users/follow/', {'user_id': other_user.id}, format='json')
    assert res.status_code in (200, 201)


@pytest.mark.django_db
def test_post_create_react_comment(api_client, user):
    from posts.models import Post
    _login(api_client, user)

    post = Post.objects.create(user=user, text='E2E test post')

    res = api_client.post(f'/api/posts/{post.id}/react/')
    assert res.status_code == 200, res.content

    res = api_client.post('/api/comments/', {
        'post': post.id,
        'text': 'E2E comment',
    }, format='json')
    assert res.status_code == 201, res.content

    res = api_client.get(f'/api/posts/{post.id}/')
    assert res.status_code == 200


@pytest.mark.django_db
def test_reel_flow(api_client, user):
    _login(api_client, user)

    res = api_client.get('/api/reels/')
    assert res.status_code == 200

    res = api_client.get('/api/reel-music/')
    assert res.status_code == 200

    res = api_client.get('/api/reels/discover/')
    assert res.status_code == 200


@pytest.mark.django_db
def test_notification_created_on_reel_like(api_client, user, other_user):
    from reels.models import Reel
    import os
    from django.core.files.base import ContentFile
    reel = Reel.objects.create(
        user=other_user,
        caption='Target reel',
    )
    # Provide minimal valid video bytes so validation/storage succeeds.
    from io import BytesIO
    reel.video.save('test_reel.mp4', ContentFile(b'\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isom')), save=True

    _login(api_client, user)
    res = api_client.post(f'/api/reels/{reel.id}/react/')
    assert res.status_code == 200, res.content

    if user.id != other_user.id:
        notif = Notification.objects.filter(
            recipient=other_user, actor=user, verb='reaction', reel=reel
        ).first()
        assert notif is not None


@pytest.mark.django_db
def test_moderation_report(api_client, user, other_user):
    from reels.models import Reel
    from django.core.files.base import ContentFile
    reel = Reel.objects.create(user=other_user, caption='Reportable reel')
    reel.video.save('test_reel.mp4', ContentFile(b'\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isom')), save=True

    _login(api_client, user)
    res = api_client.post('/api/moderation/flagged/', {
        'type': 'reel',
        'content': f'reel:{reel.id} e2e report',
    }, format='json')
    assert res.status_code in (200, 201), res.content


@pytest.mark.django_db
def test_feed_and_search_endpoints_are_reachable(api_client, user):
    _login(api_client, user)

    res = api_client.get('/api/posts/feed/')
    assert res.status_code == 200

    res = api_client.get('/api/posts/trending/')
    assert res.status_code == 200

    res = api_client.get('/api/search/?q=test')
    assert res.status_code == 200


@pytest.mark.django_db
def test_shop_list_and_bottles_list(api_client, user):
    _login(api_client, user)

    res = api_client.get('/api/shop/items/')
    assert res.status_code == 200

    res = api_client.get('/api/bottles/')
    assert res.status_code == 200
