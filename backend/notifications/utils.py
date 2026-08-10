from .models import Notification


VERB_PREF_MAP = {
    'reaction': 'likes',
    'comment': 'comments',
    'follow': 'follows',
    'mention': 'comments',
    'share': 'likes',
    'chat_message': 'comments',
    'achievement_unlocked': 'likes',
    'challenge_complete': 'likes',
    'shop_purchase': 'shop',
    'moderation_action': 'likes',
    'idea_pledge': 'likes',
    'idea_comment': 'comments',
    'idea_apply': 'comments',
    'idea_accepted': 'comments',
    'idea_rejected': 'comments',
    'forge_invite': 'comments',
    'forge_pending': 'comments',
    'forge_approved': 'comments',
    'forge_rejected': 'comments',
}


def _prefs_allow(recipient_id, verb):
    try:
        from preferences.models import UserPreferences
        prefs = UserPreferences.objects.filter(user_id=recipient_id).first()
        if not prefs or not prefs.notification_prefs:
            return True
        key = VERB_PREF_MAP.get(verb, 'likes')
        return prefs.notification_prefs.get(key, True) is not False
    except Exception:
        return True


def create_notification(
    recipient_id,
    actor_id,
    verb,
    post=None,
    reel=None,
    story=None,
    idea=None,
    studio_session=None,
    text='',
    notification_type='',
):
    """Create a notification, skipping self-directed actions."""
    if not recipient_id:
        return None
    if actor_id and str(recipient_id) == str(actor_id):
        return None
    if not _prefs_allow(recipient_id, verb):
        return None
    note = Notification.objects.create(
        recipient_id=recipient_id,
        actor_id=actor_id,
        verb=verb,
        type=notification_type or verb,
        post=post,
        reel=reel,
        story=story,
        idea=idea,
        studio_session=studio_session,
        text=text or '',
    )
    actor_payload = None
    if actor_id:
        try:
            from users.models import User
            actor = User.objects.filter(pk=actor_id).only(
                'id', 'username', 'first_name', 'last_name', 'avatar',
            ).first()
            if actor:
                actor_payload = {
                    'id': actor.id,
                    'username': actor.username,
                    'avatar': actor.avatar.url if actor.avatar else None,
                }
        except Exception:
            pass
    try:
        from .realtime import push_notification
        push_notification(recipient_id, {
            'id': note.id,
            'verb': note.verb,
            'type': note.type,
            'text': note.text,
            'post': note.post_id,
            'reel': note.reel_id,
            'story': note.story_id,
            'idea': note.idea_id,
            'studio_session': note.studio_session_id,
            'actor_id': actor_id,
            'actor': actor_payload,
            'is_read': False,
            'created_at': note.created_at.isoformat(),
        })
    except Exception:
        pass
    try:
        from .push import send_push_to_user
        send_push_to_user(recipient_id, {
            'verb': note.verb,
            'type': note.type,
            'text': note.text,
            'post': note.post_id,
            'reel': note.reel_id,
            'story': note.story_id,
            'idea': note.idea_id,
        })
    except Exception:
        pass
    return note
