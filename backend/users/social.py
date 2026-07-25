"""Block, mute, restrict helpers for feeds and interactions."""

from __future__ import annotations

from users.models import UserBlock, UserMute, UserRestrict


def blocked_user_ids(viewer_id: int | None) -> set[int]:
    if not viewer_id:
        return set()
    blocked_by_me = set(
        UserBlock.objects.filter(blocker_id=viewer_id).values_list('blocked_id', flat=True)
    )
    blocked_me = set(
        UserBlock.objects.filter(blocked_id=viewer_id).values_list('blocker_id', flat=True)
    )
    return blocked_by_me | blocked_me


def muted_user_ids(viewer_id: int | None) -> set[int]:
    if not viewer_id:
        return set()
    return set(
        UserMute.objects.filter(muter_id=viewer_id).values_list('muted_id', flat=True)
    )


def feed_hidden_author_ids(viewer_id: int | None) -> set[int]:
    """Authors hidden from the viewer's feeds (block both ways + mute)."""
    return blocked_user_ids(viewer_id) | muted_user_ids(viewer_id)


def restricted_user_ids(viewer_id: int | None) -> set[int]:
    if not viewer_id:
        return set()
    return set(
        UserRestrict.objects.filter(restricter_id=viewer_id).values_list('restricted_id', flat=True)
    )


def is_blocked_between(user_a_id: int, user_b_id: int) -> bool:
    if user_a_id == user_b_id:
        return False
    return UserBlock.objects.filter(
        blocker_id=user_a_id, blocked_id=user_b_id
    ).exists() or UserBlock.objects.filter(
        blocker_id=user_b_id, blocked_id=user_a_id
    ).exists()


def social_status_for(viewer_id: int | None, target_id: int) -> dict:
    if not viewer_id or viewer_id == target_id:
        return {
            'is_blocked': False,
            'is_muted': False,
            'is_restricted': False,
            'blocked_by_them': False,
        }
    return {
        'is_blocked': UserBlock.objects.filter(
            blocker_id=viewer_id, blocked_id=target_id
        ).exists(),
        'is_muted': UserMute.objects.filter(
            muter_id=viewer_id, muted_id=target_id
        ).exists(),
        'is_restricted': UserRestrict.objects.filter(
            restricter_id=viewer_id, restricted_id=target_id
        ).exists(),
        'blocked_by_them': UserBlock.objects.filter(
            blocker_id=target_id, blocked_id=viewer_id
        ).exists(),
    }


def apply_block_side_effects(blocker_id: int, blocked_id: int) -> None:
    """Remove follow edges in both directions when blocking."""
    from users.models import Follow

    Follow.objects.filter(
        follower_id=blocker_id, following_id=blocked_id
    ).delete()
    Follow.objects.filter(
        follower_id=blocked_id, following_id=blocker_id
    ).delete()
