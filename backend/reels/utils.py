import re

from django.db.models.functions import Lower

from notifications.utils import create_notification
from users.models import User
from users.privacy import can_mention

MENTION_RE = re.compile(r'@(\w+)')


def notify_mentions(text, actor, reel, verb_text):
    """Parses @username tokens out of `text` and notifies each matching user
    whose mention_policy permits being mentioned by `actor`."""
    if not text:
        return
    usernames = {m.lower() for m in MENTION_RE.findall(text)}
    if not usernames:
        return
    mentioned = User.objects.annotate(lower_username=Lower('username')).filter(
        lower_username__in=usernames
    )
    for user in mentioned:
        if not can_mention(actor, user):
            continue
        create_notification(
            recipient_id=user.id,
            actor_id=actor.id,
            verb='mention',
            reel=reel,
            text=verb_text,
        )
