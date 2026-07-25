import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from users.models import UserTwoFactor, VerificationRequest
from users.totp import generate_totp_secret, verify_totp

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(django_user_model):
    u = django_user_model.objects.create_user(
        username='sec_user',
        email='sec@example.com',
        password='pass1234',
        is_verified=True,
    )
    return u


@pytest.mark.django_db
def test_account_export(api_client, user):
    api_client.force_authenticate(user=user)
    res = api_client.get('/api/users/me/export/')
    assert res.status_code == 200, res.content
    assert res.data['account']['username'] == 'sec_user'


@pytest.mark.django_db
def test_two_factor_login_flow(api_client, user):
    secret = generate_totp_secret()
    UserTwoFactor.objects.create(user=user, totp_secret=secret, is_enabled=True)
    import pyotp
    code = pyotp.TOTP(secret).now()

    res = api_client.post('/api/users/login/', {
        'username': 'sec_user', 'password': 'pass1234',
    }, format='json')
    assert res.status_code == 200, res.content
    assert res.data.get('requires_2fa') is True
    pending = res.data['pending_token']

    res2 = api_client.post('/api/users/login/2fa/', {
        'pending_token': pending, 'code': code,
    }, format='json')
    assert res2.status_code == 200, res2.content
    assert 'token' in res2.data


@pytest.mark.django_db
def test_verification_request(api_client, user):
    api_client.force_authenticate(user=user)
    res = api_client.post('/api/users/me/verification/', {
        'reason': 'I publish daily creative content for the Outverse community.',
        'links': ['https://example.com/portfolio'],
    }, format='json')
    assert res.status_code == 201, res.content
    assert VerificationRequest.objects.filter(user=user, status='pending').exists()


@pytest.mark.django_db
def test_account_delete(api_client, user):
    api_client.force_authenticate(user=user)
    uid = user.id
    res = api_client.post('/api/users/me/delete/', {
        'password': 'pass1234',
        'confirmation': 'DELETE',
    }, format='json')
    assert res.status_code == 200, res.content
    assert not User.objects.filter(id=uid).exists()


@pytest.mark.django_db
def test_engagement_events(api_client, user):
    api_client.force_authenticate(user=user)
    res = api_client.post('/api/analytics/events/', {
        'events': [{
            'content_type': 'post',
            'content_id': 1,
            'author_id': 2,
            'event_type': 'dwell_10s',
            'metadata': {'dwell_ms': 12000},
        }],
    }, format='json')
    assert res.status_code == 200, res.content
    assert res.data['accepted'] == 1
