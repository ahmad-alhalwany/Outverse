"""
Cloudflare Turnstile verification for bot protection on signup.
Unconfigured by default (no TURNSTILE_SECRET_KEY) — verify_token() then
returns True unconditionally, so registration is unaffected until it's set.
"""
from __future__ import annotations

import requests
from django.conf import settings

VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
REQUEST_TIMEOUT = 10


def is_configured() -> bool:
    return bool(getattr(settings, 'TURNSTILE_SECRET_KEY', ''))


def verify_token(token: str, remote_ip: str = '') -> bool:
    """Verify a Turnstile response token. Fails closed only when configured."""
    if not is_configured():
        return True
    if not token:
        return False
    try:
        payload = {'secret': settings.TURNSTILE_SECRET_KEY, 'response': token}
        if remote_ip:
            payload['remoteip'] = remote_ip
        resp = requests.post(VERIFY_URL, data=payload, timeout=REQUEST_TIMEOUT)
        return bool(resp.json().get('success'))
    except Exception as e:
        print(f'Turnstile verification error: {e}')
        return False
