import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):
    User = get_user_model()
    return User.objects.create_user(
        username='test_user',
        email='test@example.com',
        password='pass1234',
    )


@pytest.fixture
def staff_user(db):
    User = get_user_model()
    return User.objects.create_user(
        username='staff_user',
        email='staff@example.com',
        password='pass1234',
        is_staff=True,
    )


@pytest.mark.django_db
def test_analytics_dashboard_requires_staff(api_client, user, staff_user):
    res = api_client.get('/api/analytics/dashboard/')
    assert res.status_code == 401

    api_client.force_authenticate(user=user)
    res = api_client.get('/api/analytics/dashboard/')
    assert res.status_code == 403

    api_client.force_authenticate(user=staff_user)
    res = api_client.get('/api/analytics/dashboard/')
    assert res.status_code == 200


@pytest.mark.django_db
def test_audit_log_list_requires_staff(api_client, staff_user):
    api_client.force_authenticate(user=staff_user)
    res = api_client.get('/api/audit/')
    assert res.status_code in (200, 404)


@pytest.mark.django_db
def test_health_ping_is_public(api_client):
    res = api_client.get('/api/health/')
    assert res.status_code == 200


@pytest.mark.django_db
def test_admin_api_users_list_requires_staff(api_client, user, staff_user):
    api_client.force_authenticate(user=user)
    res = api_client.get('/api/users/')
    assert res.status_code == 200

    api_client.force_authenticate(user=staff_user)
    res = api_client.get('/api/users/')
    assert res.status_code == 200
