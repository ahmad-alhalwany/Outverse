from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import Comment, Post

User = get_user_model()


class PostsAuthAPITest(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username='author', password='pass12345'
        )
        self.reader = User.objects.create_user(
            username='reader', password='pass12345'
        )
        self.token = Token.objects.create(user=self.reader)
        self.post = Post.objects.create(user=self.author, text='Hello cosmos')

    def _auth(self):
        self.client.credentials(
            HTTP_AUTHORIZATION=f'Token {self.token.key}'
        )

    def test_react_requires_auth(self):
        res = self.client.post(
            f'/api/posts/{self.post.id}/react/',
            {'reaction': 'cosmic'},
            format='json',
        )
        self.assertEqual(res.status_code, 401)

    def test_react_and_toggle(self):
        self._auth()
        res = self.client.post(
            f'/api/posts/{self.post.id}/react/',
            {'reaction': 'cosmic'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['my_reaction'], 'cosmic')
        res2 = self.client.post(
            f'/api/posts/{self.post.id}/react/',
            {'reaction': 'cosmic'},
            format='json',
        )
        self.assertIsNone(res2.data['my_reaction'])

    def test_comment_with_media_and_react(self):
        self._auth()
        res = self.client.post(
            '/api/comments/',
            {
                'post': self.post.id,
                'text': 'Nice!',
                'gif_url': 'https://example.com/a.gif',
            },
            format='json',
        )
        self.assertEqual(res.status_code, 201)
        cid = res.data['id']
        react = self.client.post(
            f'/api/comments/{cid}/react/',
            {'reaction': 'spark'},
            format='json',
        )
        self.assertEqual(react.status_code, 200)
        self.assertEqual(react.data['my_reaction'], 'spark')

    def test_share_increments(self):
        self._auth()
        res = self.client.post(f'/api/posts/{self.post.id}/share/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['shares_count'], 1)
        self.post.refresh_from_db()
        self.assertEqual(self.post.shares_count, 1)

    def test_create_comment_sets_user_from_token(self):
        self._auth()
        res = self.client.post(
            '/api/comments/',
            {'post': self.post.id, 'text': 'Token user'},
            format='json',
        )
        self.assertEqual(res.status_code, 201)
        comment = Comment.objects.get(pk=res.data['id'])
        self.assertEqual(comment.user_id, self.reader.id)
