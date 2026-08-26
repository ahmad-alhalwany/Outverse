"""AI or fallback cover generation for Story Forge."""

from __future__ import annotations

import base64
import os
import urllib.parse
from typing import Optional

import requests


def build_cover_prompt(title: str, premise: str, genre: str, custom: str = '') -> str:
    bits = [
        'Book cover illustration, cinematic, atmospheric, no text overlay,',
        f'genre {genre or "fiction"},',
        f'title mood for "{title}",',
    ]
    if premise:
        bits.append(premise[:180])
    if custom:
        bits.append(custom[:200])
    return ' '.join(bits)


def generate_openai_cover(prompt: str) -> Optional[str]:
    """Return a data URL or remote URL for a generated cover, or None."""
    key = os.environ.get('OPENAI_API_KEY') or ''
    if not key.strip():
        return None
    try:
        resp = requests.post(
            'https://api.openai.com/v1/images/generations',
            headers={
                'Authorization': f'Bearer {key}',
                'Content-Type': 'application/json',
            },
            json={
                'model': os.environ.get('OPENAI_IMAGE_MODEL', 'dall-e-3'),
                'prompt': prompt[:1000],
                'size': '1024x1024',
                'n': 1,
                'response_format': 'url',
            },
            timeout=90,
        )
        if resp.status_code >= 400:
            return None
        data = resp.json()
        items = data.get('data') or []
        if not items:
            return None
        url = items[0].get('url')
        b64 = items[0].get('b64_json')
        if url:
            return url
        if b64:
            return f'data:image/png;base64,{b64}'
    except Exception:
        return None
    return None


def decorative_cover_data_url(title: str, genre: str) -> str:
    """Local SVG gradient cover when no AI key is available."""
    safe_title = (title or 'Untitled')[:48].replace('&', '&amp;').replace('<', '')
    safe_genre = (genre or 'story').title()
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1040"/>
      <stop offset="55%" stop-color="#3b1d7a"/>
      <stop offset="100%" stop-color="#0ea5e9"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <circle cx="780" cy="220" r="120" fill="#ffffff18"/>
  <circle cx="200" cy="760" r="180" fill="#22d3ee22"/>
  <text x="72" y="820" fill="#f5f3ff" font-family="Georgia, serif" font-size="52">{safe_title}</text>
  <text x="72" y="880" fill="#c4b5fd" font-family="sans-serif" font-size="28">{safe_genre} · Cosonova Forge</text>
</svg>'''
    encoded = base64.b64encode(svg.encode('utf-8')).decode('ascii')
    return f'data:image/svg+xml;base64,{encoded}'


def resolve_cover_url(title: str, premise: str, genre: str, custom_prompt: str = '') -> tuple[str, str]:
    """Returns (cover_url, source) where source is 'openai' or 'decorative'."""
    prompt = build_cover_prompt(title, premise, genre, custom_prompt)
    ai = generate_openai_cover(prompt)
    if ai:
        return ai, 'openai'
    return decorative_cover_data_url(title, genre), 'decorative'
