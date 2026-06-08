from .models import Notification


def create_notification(recipient_id, actor_id, verb, post=None, reel=None, text=''):
    """Create a notification, skipping self-directed actions."""
    if not recipient_id or not actor_id:
        return None
    if str(recipient_id) == str(actor_id):
        return None
    return Notification.objects.create(
        recipient_id=recipient_id,
        actor_id=actor_id,
        verb=verb,
        post=post,
        reel=reel,
        text=text or '',
    )
