"""Writing Buddy for Story Forge — continue, rewrite, outline, character, critique, inspire."""

from __future__ import annotations

import json
from typing import Any

from questions.llm import llm_text


def _story_context(story) -> str:
    outline = story.outline if isinstance(story.outline, list) else []
    characters = story.characters if isinstance(story.characters, list) else []
    recent = list(
        story.segments.filter(status='approved')
        .order_by('-order')[:4]
        .values_list('content', flat=True)
    )
    recent.reverse()
    bits = [
        f'Title: {story.title}',
        f'Genre: {story.genre}',
        f'Premise: {story.premise}',
        f'Tone: {story.tone or "unspecified"}',
        f'POV: {story.pov or "unspecified"}',
        f'Rules: {story.content_rules or "none"}',
        f'World notes: {(story.world_notes or "")[:800]}',
        f'Outline JSON: {json.dumps(outline)[:1200]}',
        f'Characters JSON: {json.dumps(characters)[:1200]}',
        'Recent approved parts:\n' + ('\n---\n'.join(recent) if recent else '(none yet)'),
    ]
    return '\n'.join(bits)


SYSTEM = (
    'You are Writing Buddy inside Cosmory Story Forge — a world-class fiction studio. '
    'Write with cinematic specificity: one unforgettable image per paragraph, '
    'emotional stakes that feel intimate and mythic at once. '
    'Respect the story bible (tone, POV, rules, cast). '
    'Never lecture. Never use generic fantasy filler. Prefer strange beauty over cliché.'
)


def _fallback_continue(story) -> str:
    cast = ''
    if isinstance(story.characters, list) and story.characters:
        name = story.characters[0].get('name') if isinstance(story.characters[0], dict) else None
        if name:
            cast = f' {name} notices something the world forgot to hide.'
    return (
        f'The next breath of "{story.title}" leans into the premise: '
        f'{(story.premise or "")[:120]}{cast} '
        f'Write what changes when the ordinary rule of this world quietly breaks.'
    )


def _fallback_rewrite(draft: str, style: str) -> str:
    draft = (draft or '').strip()
    if not draft:
        return 'Add a draft first, then ask Buddy to sharpen it.'
    if style == 'quieter':
        return draft.replace('!', '.').strip()
    if style == 'clearer':
        return ' '.join(draft.split())
    return draft + ' The detail that matters is the one nobody named aloud.'


def _fallback_outline(story) -> list[dict[str, Any]]:
    return [
        {'act': 1, 'title': 'Spark', 'beats': [story.premise or 'An impossible ordinary day']},
        {'act': 2, 'title': 'Drift', 'beats': ['A rule of the world bends', 'A character pays a cost']},
        {'act': 3, 'title': 'Constellation', 'beats': ['Truth surfaces', 'A lasting change']},
    ]


def _fallback_character(story) -> dict[str, Any]:
    return {
        'name': 'The Quiet Cartographer',
        'role': 'foil',
        'traits': ['observant', 'stubborn kindness'],
        'voice': 'Short sentences, maps metaphors',
        'notes': f'Fits the tone of {(story.tone or story.genre or "the story")}.',
    }


def _fallback_critique(story, draft: str) -> str:
    return (
        f'• Keep the {story.tone or "chosen"} tone consistent.\n'
        '• Name one concrete sensory detail in the next paragraph.\n'
        '• Clarify what the protagonist wants in this beat — and what it costs.'
    )


def _fallback_inspire(mode: str, story) -> str:
    title = story.title or 'this world'
    if mode == 'twist':
        return (
            f'In "{title}", the thing everyone trusted was lying politely. '
            'Reveal the lie through a tiny domestic gesture — a key that fits two doors.'
        )
    if mode == 'sensory':
        return (
            'Describe the room through smell and temperature first. '
            'Let light arrive late. Make one sound feel like a memory.'
        )
    if mode == 'dialogue':
        return (
            'Write 6–10 lines of dialogue where nobody says what they mean. '
            'One character repeats a word until it becomes a weapon.'
        )
    # spark
    return (
        f'What if "{title}" is not a place but a promise someone is already breaking? '
        'Open with an image so beautiful it hurts, then show the price of looking at it.'
    )


def buddy_continue(story) -> dict[str, Any]:
    prompt = (
        'Write the NEXT story segment (160-280 words) as finished prose. '
        'Make it feel inevitable and surprising. End on a charged image or choice. '
        'No title, no preamble, no markdown fences.\n\n'
        f'{_story_context(story)}'
    )
    text = llm_text(SYSTEM, prompt, max_tokens=520, temperature=0.9)
    return {'text': (text or _fallback_continue(story)).strip(), 'source': 'llm' if text else 'fallback'}


def buddy_rewrite(story, draft: str, style: str = 'stronger') -> dict[str, Any]:
    style = style if style in ('stronger', 'quieter', 'clearer', 'lyrical') else 'stronger'
    prompt = (
        f'Rewrite the draft in a {style} literary voice while preserving meaning and bible constraints. '
        'Heighten imagery and emotional precision. Return prose only.\n\n'
        f'{_story_context(story)}\n\nDRAFT:\n{draft[:3500]}'
    )
    text = llm_text(SYSTEM, prompt, max_tokens=520, temperature=0.75)
    return {
        'text': (text or _fallback_rewrite(draft, style)).strip(),
        'style': style,
        'source': 'llm' if text else 'fallback',
    }


def buddy_outline(story) -> dict[str, Any]:
    prompt = (
        'Produce a vivid 3-act outline as JSON array like '
        '[{"act":1,"title":"...","beats":["...","...","..."]}]. '
        'Each beat should be a concrete scene image, not abstract advice. '
        'No markdown fences.\n\n'
        f'{_story_context(story)}'
    )
    text = llm_text(SYSTEM, prompt, max_tokens=560, temperature=0.65)
    outline = None
    if text:
        try:
            cleaned = text.strip().strip('`')
            if cleaned.startswith('json'):
                cleaned = cleaned[4:].strip()
            outline = json.loads(cleaned)
        except Exception:
            outline = None
    if not isinstance(outline, list):
        outline = _fallback_outline(story)
    return {'outline': outline, 'source': 'llm' if text and outline else 'fallback'}


def buddy_character(story) -> dict[str, Any]:
    prompt = (
        'Propose ONE unforgettable new character as JSON object with keys '
        'name, role, traits (array of 3 vivid traits), voice, notes. '
        'Make them specific enough to steal a scene. No markdown.\n\n'
        f'{_story_context(story)}'
    )
    text = llm_text(SYSTEM, prompt, max_tokens=320, temperature=0.8)
    character = None
    if text:
        try:
            cleaned = text.strip().strip('`')
            if cleaned.startswith('json'):
                cleaned = cleaned[4:].strip()
            character = json.loads(cleaned)
        except Exception:
            character = None
    if not isinstance(character, dict):
        character = _fallback_character(story)
    return {'character': character, 'source': 'llm' if text and character else 'fallback'}


def buddy_critique(story, draft: str = '') -> dict[str, Any]:
    prompt = (
        'Give 4 sharp editorial notes as short bullets. '
        'Focus on stakes, imagery, pacing, and character desire. '
        'No full rewrite.\n\n'
        f'{_story_context(story)}\n\nDRAFT (optional):\n{(draft or "")[:2800]}'
    )
    text = llm_text(SYSTEM, prompt, max_tokens=280, temperature=0.55)
    return {
        'text': (text or _fallback_critique(story, draft)).strip(),
        'source': 'llm' if text else 'fallback',
    }


def buddy_inspire(story, mode: str = 'spark', draft: str = '') -> dict[str, Any]:
    mode = mode if mode in ('spark', 'twist', 'sensory', 'dialogue') else 'spark'
    briefs = {
        'spark': (
            'Invent one WORLD-BREAKING creative spark for this story: '
            'a premise mutation, visual motif, or emotional engine so beautiful and strange '
            'it could redefine the book. 120-180 words. Prose/idea hybrid OK. No bullet list required.'
        ),
        'twist': (
            'Propose one elegant plot twist that recontextualizes what we already know. '
            'Explain the twist and one quiet foreshadowing image (100-160 words).'
        ),
        'sensory': (
            'Write a sensory overlay paragraph (90-140 words) the author can drop into the scene: '
            'smell, temperature, light, texture — make the world feel touchable.'
        ),
        'dialogue': (
            'Write a short dialogue exchange (8-14 lines) that reveals desire and danger '
            'without exposition. Character names from bible if available.'
        ),
    }
    prompt = (
        f'{briefs[mode]}\n\n{_story_context(story)}\n\nCURRENT DRAFT (optional):\n{(draft or "")[:2200]}'
    )
    text = llm_text(SYSTEM, prompt, max_tokens=420, temperature=0.92)
    return {
        'text': (text or _fallback_inspire(mode, story)).strip(),
        'mode': mode,
        'source': 'llm' if text else 'fallback',
    }
