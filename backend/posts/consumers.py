"""WebSocket consumer for live post comment updates."""

from channels.generic.websocket import AsyncJsonWebsocketConsumer

from chat.ws_auth import resolve_ws_user_id


class PostCommentsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.post_id = int(self.scope['url_route']['kwargs']['post_id'])
        self.group_name = f'post_comments_{self.post_id}'
        self.viewer_id = await resolve_ws_user_id(self.scope)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'comments.connected',
            'post_id': self.post_id,
            'authenticated': self.viewer_id is not None,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def relay_comment_event(self, event):
        await self.send_json(event['payload'])
