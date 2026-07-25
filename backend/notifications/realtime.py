"""Push live events to connected WebSocket clients."""

from __future__ import annotations


def _group_send(group: str, event_type: str, payload: dict) -> None:
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        if not layer:
            return
        async_to_sync(layer.group_send)(
            group,
            {'type': event_type, 'payload': payload},
        )
    except Exception:
        return


def push_notification(recipient_id: int, payload: dict) -> None:
    """Deliver a notification to the user's dedicated notifications socket."""
    body = {'type': 'notification.new', **payload}
    _group_send(
        f'notifications_{recipient_id}',
        'relay.notification.event',
        body,
    )
    # Legacy path for clients still on the signal socket.
    _group_send(
        f'user_{recipient_id}',
        'relay.signal.event',
        body,
    )


def push_post_comment(post_id: int, payload: dict) -> None:
    """Broadcast a new/updated comment to viewers of a post thread."""
    _group_send(
        f'post_comments_{post_id}',
        'relay.comment.event',
        {'type': 'comment.update', 'post_id': post_id, **payload},
    )


def push_reel_comment(reel_id: int, payload: dict) -> None:
    """Broadcast a new/updated comment to viewers of a reel thread."""
    _group_send(
        f'reel_comments_{reel_id}',
        'relay.comment.event',
        {'type': 'comment.update', 'reel_id': reel_id, **payload},
    )


def push_live_event(session_id: int, payload: dict) -> None:
    """Broadcast chat/viewer/status events to a live session room."""
    _group_send(
        f'live_session_{session_id}',
        'relay.live.event',
        {'session_id': session_id, **payload},
    )
