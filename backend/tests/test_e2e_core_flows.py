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
    from users.models import UserToken

    res = api_client.post('/api/users/register/', {
        'username': 'new_user',
        'email': 'new@example.com',
        'password': 'newpass123',
    }, format='json')
    assert res.status_code == 201, res.content
    new_user = django_user_model.objects.get(username='new_user')

    # Login before verifying email is rejected.
    res = api_client.post('/api/users/login/', {
        'username': 'new_user',
        'password': 'newpass123',
    }, format='json')
    assert res.status_code == 403, res.content
    assert res.data['code'] == 'email_not_verified'

    verification_token = UserToken.objects.get(
        user=new_user, token_type=UserToken.EMAIL_VERIFICATION
    )
    res = api_client.post('/api/users/verify-email/', {
        'token': verification_token.token,
    }, format='json')
    assert res.status_code == 200, res.content

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

    res = api_client.post('/api/users/follow/', {'following_id': other_user.id}, format='json')
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
    from django.core.files.base import ContentFile
    reel.video.save('test_reel.mp4', ContentFile(b'\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isom'))
    reel.save()

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
    from django.core.files.base import ContentFile
    reel.video.save('test_reel.mp4', ContentFile(b'\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00mp42isom'))
    reel.save()

    _login(api_client, user)
    res = api_client.post('/api/moderation/flagged/', {
        'type': 'reel',
        'content': f'reel:{reel.id} e2e report',
    }, format='json')
    assert res.status_code in (200, 201), res.content


@pytest.mark.django_db
def test_feed_and_search_endpoints_are_reachable(api_client, user):
    _login(api_client, user)

    res = api_client.get('/api/posts/?feed=following')
    assert res.status_code == 200

    res = api_client.get('/api/posts/trending/')
    assert res.status_code == 200

    res = api_client.get('/api/search/?q=test')
    assert res.status_code == 200
    assert 'challenges' in res.data


@pytest.mark.django_db
def test_shop_list_and_bottles_list(api_client, user):
    _login(api_client, user)

    res = api_client.get('/api/shop/items/')
    assert res.status_code == 200

    res = api_client.get('/api/bottles/')
    assert res.status_code == 200


@pytest.mark.django_db
def test_notifications_list_and_read(api_client, user, other_user):
    from posts.models import Post
    post = Post.objects.create(user=other_user, text='Notify me')
    Notification.objects.create(
        recipient=user,
        actor=other_user,
        verb='comment',
        post=post,
        text='commented on your post',
    )
    _login(api_client, user)

    res = api_client.get('/api/notifications/')
    assert res.status_code == 200, res.content
    rows = res.data.get('results', res.data)
    assert len(rows) >= 1

    nid = rows[0]['id']
    res = api_client.post(f'/api/notifications/{nid}/read/')
    assert res.status_code == 200, res.content


@pytest.mark.django_db
def test_reel_draft_and_creator_stats(api_client, user):
    from reels.models import ReelDraft
    _login(api_client, user)

    res = api_client.post('/api/reel-drafts/', {
        'caption': 'Draft signal',
        'mood': 'cosmic',
        'tags': ['test'],
    }, format='json')
    assert res.status_code == 201, res.content
    assert ReelDraft.objects.filter(user=user).count() == 1

    res = api_client.get('/api/reels/my_stats/')
    assert res.status_code == 200, res.content
    assert res.data['total_signals'] == 0


@pytest.mark.django_db
def test_posts_my_stats(api_client, user):
    from posts.models import Post
    _login(api_client, user)
    Post.objects.create(user=user, text='Stats post', views=10, likes_count=2)
    res = api_client.get('/api/posts/my_stats/')
    assert res.status_code == 200, res.content
    assert res.data['total_posts'] == 1
    assert res.data['total_views'] == 10


@pytest.mark.django_db
def test_stories_following_feed(api_client, user):
    _login(api_client, user)
    res = api_client.get('/api/stories/following/')
    assert res.status_code == 200, res.content


@pytest.mark.django_db
def test_comment_pin_vote(api_client, user):
    from posts.models import Post, Comment
    post = Post.objects.create(user=user, text='Pin test')
    comment = Comment.objects.create(post=post, user=user, text='Anchor this')
    _login(api_client, user)

    res = api_client.post(f'/api/comments/{comment.id}/pin/', {}, format='json')
    assert res.status_code == 200, res.content

    res = api_client.post(f'/api/comments/{comment.id}/vote/', {'vote': 'boost'}, format='json')
    assert res.status_code == 200, res.content


@pytest.mark.django_db
def test_search_includes_challenges(api_client, user):
    from datetime import timedelta

    from django.utils import timezone

    from challenges.models import Challenge

    Challenge.objects.create(
        title='Cosmic sketch test',
        description='Draw the void',
        type='art',
        end_date=timezone.now() + timedelta(days=7),
    )
    _login(api_client, user)
    res = api_client.get('/api/search/?q=cosmic')
    assert res.status_code == 200
    assert len(res.data.get('challenges', [])) >= 1


@pytest.mark.django_db
def test_ideas_category_all_not_empty(api_client, user):
    from ideas.models import Idea
    Idea.objects.create(
        owner=user,
        title='Test idea',
        description='Desc',
        category='art',
        status='open',
        funding_goal=100,
    )
    _login(api_client, user)
    res = api_client.get('/api/ideas/?category=all')
    assert res.status_code == 200
    results = res.data.get('results', res.data)
    assert len(results) >= 1


@pytest.mark.django_db
def test_login_rate_limit(api_client, django_user_model):
    django_user_model.objects.create_user(username='ratelimit', password='pass12345')
    for _ in range(31):
        res = api_client.post('/api/users/login/', {'username': 'ratelimit', 'password': 'wrong'}, format='json')
    assert res.status_code == 429
