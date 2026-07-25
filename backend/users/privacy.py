"""Interaction policies from UserPreferences."""

from __future__ import annotations

from users.models import Follow
from users.social import is_blocked_between


def _prefs(user):
    from preferences.models import UserPreferences
    prefs, _ = UserPreferences.objects.get_or_create(user=user)
    return prefs


def can_dm(sender, recipient) -> bool:
    if not sender or not recipient or sender.id == recipient.id:
        return False
    if is_blocked_between(sender.id, recipient.id):
        return False
    policy = _prefs(recipient).dm_policy
    if policy == 'none':
        return False
    if policy == 'everyone':
        return True
    if policy == 'followers':
        return Follow.objects.filter(
            follower_id=recipient.id, following_id=sender.id
        ).exists()
    if policy == 'following':
        return Follow.objects.filter(
            follower_id=sender.id, following_id=recipient.id
        ).exists()
    return True


def _check_interaction_policy(actor, target, policy: str) -> bool:
    if policy == 'none':
        return False
    if policy == 'everyone':
        return True
    if policy == 'followers':
        return Follow.objects.filter(follower_id=target.id, following_id=actor.id).exists()
    if policy == 'following':
        return Follow.objects.filter(follower_id=actor.id, following_id=target.id).exists()
    return True


def can_mention(actor, mentioned_user) -> bool:
    """Free-text @username mentions (post/reel captions, comments)."""
    if not actor or not mentioned_user:
        return False
    if actor.id == mentioned_user.id:
        return True
    if is_blocked_between(actor.id, mentioned_user.id):
        return False
    return _check_interaction_policy(actor, mentioned_user, _prefs(mentioned_user).mention_policy)


def can_tag(actor, tagged_user) -> bool:
    """Explicit tags — e.g. the story mention sticker where a user is
    picked from search rather than typed as free text."""
    if not actor or not tagged_user:
        return False
    if actor.id == tagged_user.id:
        return True
    if is_blocked_between(actor.id, tagged_user.id):
        return False
    return _check_interaction_policy(actor, tagged_user, _prefs(tagged_user).tag_policy)


def can_comment(viewer, post_author) -> bool:
    if not viewer or not post_author:
        return False
    if viewer.id == post_author.id:
        return True
    if is_blocked_between(viewer.id, post_author.id):
        return False
    policy = _prefs(post_author).comment_policy
    if policy == 'none':
        return False
    if policy == 'everyone':
        return True
    if policy == 'followers':
        return Follow.objects.filter(
            follower_id=post_author.id, following_id=viewer.id
        ).exists()
    if policy == 'following':
        return Follow.objects.filter(
            follower_id=viewer.id, following_id=post_author.id
        ).exists()
    return True


def text_has_hidden_word(text: str, hidden_words: list) -> bool:
    if not text or not hidden_words:
        return False
    lowered = text.lower()
    for word in hidden_words:
        w = (word or '').strip().lower()
        if w and w in lowered:
            return True
    return False
