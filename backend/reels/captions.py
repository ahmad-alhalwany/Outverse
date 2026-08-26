"""Timed captions for Pulse signals — Whisper when available, smart fallback otherwise."""

from __future__ import annotations

import json
import os
import re
from typing import Any


def _chunk_text(text: str, duration: float) -> list[dict[str, Any]]:
    """Split caption/script into timed cue cards across the reel duration."""
    cleaned = re.sub(r'\s+', ' ', (text or '').strip())
    if not cleaned:
        return []
    # Prefer sentence-ish splits, then words
    parts = [p.strip() for p in re.split(r'(?<=[.!?،。])\s+', cleaned) if p.strip()]
    if len(parts) <= 1:
        words = cleaned.split(' ')
        size = max(4, min(8, max(1, len(words) // 4)))
        parts = [' '.join(words[i:i + size]) for i in range(0, len(words), size)]
    parts = [p for p in parts if p][:24]
    if not parts:
        return []
    total = max(duration or 8.0, len(parts) * 1.4)
    slot = total / len(parts)
    cues = []
    for i, part in enumerate(parts):
        start = round(i * slot, 2)
        end = round(min(total, (i + 1) * slot), 2)
        if end <= start:
            end = start + 1.0
        cues.append({'start': start, 'end': end, 'text': part[:120]})
    return cues


def _whisper_transcribe(video_path: str, language: str = 'en') -> list[dict[str, Any]] | None:
    """Optional OpenAI Whisper transcription when OPENAI_API_KEY is set."""
    key = os.environ.get('OPENAI_API_KEY') or ''
    if not key or not video_path or not os.path.isfile(video_path):
        return None
    try:
        import urllib.request

        boundary = '----OutverseBoundary'
        with open(video_path, 'rb') as fh:
            raw = fh.read()
        body = (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="model"\r\n\r\n'
            f'whisper-1\r\n'
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="response_format"\r\n\r\n'
            f'verbose_json\r\n'
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="language"\r\n\r\n'
            f'{language[:2]}\r\n'
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="file"; filename="reel.mp4"\r\n'
            f'Content-Type: video/mp4\r\n\r\n'
        ).encode('utf-8') + raw + f'\r\n--{boundary}--\r\n'.encode('utf-8')
        req = urllib.request.Request(
            'https://api.openai.com/v1/audio/transcriptions',
            data=body,
            headers={
                'Authorization': f'Bearer {key}',
                'Content-Type': f'multipart/form-data; boundary={boundary}',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=90) as resp:
            payload = json.loads(resp.read().decode('utf-8'))
        segments = payload.get('segments') or []
        cues = []
        for seg in segments:
            text = (seg.get('text') or '').strip()
            if not text:
                continue
            cues.append({
                'start': round(float(seg.get('start') or 0), 2),
                'end': round(float(seg.get('end') or 0), 2),
                'text': text[:160],
            })
        return cues or None
    except Exception:
        return None


def generate_captions_for_reel(reel, *, language: str | None = None, force: bool = False) -> dict[str, Any]:
    """Populate reel.captions. Prefers Whisper; falls back to timed caption text."""
    lang = (language or reel.captions_language or 'en')[:8] or 'en'
    if reel.captions_status == 'ready' and reel.captions and not force:
        return {
            'status': 'ready',
            'captions': reel.captions,
            'language': reel.captions_language,
            'source': 'cached',
        }

    reel.captions_status = 'pending'
    reel.captions_language = lang
    reel.save(update_fields=['captions_status', 'captions_language'])

    cues = None
    source = 'fallback'
    try:
        path = reel.video.path if reel.video else ''
    except Exception:
        path = ''
    if path:
        cues = _whisper_transcribe(path, language=lang[:2])
        if cues:
            source = 'whisper'

    if not cues:
        duration = float(reel.duration_seconds or 12)
        seed = (reel.caption or '').strip()
        if not seed:
            seed = reel.sound_label or 'Signal pulse'
            if lang.startswith('ar'):
                seed = 'نبض إشارة Cosonova'
            else:
                seed = 'Cosonova signal pulse'
        cues = _chunk_text(seed, duration)
        source = 'caption_timing'

    if not cues:
        reel.captions = []
        reel.captions_status = 'failed'
        reel.save(update_fields=['captions', 'captions_status'])
        return {'status': 'failed', 'captions': [], 'language': lang, 'source': source}

    reel.captions = cues
    reel.captions_status = 'ready'
    reel.captions_language = lang
    reel.save(update_fields=['captions', 'captions_status', 'captions_language'])
    return {'status': 'ready', 'captions': cues, 'language': lang, 'source': source}
