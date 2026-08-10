"""Soft AI moderation helper — flag for staff, never crash create flows."""
from __future__ import annotations

import logging
import re

from django.conf import settings
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)

HIGH_RISK_CATEGORIES = frozenset({
    'sexual',
    'child_sexual_abuse',
    'hate',
    'hate_threatening',
    'violence',
    'violence_graphic',
})

# Bottles are anonymous public drops — block harsh language aggressively.
BOTTLE_BLOCK_CATEGORIES = HIGH_RISK_CATEGORIES | frozenset({
    'profanity',
    'harassment',
    'harassment_threatening',
    'threat',
    'self_harm',
    'self_harm_intent',
    'self_harm_instructions',
    'spam',
})

# Severe local lexicon (EN + AR). Kept short and high-signal to avoid false
# positives on ordinary emotional language.
_SEVERE_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r'\bf+u+c+k+(?:ing|er|ed)?\b',
        r'\bsh+i+t+\b',
        r'\bb+i+t+c+h+(?:es|y)?\b',
        r'\bass+h+o+l+e+s?\b',
        r'\bn+i+g+g+(?:er|a)s?\b',
        r'\bc+u+n+t+s?\b',
        r'\bslut+s?\b',
        r'\bwhore+s?\b',
        r'\bkill\s+yourself\b',
        r'\bkys\b',
        r'\bgo\s+die\b',
        r'كس ام',
        r'ابن ال[كل]',
        r'شرموط',
        r'عرص',
        r'زب\b',
        r'منيوك',
    )
]


def check_severe_language(text: str) -> bool:
    """Return True when text contains severe/abusive language."""
    if not text:
        return False
    sample = text.strip()
    if not sample:
        return False
    return any(pattern.search(sample) for pattern in _SEVERE_PATTERNS)

REPEATED_CHAR_RE = re.compile(r'(.)\1{4,}', re.IGNORECASE)
URL_RE = re.compile(r'https?://|www\.', re.IGNORECASE)

SPAM_PHRASE_PATTERNS = [
    re.compile(r'click\s+here', re.IGNORECASE),
    re.compile(r'free\s+money', re.IGNORECASE),
    re.compile(r'earn\s+\$?\d', re.IGNORECASE),
    re.compile(r'buy\s+now', re.IGNORECASE),
    re.compile(r'limited\s+time\s+offer', re.IGNORECASE),
    re.compile(r'crypto\s+giveaway', re.IGNORECASE),
    re.compile(r'whatsapp\s+me', re.IGNORECASE),
    re.compile(r't\.me/', re.IGNORECASE),
    re.compile(r'bit\.ly/', re.IGNORECASE),
]


def _spam_moderation_result(reason: str) -> dict:
    return {
        'flagged': True,
        'categories': {'spam': True},
        'category_scores': {'spam': 1.0},
        'model': 'spam_filter',
        'spam_reason': reason,
    }


def check_spam(text: str) -> dict | None:
    """Basic keyword/regex spam filter. Returns a moderation result or None."""
    if not text:
        return None
    if REPEATED_CHAR_RE.search(text):
        return _spam_moderation_result('repeated_chars')
    if len(URL_RE.findall(text)) >= 3:
        return _spam_moderation_result('url_flood')
    for pattern in SPAM_PHRASE_PATTERNS:
        if pattern.search(text):
            return _spam_moderation_result('spam_phrase')
    return None


def apply_hard_block(result: dict, *, content_type: str | None = None) -> dict:
    """Set hard_block on flagged results when policy requires blocking."""
    if not result.get('flagged') or result.get('error'):
        result['hard_block'] = False
        result['bottle_block'] = False
        return result
    categories = result.get('categories') or {}
    high_risk = any(categories.get(cat) for cat in HIGH_RISK_CATEGORIES)
    result['hard_block'] = bool(
        getattr(settings, 'AI_MODERATION_HARD_BLOCK', False) or high_risk
    )
    if content_type == 'bottle':
        bottle_hit = any(categories.get(cat) for cat in BOTTLE_BLOCK_CATEGORIES)
        result['bottle_block'] = bottle_hit
        if bottle_hit:
            result['hard_block'] = True
    else:
        result['bottle_block'] = False
    return result


def soft_moderate_content(
    *,
    text: str,
    content_type: str,
    object_id: int | None = None,
    user=None,
) -> dict:
    """Run spam + AI moderation and persist FlaggedContent. Never raises to callers."""
    text = (text or '').strip()
    if not text:
        return {'flagged': False, 'skipped': True}
    try:
        from moderation.ai_moderation import auto_moderate

        if content_type == 'bottle' and check_severe_language(text):
            severe = {
                'flagged': True,
                'categories': {'profanity': True},
                'category_scores': {'profanity': 1.0},
                'model': 'severe_lexicon',
            }
            result = auto_moderate(
                text=text,
                content_type=content_type,
                object_id=object_id,
                user=user,
                result=severe,
            )
            return apply_hard_block(result, content_type=content_type)

        spam_result = check_spam(text)
        if spam_result is not None:
            result = auto_moderate(
                text=text,
                content_type=content_type,
                object_id=object_id,
                user=user,
                result=spam_result,
            )
            return apply_hard_block(result, content_type=content_type)

        result = auto_moderate(
            text=text,
            content_type=content_type,
            object_id=object_id,
            user=user,
        )
        return apply_hard_block(result, content_type=content_type)
    except Exception as exc:  # noqa: BLE001
        logger.warning('soft_moderate_content failed: %s', exc)
        return {'flagged': False, 'error': str(exc)}


def enforce_moderation_result(
    result: dict,
    *,
    content_type: str,
    object_id: int | None,
) -> bool:
    """Hide moderated content after a hard block. Returns True if content was hidden."""
    if not result.get('hard_block') or object_id is None:
        return False

    try:
        if content_type == 'post':
            from posts.models import Post

            obj = Post.objects.filter(pk=object_id).first()
            if obj and hasattr(obj, 'is_active'):
                obj.is_active = False
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'reel':
            from reels.models import Reel

            obj = Reel.objects.filter(pk=object_id).first()
            if obj and hasattr(obj, 'is_active'):
                obj.is_active = False
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'story':
            from stories.models import Story

            obj = Story.objects.filter(pk=object_id).first()
            if obj and hasattr(obj, 'is_active'):
                obj.is_active = False
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'comment':
            from posts.models import Comment

            obj = Comment.objects.filter(pk=object_id).first()
            if obj is None:
                return False
            if hasattr(obj, 'is_deleted'):
                obj.is_deleted = True
                update_fields = ['is_deleted']
                if hasattr(obj, 'deleted_at'):
                    obj.deleted_at = timezone.now()
                    update_fields.append('deleted_at')
                obj.save(update_fields=update_fields)
                return True
            if hasattr(obj, 'is_active'):
                obj.is_active = False
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'reel_comment':
            from reels.models import ReelComment

            obj = ReelComment.objects.filter(pk=object_id).first()
            if obj is None:
                return False
            if hasattr(obj, 'is_deleted'):
                obj.is_deleted = True
                update_fields = ['is_deleted']
                if hasattr(obj, 'deleted_at'):
                    obj.deleted_at = timezone.now()
                    update_fields.append('deleted_at')
                obj.save(update_fields=update_fields)
                return True
            if hasattr(obj, 'is_active'):
                obj.is_active = False
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'bottle':
            from bottles.models import MessageBottle

            obj = MessageBottle.objects.filter(pk=object_id).first()
            if obj is None:
                return False
            # Vanish from the map immediately.
            obj.is_opened = True
            obj.expiry_time = timezone.now() - timedelta(seconds=1)
            obj.save(update_fields=['is_opened', 'expiry_time'])
            return True
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            'enforce_moderation_result failed for %s:%s — %s',
            content_type,
            object_id,
            exc,
        )
    return False


def restore_moderated_content(*, content_type: str, object_id: int) -> bool:
    """Restore hidden content after an appeal is approved."""
    try:
        if content_type == 'post':
            from posts.models import Post

            obj = Post.objects.filter(pk=object_id).first()
            if obj and hasattr(obj, 'is_active'):
                obj.is_active = True
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'reel':
            from reels.models import Reel

            obj = Reel.objects.filter(pk=object_id).first()
            if obj and hasattr(obj, 'is_active'):
                obj.is_active = True
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'story':
            from stories.models import Story

            obj = Story.objects.filter(pk=object_id).first()
            if obj and hasattr(obj, 'is_active'):
                obj.is_active = True
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'comment':
            from posts.models import Comment

            obj = Comment.objects.filter(pk=object_id).first()
            if obj is None:
                return False
            if hasattr(obj, 'is_deleted'):
                obj.is_deleted = False
                update_fields = ['is_deleted']
                if hasattr(obj, 'deleted_at'):
                    obj.deleted_at = None
                    update_fields.append('deleted_at')
                obj.save(update_fields=update_fields)
                return True
            if hasattr(obj, 'is_active'):
                obj.is_active = True
                obj.save(update_fields=['is_active'])
                return True
        elif content_type == 'reel_comment':
            from reels.models import ReelComment

            obj = ReelComment.objects.filter(pk=object_id).first()
            if obj is None:
                return False
            if hasattr(obj, 'is_deleted'):
                obj.is_deleted = False
                update_fields = ['is_deleted']
                if hasattr(obj, 'deleted_at'):
                    obj.deleted_at = None
                    update_fields.append('deleted_at')
                obj.save(update_fields=update_fields)
                return True
            if hasattr(obj, 'is_active'):
                obj.is_active = True
                obj.save(update_fields=['is_active'])
                return True
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            'restore_moderated_content failed for %s:%s — %s',
            content_type,
            object_id,
            exc,
        )
    return False
