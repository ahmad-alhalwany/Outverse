"""
Real live-streaming ingest/playback via Cloudflare Stream's Live Inputs API.

Unconfigured by default (no CLOUDFLARE_STREAM_* env vars) — callers must check
`is_configured()` and fall back to local-only stream keys with no rtmp/playback
URLs, exactly like the pre-existing behavior. Configure via:
  CLOUDFLARE_STREAM_ACCOUNT_ID
  CLOUDFLARE_STREAM_API_TOKEN
  CLOUDFLARE_STREAM_CUSTOMER_CODE  (the "customer-<code>" subdomain shown in the
                                    dashboard next to any existing video — needed
                                    to build the public HLS playback URL)

Every call here is best-effort: network/auth/API failures are swallowed and
reported as None/False so a provider outage never breaks session create/end.
"""
from __future__ import annotations

import requests
from django.conf import settings

API_BASE = 'https://api.cloudflare.com/client/v4'
REQUEST_TIMEOUT = 10


def is_configured() -> bool:
    return bool(
        getattr(settings, 'CLOUDFLARE_STREAM_ACCOUNT_ID', '')
        and getattr(settings, 'CLOUDFLARE_STREAM_API_TOKEN', '')
    )


def _headers() -> dict:
    return {
        'Authorization': f'Bearer {settings.CLOUDFLARE_STREAM_API_TOKEN}',
        'Content-Type': 'application/json',
    }


def _playback_url(uid: str) -> str:
    customer_code = getattr(settings, 'CLOUDFLARE_STREAM_CUSTOMER_CODE', '')
    if not customer_code or not uid:
        return ''
    return f'https://customer-{customer_code}.cloudflarestream.com/{uid}/manifest/video.m3u8'


def create_live_input(title: str, recording: bool = True) -> dict | None:
    """Provision a real Cloudflare Stream live input. Returns None on any failure."""
    if not is_configured():
        return None
    url = f'{API_BASE}/accounts/{settings.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/live_inputs'
    body = {
        'meta': {'name': (title or 'Outverse live')[:100]},
        'recording': {
            'mode': 'automatic' if recording else 'off',
            'timeoutSeconds': 10,
        },
    }
    try:
        resp = requests.post(url, json=body, headers=_headers(), timeout=REQUEST_TIMEOUT)
        data = resp.json()
        if not resp.ok or not data.get('success'):
            print(f'Cloudflare Stream create_live_input failed: {resp.status_code} {data}')
            return None
        result = data['result']
        input_uid = result['uid']
        rtmps = result.get('rtmps') or {}
        webrtc = result.get('webRTC') or {}
        return {
            'provider_input_id': input_uid,
            'rtmp_url': rtmps.get('url', ''),
            'stream_key': rtmps.get('streamKey', ''),
            'webrtc_publish_url': webrtc.get('url', ''),
            'playback_url': _playback_url(input_uid),
        }
    except Exception as e:
        print(f'Cloudflare Stream create_live_input error: {e}')
        return None


def get_recording_url(provider_input_id: str) -> str:
    """Best-effort: fetch the latest recording video for a live input."""
    if not is_configured() or not provider_input_id:
        return ''
    url = (
        f'{API_BASE}/accounts/{settings.CLOUDFLARE_STREAM_ACCOUNT_ID}'
        f'/stream/live_inputs/{provider_input_id}/videos'
    )
    try:
        resp = requests.get(url, headers=_headers(), timeout=REQUEST_TIMEOUT)
        data = resp.json()
        if not resp.ok or not data.get('success'):
            return ''
        results = data.get('result') or []
        if not results:
            return ''
        # Prefer the most recently created video
        video = results[0]
        if isinstance(results, list) and len(results) > 1:
            try:
                video = sorted(
                    results,
                    key=lambda v: v.get('created') or v.get('modified') or '',
                    reverse=True,
                )[0]
            except Exception:
                video = results[0]
        uid = video.get('uid') or ''
        return _playback_url(uid)
    except Exception as e:
        print(f'Cloudflare Stream get_recording_url error: {e}')
        return ''


def delete_live_input(provider_input_id: str) -> bool:
    """Tear down a live input on stream end. Best-effort — failures are non-fatal."""
    if not is_configured() or not provider_input_id:
        return False
    url = f'{API_BASE}/accounts/{settings.CLOUDFLARE_STREAM_ACCOUNT_ID}/stream/live_inputs/{provider_input_id}'
    try:
        resp = requests.delete(url, headers=_headers(), timeout=REQUEST_TIMEOUT)
        return resp.ok
    except Exception as e:
        print(f'Cloudflare Stream delete_live_input error: {e}')
        return False
