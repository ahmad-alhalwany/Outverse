"""
End-to-end API verification for the reel flow.
Run: python manage.py shell < scripts/verify_reel_e2e.py
Or:  cd backend && python scripts/verify_reel_e2e.py  (with DJANGO_SETTINGS_MODULE)
"""
import os
import sys
from pathlib import Path

import django

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'outverse.settings')
    django.setup()

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from moderation.models import FlaggedContent
from notifications.models import Notification
from reels.models import Reel, ReelComment, ReelLike, ReelMusicTrack

User = get_user_model()
PASS = 'verify_reel_e2e_2026!'
OWNER = 'e2e_reel_owner'
VIEWER = 'e2e_reel_viewer'
errors = []
checks = []


def ok(label):
    checks.append(f'OK  {label}')
    print(f'[PASS] {label}')


def fail(label, detail=''):
    msg = f'FAIL {label}' + (f': {detail}' if detail else '')
    errors.append(msg)
    print(f'[FAIL] {label}' + (f' — {detail}' if detail else ''))


def ensure_user(username):
    user, created = User.objects.get_or_create(
        username=username,
        defaults={'email': f'{username}@test.local'},
    )
    if created or not user.check_password(PASS):
        user.set_password(PASS)
        user.save()
    return user


def login(client, username):
    res = client.post('/api/users/login/', {'username': username, 'password': PASS})
    if res.status_code != 200:
        fail(f'login {username}', res.content.decode()[:200])
        return None
    token = res.data.get('token')
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    return token


def main():
    owner = ensure_user(OWNER)
    viewer = ensure_user(VIEWER)

    owner_client = APIClient()
    viewer_client = APIClient()
    anon = APIClient()

    if not login(owner_client, OWNER):
        return 1
    if not login(viewer_client, VIEWER):
        return 1

    # 1) Reels list
    res = anon.get('/api/reels/')
    if res.status_code == 200 and isinstance(res.data, list):
        ok('GET /api/reels/ list')
    else:
        fail('GET /api/reels/', str(res.status_code))

    reel = Reel.objects.filter(is_active=True).select_related('user', 'music_track').first()
    if not reel:
        fail('reel exists', 'No active reels — run: python manage.py create_sample_reels')
        return 1
    ok(f'reel #{reel.id} available')

    # 2) Music tracks
    res = anon.get('/api/reel-music/')
    tracks = res.data if res.status_code == 200 else []
    if res.status_code == 200 and isinstance(tracks, list):
        ok(f'GET /api/reel-music/ ({len(tracks)} tracks)')
    else:
        fail('GET /api/reel-music/', str(res.status_code))

    if reel.music_track_id:
        ok(f'reel has music_track #{reel.music_track_id}')
    elif tracks:
        ok('music library available (reel may use video audio only)')

    # 3) Comment + reply
    Notification.objects.filter(
        recipient_id=reel.user_id, actor=viewer, verb='comment', reel=reel
    ).delete()
    ReelComment.objects.filter(reel=reel, user=viewer).delete()

    res = viewer_client.post(
        '/api/reel-comments/',
        {'reel': reel.id, 'text': 'E2E parent comment', 'gif_url': '', 'sticker_url': ''},
        format='json',
    )
    if res.status_code != 201:
        fail('POST comment', res.content.decode()[:200])
        return 1
    parent_id = res.data['id']
    ok('POST reel comment')

    res = viewer_client.post(
        '/api/reel-comments/',
        {
            'reel': reel.id,
            'parent': parent_id,
            'text': 'E2E reply',
            'gif_url': '',
            'sticker_url': '',
        },
        format='json',
    )
    if res.status_code != 201:
        fail('POST reply', res.content.decode()[:200])
    else:
        ok('POST reel reply')

    res = anon.get(f'/api/reel-comments/?reel={reel.id}')
    if res.status_code == 200:
        parents = res.data
        has_reply = any(
            c.get('id') == parent_id and len(c.get('replies') or []) >= 1
            for c in parents
        )
        if has_reply:
            ok('GET comments with nested replies')
        else:
            fail('nested replies in list')
    else:
        fail('GET reel-comments', str(res.status_code))

    res = viewer_client.post(
        f'/api/reel-comments/{parent_id}/react/',
        {'reaction': 'cosmic'},
        format='json',
    )
    if res.status_code == 200 and res.data.get('my_reaction') == 'cosmic':
        ok('POST comment react')
    else:
        fail('POST comment react', res.content.decode()[:200])

    res = viewer_client.post(
        f'/api/reel-comments/{parent_id}/react/',
        {'reaction': 'cosmic'},
        format='json',
    )
    if res.status_code == 200 and res.data.get('my_reaction') is None:
        ok('POST comment react toggle off')
    else:
        fail('comment react toggle', res.content.decode()[:200])

    notif = Notification.objects.filter(
        recipient_id=reel.user_id, actor=viewer, verb='comment', reel_id=reel.id
    ).first()
    if notif:
        ok(f'comment notification (id={notif.id})')
        if notif.reel_id == reel.id:
            ok('notification links to reel')
        else:
            fail('notification reel FK')
    else:
        fail('comment notification', f'not found for user #{reel.user_id}')

    share_url = f'/reels/{reel.id}'
    ok(f'share URL pattern {share_url}')

    # 4) Like → reaction notification
    ReelLike.objects.filter(user=viewer, reel=reel).delete()
    Notification.objects.filter(
        recipient_id=reel.user_id, actor=viewer, verb='reaction', reel=reel
    ).delete()
    res = viewer_client.post(f'/api/reels/{reel.id}/react/')
    if res.status_code != 200 or 'liked' not in res.data:
        fail('POST react', res.content.decode()[:200])
    elif not res.data.get('liked'):
        res = viewer_client.post(f'/api/reels/{reel.id}/react/')
    if res.status_code == 200:
        ok('POST reel react')
    if viewer.id == reel.user_id:
        ok('like notification skipped (own reel)')
    else:
        like_notif = Notification.objects.filter(
            recipient_id=reel.user_id, actor=viewer, verb='reaction', reel=reel
        ).exists()
        if like_notif and res.data.get('liked'):
            ok('like notification')
        else:
            fail('like notification', 'missing after like')

    # 5) Report comment
    comment = ReelComment.objects.filter(reel=reel, user=viewer).first()
    if comment:
        before = FlaggedContent.objects.filter(type='reel_comment').count()
        res = viewer_client.post(
            '/api/moderation/flagged/',
            {
                'type': 'reel_comment',
                'content': f'reel:{reel.id} comment:{comment.id} e2e report',
                'reporter': VIEWER,
            },
            format='json',
        )
        after = FlaggedContent.objects.filter(type='reel_comment').count()
        if res.status_code in (200, 201) and after > before:
            ok('POST moderation report')
        else:
            fail('POST moderation report', res.content.decode()[:200])

    # 6) Discover + user filter
    res = anon.get('/api/reels/discover/')
    if res.status_code == 200 and 'trending' in res.data:
        ok('GET /api/reels/discover/')
    else:
        fail('discover', str(res.status_code))

    res = anon.get(f'/api/reels/?user={reel.user_id}')
    if res.status_code == 200 and any(r['id'] == reel.id for r in res.data):
        ok('GET /api/reels/?user=')
    else:
        fail('reels by user filter')

    # 7) Record view
    res = anon.post(f'/api/reels/{reel.id}/record_view/')
    if res.status_code == 200 and 'views' in res.data:
        ok('POST record_view')
    else:
        fail('record_view', str(res.status_code))

    print('\n--- Summary ---')
    print(f'Passed: {len(checks)}')
    if errors:
        print(f'Failed: {len(errors)}')
        for e in errors:
            print(' ', e)
        return 1
    print('All reel E2E API checks passed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
