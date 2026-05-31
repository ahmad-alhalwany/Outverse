import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .ws_auth import resolve_ws_user_id
from .ws_utils import (
    create_chat_message,
    create_room_message,
    get_friend_ids,
    message_to_payload,
    presence_payload,
    room_message_to_payload,
    touch_presence,
    user_in_conversation,
    user_in_room,
)


class ChatConsumer(AsyncJsonWebsocketConsumer):
    """Real-time messages for one conversation."""

    async def connect(self):
        self.conversation_id = int(self.scope['url_route']['kwargs']['conversation_id'])
        self.user_id = resolve_ws_user_id(self.scope)
        if not self.user_id:
            await self.close(code=4001)
            return
        allowed = await database_sync_to_async(user_in_conversation)(
            self.user_id, self.conversation_id
        )
        if not allowed:
            await self.close(code=4003)
            return
        self.group_name = f'conv_{self.conversation_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'chat.connected',
            'conversation_id': self.conversation_id,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type')
        if msg_type == 'chat.send':
            text = (content.get('text') or '').strip()
            if not text:
                return
            saved = await database_sync_to_async(create_chat_message)(
                self.conversation_id, self.user_id, text
            )
            payload = await database_sync_to_async(message_to_payload)(saved)
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.chat.message', 'payload': payload},
            )
        elif msg_type == 'chat.typing':
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'relay.chat.typing',
                    'payload': {
                        'type': 'chat.typing',
                        'user_id': self.user_id,
                        'is_typing': bool(content.get('is_typing')),
                    },
                },
            )

    async def relay_chat_message(self, event):
        await self.send_json(event['payload'])

    async def relay_chat_typing(self, event):
        if event['payload'].get('user_id') != self.user_id:
            await self.send_json(event['payload'])


class RoomChatConsumer(AsyncJsonWebsocketConsumer):
    """Group room chat."""

    async def connect(self):
        self.room_id = int(self.scope['url_route']['kwargs']['room_id'])
        self.user_id = resolve_ws_user_id(self.scope)
        if not self.user_id:
            await self.close(code=4001)
            return
        allowed = await database_sync_to_async(user_in_room)(
            self.user_id, self.room_id
        )
        if not allowed:
            await self.close(code=4003)
            return
        self.group_name = f'room_{self.room_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'room.connected',
            'room_id': self.room_id,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type')
        if msg_type == 'room.send':
            text = (content.get('text') or '').strip()
            if not text:
                return
            saved = await database_sync_to_async(create_room_message)(
                self.room_id, self.user_id, text
            )
            payload = await database_sync_to_async(room_message_to_payload)(saved)
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.room.message', 'payload': payload},
            )
        elif msg_type == 'room.typing':
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'relay.room.typing',
                    'payload': {
                        'type': 'room.typing',
                        'user_id': self.user_id,
                        'is_typing': bool(content.get('is_typing')),
                    },
                },
            )

    async def relay_room_message(self, event):
        await self.send_json(event['payload'])

    async def relay_room_typing(self, event):
        if event['payload'].get('user_id') != self.user_id:
            await self.send_json(event['payload'])


class SignalConsumer(AsyncJsonWebsocketConsumer):
    """Presence + WebRTC signaling (1:1 and group rooms)."""

    async def connect(self):
        self.user_id = resolve_ws_user_id(self.scope)
        if not self.user_id:
            await self.close(code=4001)
            return
        self.user_group = f'user_{self.user_id}'
        self.room_groups = set()
        await self.channel_layer.group_add(self.user_group, self.channel_name)
        await database_sync_to_async(touch_presence)(self.user_id)
        await self.accept()
        await self.send_json({'type': 'signal.connected', 'user_id': self.user_id})
        await self._broadcast_presence(True)

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)
            for group in getattr(self, 'room_groups', set()):
                await self.channel_layer.group_discard(group, self.channel_name)
            await self._broadcast_presence(False)

    async def _broadcast_presence(self, is_online):
        payload = await database_sync_to_async(presence_payload)(self.user_id)
        payload['is_online'] = is_online
        event = {'type': 'relay.signal.event', 'payload': {
            'type': 'presence.update',
            **payload,
        }}
        friend_ids = await database_sync_to_async(get_friend_ids)(self.user_id)
        for fid in friend_ids:
            await self.channel_layer.group_send(f'user_{fid}', event)

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type')
        if msg_type == 'presence.ping':
            await database_sync_to_async(touch_presence)(self.user_id)
            await self.send_json({
                'type': 'presence.ack',
                'user_id': self.user_id,
            })
        elif msg_type == 'room.join':
            room_id = content.get('room_id')
            if not room_id:
                return
            allowed = await database_sync_to_async(user_in_room)(
                self.user_id, int(room_id)
            )
            if not allowed:
                return
            group = f'room_{int(room_id)}'
            if group not in self.room_groups:
                self.room_groups.add(group)
                await self.channel_layer.group_add(group, self.channel_name)
            await self.send_json({
                'type': 'room.joined',
                'room_id': int(room_id),
            })
        elif msg_type == 'room.leave':
            room_id = content.get('room_id')
            if not room_id:
                return
            group = f'room_{int(room_id)}'
            if group in self.room_groups:
                self.room_groups.discard(group)
                await self.channel_layer.group_discard(group, self.channel_name)
        elif msg_type in (
            'call.offer',
            'call.answer',
            'call.ice',
            'call.hangup',
            'call.reject',
            'call.busy',
        ):
            to_user = content.get('to_user_id')
            if not to_user or int(to_user) == int(self.user_id):
                return
            payload = {**content, 'from_user_id': self.user_id}
            await self.channel_layer.group_send(
                f'user_{int(to_user)}',
                {'type': 'relay.signal.event', 'payload': payload},
            )
        elif msg_type in (
            'call.room.offer',
            'call.room.answer',
            'call.room.ice',
            'call.room.hangup',
            'call.room.reject',
        ):
            room_id = content.get('room_id')
            if not room_id:
                return
            allowed = await database_sync_to_async(user_in_room)(
                self.user_id, int(room_id)
            )
            if not allowed:
                return
            payload = {**content, 'from_user_id': self.user_id}
            await self.channel_layer.group_send(
                f'room_{int(room_id)}',
                {'type': 'relay.signal.event', 'payload': payload},
            )

    async def relay_signal_event(self, event):
        payload = event['payload']
        if payload.get('from_user_id') == self.user_id:
            return
        await self.send_json(payload)
