from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Challenge

User = get_user_model()


class ChallengeAuthAPITest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='labuser', password='pass12345')
        self.token = Token.objects.create(user=self.user)
        self.challenge = Challenge.objects.create(
            title='Daily',
            type='writing',
            is_daily=True,
            is_active=True,
            end_date=timezone.now() + timedelta(days=7),
        )

    def test_submission_requires_token(self):
        res = self.client.post(
            f'/api/challenges/{self.challenge.id}/submissions/',
            {'content': 'Hello'},
            format='json',
        )
        self.assertEqual(res.status_code, 401)

    def test_submission_with_token(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {self.token.key}')
        res = self.client.post(
            f'/api/challenges/{self.challenge.id}/submissions/',
            {'content': 'My entry'},
            format='json',
        )
        self.assertEqual(res.status_code, 201)
