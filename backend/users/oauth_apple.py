"""Apple Sign-In identity_token verification (JWKS + RS256)."""

from __future__ import annotations

import os
import re
import time
from functools import lru_cache

import jwt
import requests
from jwt.algorithms import RSAAlgorithm


class AppleAuthError(Exception):
    pass


APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
APPLE_ISSUER = 'https://appleid.apple.com'


@lru_cache(maxsize=1)
def _fetch_apple_jwks(cache_bucket: int) -> dict:
    """cache_bucket changes hourly so keys refresh without process restart."""
    del cache_bucket  # used only as cache key
    resp = requests.get(APPLE_JWKS_URL, timeout=10)
    if resp.status_code != 200:
        raise AppleAuthError('Could not fetch Apple public keys.')
    return resp.json()


def _apple_jwks() -> dict:
    return _fetch_apple_jwks(int(time.time() // 3600))


def verify_apple_identity_token(identity_token: str) -> dict:
    client_id = os.environ.get('APPLE_CLIENT_ID', '').strip()
    if not client_id:
        raise AppleAuthError('Apple sign-in is not configured.')
    if not identity_token:
        raise AppleAuthError('Missing identity_token.')

    try:
        header = jwt.get_unverified_header(identity_token)
    except jwt.PyJWTError as exc:
        raise AppleAuthError('Invalid Apple token.') from exc

    kid = header.get('kid')
    if not kid:
        raise AppleAuthError('Invalid Apple token header.')

    jwks = _apple_jwks()
    key_data = next((k for k in jwks.get('keys', []) if k.get('kid') == kid), None)
    if not key_data:
        # Force JWKS refresh once if kid unknown
        _fetch_apple_jwks.cache_clear()
        jwks = _apple_jwks()
        key_data = next((k for k in jwks.get('keys', []) if k.get('kid') == kid), None)
    if not key_data:
        raise AppleAuthError('Unknown Apple signing key.')

    public_key = RSAAlgorithm.from_jwk(key_data)
    try:
        data = jwt.decode(
            identity_token,
            public_key,
            algorithms=['RS256'],
            audience=client_id,
            issuer=APPLE_ISSUER,
        )
    except jwt.PyJWTError as exc:
        raise AppleAuthError('Invalid Apple token.') from exc

    if not data.get('sub'):
        raise AppleAuthError('Invalid Apple profile.')
    return data


def username_from_apple(data: dict, User) -> str:
    email = (data.get('email') or '').strip()
    base = email.split('@')[0] if email else 'creator'
    base = re.sub(r'[^a-zA-Z0-9_]', '', base.lower())[:24] or 'creator'
    candidate = base
    n = 1
    while User.objects.filter(username__iexact=candidate).exists():
        candidate = f'{base}{n}'
        n += 1
    return candidate
