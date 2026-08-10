from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from chat.ws_auth import resolve_ws_user_id

from .ws_utils import (
    add_shape,
    add_stroke,
    clear_session,
    is_host,
    join_session,
    leave_session,
    media_payload,
    session_exists,
    undo_last_stroke,
    update_media_transform,
    update_shape_transform,
    user_payload_by_id,
)


class StudioConsumer(AsyncJsonWebsocketConsumer):
    """Real-time strokes, media placement, cursors and presence for one Creation Studio session."""

    async def connect(self):
        self.session_id = int(self.scope['url_route']['kwargs']['session_id'])
        self.user_id = await resolve_ws_user_id(self.scope)
        if not self.user_id:
            await self.close(code=4001)
            return
        exists = await database_sync_to_async(session_exists)(self.session_id)
        if not exists:
            await self.close(code=4004)
            return
        self.group_name = f'studio_{self.session_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        joined_user = await database_sync_to_async(join_session)(self.session_id, self.user_id)
        await self.send_json({'type': 'studio.connected', 'session_id': self.session_id})
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'relay.studio.event', 'payload': {'type': 'participant.joined', 'user': joined_user}},
        )

    async def disconnect(self, close_code):
        if not hasattr(self, 'group_name'):
            return
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await database_sync_to_async(leave_session)(self.session_id, self.user_id)
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'relay.studio.event', 'payload': {'type': 'participant.left', 'user_id': self.user_id}},
        )

    async def receive_json(self, content, **kwargs):
        msg_type = content.get('type')

        if msg_type == 'stroke.add':
            points = content.get('points')
            if not isinstance(points, list) or len(points) < 2:
                return
            payload = await database_sync_to_async(add_stroke)(
                self.session_id, self.user_id, points, content.get('color'), content.get('width'),
            )
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'stroke.added', **payload}},
            )

        elif msg_type == 'stroke.undo':
            stroke_id = await database_sync_to_async(undo_last_stroke)(self.session_id, self.user_id)
            if stroke_id is not None:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'stroke.removed', 'id': stroke_id}},
                )

        elif msg_type == 'media.added':
            media_id = content.get('id')
            if not media_id:
                return
            from .models import CanvasMedia
            media = await database_sync_to_async(
                lambda: CanvasMedia.objects.select_related('user').filter(pk=media_id, session_id=self.session_id).first()
            )()
            if not media:
                return
            payload = await database_sync_to_async(media_payload)(media)
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'media.added', **payload}},
            )

        elif msg_type == 'media.transform':
            media_id = content.get('id')
            if not media_id:
                return
            payload = await database_sync_to_async(update_media_transform)(
                self.session_id, media_id,
                float(content.get('x', 0)), float(content.get('y', 0)),
                float(content.get('width', 200)), float(content.get('height', 200)),
                float(content.get('rotation', 0)),
                content.get('filter'),
            )
            if payload:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'media.transformed', **payload}},
                )

        elif msg_type == 'shape.add':
            kind = content.get('kind')
            if kind not in ('rectangle', 'circle', 'line'):
                return
            payload = await database_sync_to_async(add_shape)(
                self.session_id, self.user_id, kind,
                float(content.get('x', 0)), float(content.get('y', 0)),
                float(content.get('width', 120)), float(content.get('height', 120)),
                content.get('color'), content.get('stroke_width'),
            )
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'shape.added', **payload}},
            )

        elif msg_type == 'shape.transform':
            shape_id = content.get('id')
            if not shape_id:
                return
            payload = await database_sync_to_async(update_shape_transform)(
                self.session_id, shape_id,
                float(content.get('x', 0)), float(content.get('y', 0)),
                float(content.get('width', 120)), float(content.get('height', 120)),
                float(content.get('rotation', 0)),
            )
            if payload:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'shape.transformed', **payload}},
                )

        elif msg_type == 'chat.send':
            text = (content.get('text') or '').strip()[:500]
            if not text:
                return
            user = await database_sync_to_async(user_payload_by_id)(self.user_id)
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'chat.message', 'user': user, 'text': text}},
            )

        elif msg_type == 'cursor.move':
            await self.channel_layer.group_send(
                self.group_name,
                {
                    'type': 'relay.studio.event',
                    'payload': {
                        'type': 'cursor.moved',
                        'user_id': self.user_id,
                        'x': content.get('x'),
                        'y': content.get('y'),
                    },
                    'skip_user_id': self.user_id,
                },
            )

        elif msg_type == 'session.clear':
            allowed = await database_sync_to_async(is_host)(self.user_id, self.session_id)
            if not allowed:
                return
            await database_sync_to_async(clear_session)(self.session_id)
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'session.cleared'}},
            )

    async def relay_studio_event(self, event):
        if event.get('skip_user_id') == self.user_id:
            return
        await self.send_json(event['payload'])
