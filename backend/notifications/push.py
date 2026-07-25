import json
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

VERB_LABELS = {
    'reaction': 'New reaction',
    'comment': 'New comment',
    'follow': 'New follower',
    'mention': 'You were mentioned',
    'chat_message': 'New message',
    'achievement_unlocked': 'Achievement unlocked',
    'challenge_complete': 'Challenge complete',
    'shop_purchase': 'Shop purchase',
    'moderation_action': 'Moderation update',
    'share': 'Signal shared',
    'broadcast': 'Announcement',
    'going_live': 'Went live',
    'idea_pledge': 'Idea pledge',
    'tip': 'Tip received',
}


def _notification_url(payload: dict) -> str:
    if payload.get('post'):
        return f"/?post={payload['post']}"
    if payload.get('reel'):
        return f"/reels?id={payload['reel']}"
    if payload.get('story'):
        return f"/?story={payload['story']}"
    return '/notifications'


def _send_expo_push(sub, title: str, body: str, url: str) -> None:
    token = (sub.auth or '').strip()
    if sub.endpoint.startswith('expo://'):
        token = sub.endpoint.removeprefix('expo://')
    if not token:
        return

    try:
        import requests
    except ImportError:
        return

    try:
        response = requests.post(
            'https://exp.host/--/api/v2/push/send',
            json={
                'to': token,
                'title': title,
                'body': body,
                'data': {'url': url},
                'sound': 'default',
            },
            timeout=5,
        )
        if response.status_code in (400, 404, 410):
            try:
                details = response.json().get('data', {}).get('details', {})
            except ValueError:
                details = {}
            if details.get('error') == 'DeviceNotRegistered':
                sub.delete()
        elif response.status_code >= 400:
            logger.warning('expo push failed for user %s: %s', sub.user_id, response.text[:200])
    except Exception as exc:
        logger.warning('expo push failed for user %s: %s', sub.user_id, exc)


def send_push_to_user(user_id: int, payload: dict) -> None:
    from .models import PushSubscription

    subs = list(PushSubscription.objects.filter(user_id=user_id))
    if not subs:
        return

    verb = payload.get('verb') or payload.get('type') or 'notification'
    title = VERB_LABELS.get(verb, 'Cosmory')
    body = (payload.get('text') or '').strip() or title
    url = _notification_url(payload)
    data = json.dumps({'title': title, 'body': body, 'url': url})
    public_key = getattr(settings, 'VAPID_PUBLIC_KEY', '') or ''
    private_key = getattr(settings, 'VAPID_PRIVATE_KEY', '') or ''
    vapid_claims = {
        'sub': getattr(settings, 'VAPID_ADMIN_EMAIL', 'mailto:admin@outverse.local'),
    }

    for sub in subs:
        if sub.endpoint.startswith(('expo://', 'ios://', 'android://')) or sub.p256dh == 'expo':
            _send_expo_push(sub, title, body, url)
            continue
        if not public_key or not private_key:
            continue
        try:
            from pywebpush import WebPushException, webpush
        except ImportError:
            continue
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                },
                data=data,
                vapid_private_key=private_key,
                vapid_claims=vapid_claims,
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status in (404, 410):
                sub.delete()
            else:
                logger.warning('web push failed for user %s: %s', user_id, exc)
        except Exception as exc:
            logger.warning('web push failed for user %s: %s', user_id, exc)
