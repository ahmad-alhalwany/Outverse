"""WebSocket consumer for live session chat + viewer count updates."""

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from chat.ws_auth import resolve_ws_user_id


class LiveSessionConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = int(self.scope['url_route']['kwargs']['session_id'])
        self.group_name = f'live_session_{self.session_id}'
        self.viewer_id = await resolve_ws_user_id(self.scope)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'live.connected',
            'session_id': self.session_id,
            'authenticated': self.viewer_id is not None,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # Client may send chat via REST; WS is primarily for fan-out.
        # Allow thin echo of ping for keepalive.
        if content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    async def relay_live_event(self, event):
        await self.send_json(event['payload'])
