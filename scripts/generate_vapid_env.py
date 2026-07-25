#!/usr/bin/env python3
"""Generate VAPID keys and merge them into the repo-root .env file."""

from __future__ import annotations

import re
import secrets
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid02 as Vapid
from py_vapid.utils import b64urlencode

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / '.env'
EXAMPLE_PATH = ROOT / '.env.example'


def generate_keys() -> tuple[str, str]:
    vapid = Vapid()
    vapid.generate_keys()
    raw_pub = vapid.public_key.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    public_key = b64urlencode(raw_pub)
    private_pem = vapid.private_pem().decode('utf-8')
    return public_key, private_pem


def upsert_env(lines: list[str], key: str, value: str) -> list[str]:
    pattern = re.compile(rf'^{re.escape(key)}=')
    replaced = False
    out: list[str] = []
    for line in lines:
        if pattern.match(line):
            out.append(f'{key}={value}')
            replaced = True
        else:
            out.append(line)
    if not replaced:
        if out and out[-1].strip():
            out.append('')
        out.append(f'{key}={value}')
    return out


def ensure_env_file() -> None:
    if ENV_PATH.exists():
        return
    if EXAMPLE_PATH.exists():
        content = EXAMPLE_PATH.read_text(encoding='utf-8')
        content = content.replace('change-me-to-a-real-secret-key', secrets.token_urlsafe(50))
        content = content.replace('change-me-to-a-real-password', secrets.token_urlsafe(24))
        ENV_PATH.write_text(content, encoding='utf-8')
        return
    ENV_PATH.write_text(
        '\n'.join([
            'POSTGRES_DB=outverse',
            'POSTGRES_USER=outverse',
            f'POSTGRES_PASSWORD={secrets.token_urlsafe(24)}',
            f'DJANGO_SECRET_KEY={secrets.token_urlsafe(50)}',
            '',
        ]) + '\n',
        encoding='utf-8',
    )


def main() -> None:
    ensure_env_file()
    public_key, private_pem = generate_keys()
    lines = ENV_PATH.read_text(encoding='utf-8').splitlines()
    lines = upsert_env(lines, 'VAPID_PUBLIC_KEY', public_key)
    lines = upsert_env(lines, 'VAPID_PRIVATE_KEY', private_pem.replace('\n', '\\n'))
    lines = upsert_env(lines, 'VAPID_ADMIN_EMAIL', 'mailto:admin@outverse.local')
    ENV_PATH.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'Updated {ENV_PATH} with VAPID keys (private key not printed).')


if __name__ == '__main__':
    main()
