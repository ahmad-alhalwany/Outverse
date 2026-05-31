import os

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def get_ice_servers():
    servers = [
        {'urls': 'stun:stun.l.google.com:19302'},
        {'urls': 'stun:stun1.l.google.com:19302'},
    ]
    turn_url = os.environ.get('TURN_URL', '').strip()
    if turn_url:
        entry = {'urls': turn_url}
        username = os.environ.get('TURN_USERNAME', '').strip()
        password = os.environ.get('TURN_PASSWORD', '').strip()
        if username:
            entry['username'] = username
            entry['credential'] = password
        servers.append(entry)
    return servers


def broadcast_chat_event(conversation_id, payload):
    layer = get_channel_layer()
    if not layer:
        return
    handler = (
        'relay.chat.typing'
        if payload.get('type') == 'chat.typing'
        else 'relay.chat.message'
    )
    async_to_sync(layer.group_send)(
        f'conv_{conversation_id}',
        {'type': handler, 'payload': payload},
    )


def broadcast_room_event(room_id, payload):
    layer = get_channel_layer()
    if not layer:
        return
    handler = (
        'relay.room.typing'
        if payload.get('type') == 'room.typing'
        else 'relay.room.message'
    )
    async_to_sync(layer.group_send)(
        f'room_{room_id}',
        {'type': handler, 'payload': payload},
    )
