from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from chat.ws_auth import resolve_ws_user_id

from .ws_utils import (
    add_shape,
    add_stroke,
    add_text,
    can_access,
    clear_session,
    delete_shape,
    delete_text,
    is_host,
    join_session,
    leave_session,
    media_payload,
    reorder_layer,
    session_exists,
    set_visibility,
    undo_last_action,
    update_media_transform,
    update_shape_transform,
    update_text_transform,
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
        allowed = await database_sync_to_async(can_access)(self.user_id, self.session_id)
        if not allowed:
            await self.close(code=4003)
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
            opacity = content.get('opacity')
            payload = await database_sync_to_async(update_media_transform)(
                self.session_id, media_id,
                float(content.get('x', 0)), float(content.get('y', 0)),
                float(content.get('width', 200)), float(content.get('height', 200)),
                float(content.get('rotation', 0)),
                content.get('filter'),
                float(opacity) if opacity is not None else None,
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
            opacity = content.get('opacity')
            payload = await database_sync_to_async(add_shape)(
                self.session_id, self.user_id, kind,
                float(content.get('x', 0)), float(content.get('y', 0)),
                float(content.get('width', 120)), float(content.get('height', 120)),
                content.get('color'), content.get('stroke_width'),
                float(content.get('rotation', 0)),
                float(opacity) if opacity is not None else 1,
                content.get('z_index'),
            )
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'shape.added', **payload}},
            )

        elif msg_type == 'shape.transform':
            shape_id = content.get('id')
            if not shape_id:
                return
            opacity = content.get('opacity')
            payload = await database_sync_to_async(update_shape_transform)(
                self.session_id, shape_id,
                float(content.get('x', 0)), float(content.get('y', 0)),
                float(content.get('width', 120)), float(content.get('height', 120)),
                float(content.get('rotation', 0)),
                float(opacity) if opacity is not None else None,
            )
            if payload:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'shape.transformed', **payload}},
                )

        elif msg_type == 'media.deleted':
            media_id = content.get('id')
            if not media_id:
                return
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'media.deleted', 'id': media_id}},
            )

        elif msg_type == 'shape.delete':
            shape_id = content.get('id')
            if not shape_id:
                return
            ok = await database_sync_to_async(delete_shape)(self.session_id, shape_id, self.user_id)
            if ok:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'shape.deleted', 'id': shape_id}},
                )

        elif msg_type == 'text.add':
            opacity = content.get('opacity')
            width, height, rotation = content.get('width'), content.get('height'), content.get('rotation')
            payload = await database_sync_to_async(add_text)(
                self.session_id, self.user_id,
                float(content.get('x', 0)), float(content.get('y', 0)),
                content.get('color'), content.get('font_size'),
                float(width) if width is not None else None,
                float(height) if height is not None else None,
                float(rotation) if rotation is not None else 0,
                float(opacity) if opacity is not None else 1,
                content.get('text'),
                content.get('z_index'),
            )
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': 'text.added', **payload}},
            )

        elif msg_type == 'text.transform':
            text_id = content.get('id')
            if not text_id:
                return
            opacity = content.get('opacity')
            payload = await database_sync_to_async(update_text_transform)(
                self.session_id, text_id,
                float(content.get('x', 0)), float(content.get('y', 0)),
                float(content.get('width', 200)), float(content.get('height', 60)),
                float(content.get('rotation', 0)),
                content.get('text'), content.get('color'), content.get('font_size'),
                float(opacity) if opacity is not None else None,
            )
            if payload:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'text.transformed', **payload}},
                )

        elif msg_type == 'text.delete':
            text_id = content.get('id')
            if not text_id:
                return
            ok = await database_sync_to_async(delete_text)(self.session_id, text_id, self.user_id)
            if ok:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'text.deleted', 'id': text_id}},
                )

        elif msg_type == 'layer.reorder':
            kind = content.get('kind')
            item_id = content.get('id')
            direction = content.get('direction')
            if kind not in ('media', 'shape', 'text') or not item_id or direction not in ('front', 'back'):
                return
            new_z = await database_sync_to_async(reorder_layer)(self.session_id, kind, item_id, direction)
            if new_z is not None:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'layer.reordered', 'kind': kind, 'id': item_id, 'z_index': new_z}},
                )

        elif msg_type == 'layer.visibility':
            kind = content.get('kind')
            item_id = content.get('id')
            visible = content.get('visible')
            if kind not in ('media', 'shape', 'text') or not item_id or visible is None:
                return
            ok = await database_sync_to_async(set_visibility)(self.session_id, kind, item_id, bool(visible))
            if ok:
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'layer.visibility', 'kind': kind, 'id': item_id, 'visible': bool(visible)}},
                )

        elif msg_type == 'history.undo':
            result = await database_sync_to_async(undo_last_action)(self.session_id, self.user_id)
            if not result:
                return
            kind = result['kind']
            removed_type = {'stroke': 'stroke.removed', 'shape': 'shape.deleted', 'text': 'text.deleted'}[kind]
            await self.channel_layer.group_send(
                self.group_name,
                {'type': 'relay.studio.event', 'payload': {'type': removed_type, 'id': result['id']}},
            )
            await self.send_json({'type': 'history.undone', 'kind': kind, 'id': result['id'], 'payload': result['payload']})

        elif msg_type == 'history.redo':
            kind = content.get('kind')
            data = content.get('payload') or {}
            if kind == 'stroke':
                points = data.get('points')
                if not isinstance(points, list) or len(points) < 2:
                    return
                payload = await database_sync_to_async(add_stroke)(
                    self.session_id, self.user_id, points, data.get('color'), data.get('width'),
                )
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'stroke.added', **payload}},
                )
            elif kind == 'shape':
                payload = await database_sync_to_async(add_shape)(
                    self.session_id, self.user_id, data.get('kind'),
                    float(data.get('x', 0)), float(data.get('y', 0)),
                    float(data.get('width', 120)), float(data.get('height', 120)),
                    data.get('color'), data.get('stroke_width'),
                    float(data.get('rotation', 0)), float(data.get('opacity', 1)), data.get('z_index'),
                )
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'shape.added', **payload}},
                )
            elif kind == 'text':
                payload = await database_sync_to_async(add_text)(
                    self.session_id, self.user_id,
                    float(data.get('x', 0)), float(data.get('y', 0)),
                    data.get('color'), data.get('font_size'),
                    float(data.get('width', 200)), float(data.get('height', 60)),
                    float(data.get('rotation', 0)), float(data.get('opacity', 1)),
                    data.get('text'), data.get('z_index'),
                )
                await self.channel_layer.group_send(
                    self.group_name,
                    {'type': 'relay.studio.event', 'payload': {'type': 'text.added', **payload}},
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
