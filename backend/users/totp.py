"""TOTP two-factor authentication helpers."""

from __future__ import annotations

import hashlib
import secrets

import pyotp


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def totp_for_secret(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret)


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    normalized = ''.join(ch for ch in str(code) if ch.isdigit())
    if len(normalized) != 6:
        return False
    return totp_for_secret(secret).verify(normalized, valid_window=1)


def provisioning_uri(secret: str, email: str, issuer: str = 'Outverse') -> str:
    return totp_for_secret(secret).provisioning_uri(name=email or 'user', issuer_name=issuer)


def generate_backup_codes(count: int = 8) -> list[str]:
    return [secrets.token_hex(4) for _ in range(count)]


def hash_backup_code(code: str) -> str:
    return hashlib.sha256(code.strip().lower().encode()).hexdigest()


def verify_backup_code(stored_hashes: list[str], code: str) -> bool:
    digest = hash_backup_code(code)
    return digest in (stored_hashes or [])
