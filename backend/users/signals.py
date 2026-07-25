"""
Achievement signal hooks.

Connects post_save / custom signals to check_and_grant_achievement so that
achievements are evaluated automatically without polluting individual view code.

Connected in UsersConfig.ready() via users/apps.py.
"""
from __future__ import annotations

from django.db.models.signals import post_save
from django.dispatch import receiver


# ── Posts ─────────────────────────────────────────────────────────────────────

def _hook_posts():
    try:
        from posts.models import Post
    except Exception:
        return

    @receiver(post_save, sender=Post, weak=False, dispatch_uid='ach_post_create')
    def on_post_created(sender, instance, created, **kwargs):
        if not created:
            return
        try:
            from users.achievements import check_and_grant_achievement
            check_and_grant_achievement(instance.user, 'post_create')
        except Exception:
            pass


# ── Ideas ─────────────────────────────────────────────────────────────────────

def _hook_ideas():
    try:
        from ideas.models import Idea
    except Exception:
        return

    @receiver(post_save, sender=Idea, weak=False, dispatch_uid='ach_idea_create')
    def on_idea_created(sender, instance, created, **kwargs):
        if not created:
            return
        try:
            from users.achievements import check_and_grant_achievement
            check_and_grant_achievement(instance.owner, 'idea_create')
        except Exception:
            pass


# ── Community membership ───────────────────────────────────────────────────────

def _hook_communities():
    try:
        from communities.models import CommunityMembership
    except Exception:
        return

    @receiver(post_save, sender=CommunityMembership, weak=False, dispatch_uid='ach_community_join')
    def on_membership_created(sender, instance, created, **kwargs):
        if not created:
            return
        try:
            from users.achievements import check_and_grant_achievement
            check_and_grant_achievement(instance.user, 'community_join')
        except Exception:
            pass


# ── Capsules ──────────────────────────────────────────────────────────────────

def _hook_capsules():
    try:
        from capsules.models import TimeCapsule
    except Exception:
        return

    @receiver(post_save, sender=TimeCapsule, weak=False, dispatch_uid='ach_capsule_open')
    def on_capsule_saved(sender, instance, created, **kwargs):
        if created:
            return
        # opened_at transitioning from None → set means it was just opened
        if instance.opened_at is not None:
            try:
                from users.achievements import check_and_grant_achievement
                check_and_grant_achievement(instance.user, 'capsule_open')
            except Exception:
                pass


# ── Live sessions ─────────────────────────────────────────────────────────────

def _hook_live():
    try:
        from reels.models import LiveSession
    except Exception:
        return

    @receiver(post_save, sender=LiveSession, weak=False, dispatch_uid='ach_live_end')
    def on_live_session_saved(sender, instance, created, **kwargs):
        if created:
            return
        if instance.status == 'ended':
            try:
                from users.achievements import check_and_grant_achievement
                check_and_grant_achievement(instance.user, 'live_end')
            except Exception:
                pass


def connect_all():
    """Connect all achievement signal hooks. Called from UsersConfig.ready()."""
    _hook_posts()
    _hook_ideas()
    _hook_communities()
    _hook_capsules()
    _hook_live()
