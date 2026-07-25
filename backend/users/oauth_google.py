"""Google OAuth id_token verification."""

from __future__ import annotations

import os
import re

import requests


class GoogleAuthError(Exception):
    pass


def verify_google_id_token(id_token: str) -> dict:
    client_id = os.environ.get('GOOGLE_OAUTH_CLIENT_ID', '').strip()
    if not client_id:
        raise GoogleAuthError('Google sign-in is not configured.')
    if not id_token:
        raise GoogleAuthError('Missing id_token.')

    resp = requests.get(
        'https://oauth2.googleapis.com/tokeninfo',
        params={'id_token': id_token},
        timeout=10,
    )
    if resp.status_code != 200:
        raise GoogleAuthError('Invalid Google token.')
    data = resp.json()
    if data.get('aud') != client_id:
        raise GoogleAuthError('Invalid Google token audience.')
    if data.get('email_verified', 'false') not in (True, 'true'):
        raise GoogleAuthError('Google email is not verified.')
    return data


def username_from_google(data: dict, User) -> str:
    base = (
        (data.get('given_name') or '').strip()
        or (data.get('email') or 'user').split('@')[0]
    )
    base = re.sub(r'[^a-zA-Z0-9_]', '', base.lower())[:24] or 'creator'
    candidate = base
    n = 1
    while User.objects.filter(username__iexact=candidate).exists():
        candidate = f'{base}{n}'
        n += 1
    return candidate
