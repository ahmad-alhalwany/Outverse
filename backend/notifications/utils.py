from .models import Notification


def create_notification(
    recipient_id,
    actor_id,
    verb,
    post=None,
    reel=None,
    text='',
    notification_type='',
):
    """Create a notification, skipping self-directed actions."""
    if not recipient_id:
        return None
    if actor_id and str(recipient_id) == str(actor_id):
        return None
    return Notification.objects.create(
        recipient_id=recipient_id,
        actor_id=actor_id,
        verb=verb,
        type=notification_type or verb,
        post=post,
        reel=reel,
        text=text or '',
    )
