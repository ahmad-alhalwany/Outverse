"""Smoke-check critical API routes used by mobile + web.

Usage (from backend/ with venv active):
  python manage.py shell -c "exec(open(r'../scripts/api_smoke_check.py', encoding='utf-8').read())"
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

# APIClient defaults to Host: testserver — allow it for local smoke runs.
if 'testserver' not in settings.ALLOWED_HOSTS and '*' not in settings.ALLOWED_HOSTS:
    settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ['testserver', 'localhost', '127.0.0.1']

User = get_user_model()
client = APIClient()

username = 'smoke_mobile_user'
password = 'SmokeTest123!'
user, created = User.objects.get_or_create(
    username=username,
    defaults={
        'email': 'smoke_mobile@example.com',
        'is_verified': True,
        'is_shadow_banned': False,
    },
)
if created or not user.check_password(password):
    user.set_password(password)
    user.is_verified = True
    user.is_shadow_banned = False
    user.save()

checks = []

def ok(name, cond, detail=''):
    checks.append((name, bool(cond), detail))
    mark = 'PASS' if cond else 'FAIL'
    print(f'[{mark}] {name}' + (f' — {detail}' if detail else ''))

res = client.post('/api/users/login/', {'username': username, 'password': password}, format='json')
ok('login username', res.status_code == 200 and 'token' in res.data, f'status={res.status_code}')

res = client.post('/api/users/login/', {'email': user.email, 'password': password}, format='json')
ok('login email', res.status_code == 200 and 'token' in res.data, f'status={res.status_code}')

token = res.data.get('token') if res.status_code == 200 else Token.objects.get_or_create(user=user)[0].key
client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

res = client.get('/api/users/me/')
ok('users/me', res.status_code == 200 and res.data.get('username') == username)

res = client.get('/api/posts/', {'limit': 5, 'offset': 0})
ok('posts feed envelope', res.status_code == 200 and ('results' in res.data or isinstance(res.data, list)))

res = client.post('/api/posts/', {'text': 'smoke post from api check'}, format='json')
ok('create post', res.status_code in (200, 201) and res.data.get('id'), f'status={res.status_code}')
post_id = res.data.get('id') if res.status_code in (200, 201) else None

if post_id:
    res = client.post(f'/api/posts/{post_id}/react/', {'reaction': 'spark'}, format='json')
    ok('react post', res.status_code == 200)

res = client.get('/api/users/by-username/%s/' % username)
ok('by-username full profile', res.status_code == 200 and 'followers_count' in res.data)

res = client.get('/api/notifications/')
ok('notifications', res.status_code == 200)

res = client.get('/api/chat/conversations/')
ok('chat conversations', res.status_code == 200)

res = client.get('/api/reels/', {'limit': 5, 'offset': 0})
ok('reels list', res.status_code == 200)

res = client.get('/api/search/', {'q': 'smoke'})
ok('search', res.status_code == 200)

res = client.get('/api/users/suggestions/')
ok('suggestions', res.status_code == 200)

res = client.get('/api/ads/delivery/')
ok('ads delivery', res.status_code in (200, 401, 403), f'status={res.status_code}')

res = client.get('/api/live/')
ok('live sessions', res.status_code == 200, f'status={res.status_code}')

res = client.get('/api/ideas/', {'limit': 5})
ok('ideas bazaar', res.status_code == 200)

res = client.get('/api/communities/')
ok('communities', res.status_code == 200)

res = client.get('/api/bottles/')
ok('bottles', res.status_code == 200)

failed = [c for c in checks if not c[1]]
print('\nSummary: %d/%d passed' % (len(checks) - len(failed), len(checks)))
if failed:
    raise SystemExit(1)
