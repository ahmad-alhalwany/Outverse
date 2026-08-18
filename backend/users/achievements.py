"""
Achievement engine for Outverse.

Call ``check_and_grant_achievement(user, event_type)`` whenever a key user
action occurs (post created, community joined, idea created, capsule opened,
live session ended, etc.).

Each achievement is defined as a dict with:
  title      — human-readable achievement name (must match web expectations)
  key        — unique internal key
  event_type — which event increments this achievement's progress counter
  goal       — progress target to unlock the achievement
  category   — grouping label (e.g. "content", "community", "live")
  description — short description shown in the UI

Achievements are stored as a JSON list on Profile.achievements.  Each item:
  {
    "title": ...,
    "key": ...,
    "goal": ...,
    "progress": ...,
    "completed": true/false,
    "category": ...,
    "description": ...,
  }
"""
from __future__ import annotations

from django.db import transaction

from notifications.utils import create_notification

ACHIEVEMENT_DEFINITIONS = [
    {
        'title': 'First Post',
        'key': 'first_post',
        'event_type': 'post_create',
        'goal': 1,
        'category': 'content',
        'description': 'Publish your first post.',
    },
    {
        'title': 'Storyteller',
        'key': 'post_10',
        'event_type': 'post_create',
        'goal': 10,
        'category': 'content',
        'description': 'Publish 10 posts.',
    },
    {
        'title': 'Prolific Writer',
        'key': 'post_50',
        'event_type': 'post_create',
        'goal': 50,
        'category': 'content',
        'description': 'Publish 50 posts.',
    },
    {
        'title': 'Community Builder',
        'key': 'community_join_1',
        'event_type': 'community_join',
        'goal': 1,
        'category': 'community',
        'description': 'Join your first community.',
    },
    {
        'title': 'Social Butterfly',
        'key': 'community_join_5',
        'event_type': 'community_join',
        'goal': 5,
        'category': 'community',
        'description': 'Join 5 communities.',
    },
    {
        'title': 'Idea Launcher',
        'key': 'idea_create_1',
        'event_type': 'idea_create',
        'goal': 1,
        'category': 'bazaar',
        'description': 'Launch your first idea in the Bazaar.',
    },
    {
        'title': 'Visionary',
        'key': 'idea_create_5',
        'event_type': 'idea_create',
        'goal': 5,
        'category': 'bazaar',
        'description': 'Launch 5 ideas in the Bazaar.',
    },
    {
        'title': 'Time Traveller',
        'key': 'capsule_open_1',
        'event_type': 'capsule_open',
        'goal': 1,
        'category': 'vault',
        'description': 'Open your first time capsule.',
    },
    {
        'title': 'Broadcaster',
        'key': 'live_end_1',
        'event_type': 'live_end',
        'goal': 1,
        'category': 'live',
        'description': 'Host your first live session.',
    },
    {
        'title': 'Live Star',
        'key': 'live_end_5',
        'event_type': 'live_end',
        'goal': 5,
        'category': 'live',
        'description': 'Host 5 live sessions.',
    },
]

# Build lookup: event_type → list of matching achievement defs
_BY_EVENT: dict[str, list[dict]] = {}
for _defn in ACHIEVEMENT_DEFINITIONS:
    _BY_EVENT.setdefault(_defn['event_type'], []).append(_defn)


def full_achievements_for_profile(stored: list[dict] | None) -> list[dict]:
    """Merge a profile's earned/in-progress achievements with the full
    roster of definitions, so locked-but-not-yet-started ones still show
    up (progress 0/goal) instead of being invisible until first touched.
    """
    by_key = {a.get('key'): a for a in (stored or []) if a.get('key')}
    merged: list[dict] = []
    for defn in ACHIEVEMENT_DEFINITIONS:
        key = defn['key']
        entry = by_key.get(key)
        if entry:
            entry = dict(entry)
            entry.setdefault('category', defn['category'])
            entry.setdefault('description', defn['description'])
        else:
            entry = {
                'title': defn['title'],
                'key': key,
                'goal': defn['goal'],
                'progress': 0,
                'completed': False,
                'category': defn['category'],
                'description': defn['description'],
            }
        merged.append(entry)
    return merged


def check_and_grant_achievement(user, event_type: str) -> list[str]:
    """
    Increment progress for all achievements tied to *event_type* and unlock
    any that have reached their goal.

    Returns a list of newly unlocked achievement titles (may be empty).
    Thread-safe via select_for_update on the Profile row.
    """
    from .models import Profile  # local import to avoid circular

    relevant = _BY_EVENT.get(event_type)
    if not relevant:
        return []

    newly_unlocked: list[str] = []

    with transaction.atomic():
        profile, _ = Profile.objects.select_for_update().get_or_create(user=user)
        achievements: list[dict] = list(profile.achievements or [])

        # Index existing achievements by key for fast lookup
        existing: dict[str, dict] = {a['key']: a for a in achievements}

        for defn in relevant:
            key = defn['key']
            if key in existing:
                entry = existing[key]
            else:
                entry = {
                    'title': defn['title'],
                    'key': key,
                    'goal': defn['goal'],
                    'progress': 0,
                    'completed': False,
                    'category': defn['category'],
                    'description': defn['description'],
                }
                achievements.append(entry)
                existing[key] = entry

            if entry.get('completed'):
                continue

            entry['progress'] = entry.get('progress', 0) + 1

            if entry['progress'] >= entry['goal']:
                entry['completed'] = True
                newly_unlocked.append(entry['title'])

        profile.achievements = achievements
        profile.save(update_fields=['achievements'])

    for title in newly_unlocked:
        try:
            create_notification(
                recipient_id=user.id,
                actor_id=None,
                verb='achievement_unlocked',
                notification_type='achievement',
                text=f'You unlocked the "{title}" achievement! 🏆',
            )
        except Exception:
            pass

    return newly_unlocked
