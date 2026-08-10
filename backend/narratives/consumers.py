import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model

from chat.ws_auth import resolve_ws_user_id


class ForgeStoryConsumer(AsyncJsonWebsocketConsumer):
    """Light presence + event pulse for a Story Forge room."""

    async def connect(self):
        self.story_id = int(self.scope['url_route']['kwargs']['story_id'])
        self.user_id = await resolve_ws_user_id(self.scope)
        if not self.user_id:
            await self.close(code=4001)
            return
        allowed = await database_sync_to_async(self._can_join)(self.user_id, self.story_id)
        if not allowed:
            await self.close(code=4003)
            return
        self.group_name = f'forge_story_{self.story_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        username = await database_sync_to_async(self._username)(self.user_id)
        await self.channel_layer.group_send(
            self.group_name,
            {
                'type': 'forge.presence',
                'payload': {
                    'type': 'forge.presence',
                    'event': 'join',
                    'user_id': self.user_id,
                    'username': username,
                },
            },
        )
        await self.send_json({
            'type': 'forge.connected',
            'story_id': self.story_id,
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name') and getattr(self, 'user_id', None):
            username = await database_sync_to_async(self._username)(self.user_id)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'forge.presence',
                    'payload': {
                        'type': 'forge.presence',
                        'event': 'leave',
                        'user_id': self.user_id,
                        'username': username,
                    },
                },
            )
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type')
        if msg_type == 'forge.ping':
            await self.send_json({'type': 'forge.pong'})
        elif msg_type == 'forge.event':
            # Clients may echo lightweight UI events; server relays to room.
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'forge.event',
                    'payload': {
                        'type': 'forge.event',
                        'event': content.get('event') or 'update',
                        'user_id': self.user_id,
                        'data': content.get('data') or {},
                    },
                },
            )

    async def forge_presence(self, event):
        await self.send_json(event['payload'])

    async def forge_event(self, event):
        await self.send_json(event['payload'])

    @staticmethod
    def _can_join(user_id: int, story_id: int) -> bool:
        from narratives.models import Story
        story = Story.objects.filter(pk=story_id).first()
        if not story:
            return False
        User = get_user_model()
        user = User.objects.filter(pk=user_id).first()
        if not user:
            return False
        if story.visibility == 'public' or story.is_owner(user):
            return True
        return story.collaborators.filter(
            user=user, status__in=['invited', 'accepted'],
        ).exists()

    @staticmethod
    def _username(user_id: int) -> str:
        User = get_user_model()
        u = User.objects.filter(pk=user_id).only('username').first()
        return u.username if u else ''


def broadcast_forge_event(story_id: int, event: str, data: dict | None = None, user_id: int | None = None):
    """Sync helper for views to notify connected studio clients."""
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        if not layer:
            return
        async_to_sync(layer.group_send)(
            f'forge_story_{story_id}',
            {
                'type': 'forge.event',
                'payload': {
                    'type': 'forge.event',
                    'event': event,
                    'user_id': user_id,
                    'data': data or {},
                },
            },
        )
    except Exception:
        pass
