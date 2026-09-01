import os
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Conversation, Message
from .realtime import get_ice_servers

User = get_user_model()


class GetIceServersTestCase(TestCase):
    def test_stun_only_when_turn_unset(self):
        with mock.patch.dict(os.environ, {'TURN_URL': ''}):
            servers = get_ice_servers()
        self.assertTrue(all('urls' in s and 'username' not in s for s in servers))

    def test_single_turn_url_stays_a_string(self):
        with mock.patch.dict(
            os.environ,
            {'TURN_URL': 'turn:a.example:80', 'TURN_USERNAME': 'u', 'TURN_PASSWORD': 'p'},
        ):
            servers = get_ice_servers()
        turn_entry = servers[-1]
        self.assertEqual(turn_entry['urls'], 'turn:a.example:80')
        self.assertEqual(turn_entry['username'], 'u')

    def test_comma_separated_turn_urls_become_a_list(self):
        with mock.patch.dict(
            os.environ,
            {
                'TURN_URL': 'turn:a.example:80,turn:a.example:80?transport=tcp,turns:a.example:443?transport=tcp',
                'TURN_USERNAME': 'u',
                'TURN_PASSWORD': 'p',
            },
        ):
            servers = get_ice_servers()
        turn_entry = servers[-1]
        self.assertEqual(
            turn_entry['urls'],
            [
                'turn:a.example:80',
                'turn:a.example:80?transport=tcp',
                'turns:a.example:443?transport=tcp',
            ],
        )


class ChatAuthAPITestCase(APITestCase):
    def setUp(self):
        self.alice = User.objects.create_user(
            username='alice', password='pass12345'
        )
        self.bob = User.objects.create_user(
            username='bob', password='pass12345'
        )
        self.alice_token = Token.objects.create(user=self.alice)
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Token {self.alice_token.key}'
        )

    def test_friends_requires_auth(self):
        self.client.credentials()
        res = self.client.get('/api/chat/friends/')
        self.assertEqual(res.status_code, 401)

    def test_friends_authenticated(self):
        res = self.client.get('/api/chat/friends/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('friends', res.data)
        self.assertEqual(res.data['me']['id'], self.alice.id)

    def test_start_conversation_without_user_id_in_body(self):
        res = self.client.post(
            '/api/chat/conversations/start/',
            {'peer_id': self.bob.id},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            Conversation.objects.filter(
                user_a=self.alice, user_b=self.bob
            ).exists()
            or Conversation.objects.filter(
                user_a=self.bob, user_b=self.alice
            ).exists()
        )

    def test_send_message_in_conversation(self):
        conv = Conversation.for_users(self.alice.id, self.bob.id)
        res = self.client.post(
            f'/api/chat/conversations/{conv.id}/messages/',
            {'text': 'Hello cosmos'},
            format='json',
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Message.objects.filter(conversation=conv).count(), 1)

    def test_config_authenticated(self):
        res = self.client.get('/api/chat/config/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('ice_servers', res.data)
        self.assertIn('token=', res.data['websocket']['chat'])
