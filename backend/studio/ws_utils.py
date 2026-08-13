from django.db.models import Max, Min

from .models import CanvasMedia, CanvasShape, CanvasStroke, CanvasText, DrawSession, SessionParticipant

LAYER_MODELS = {'media': CanvasMedia, 'shape': CanvasShape, 'text': CanvasText}


def user_payload(user):
    avatar = None
    if getattr(user, 'avatar', None) and user.avatar:
        avatar = user.avatar.url
    return {'id': user.id, 'username': user.username, 'avatar': avatar}


def stroke_payload(stroke):
    return {
        'id': stroke.id,
        'user': user_payload(stroke.user),
        'points': stroke.points,
        'color': stroke.color,
        'width': stroke.width,
    }


def media_payload(media):
    return {
        'id': media.id,
        'user': user_payload(media.user),
        'image': media.image.url if media.image else None,
        'x': media.x,
        'y': media.y,
        'width': media.width,
        'height': media.height,
        'rotation': media.rotation,
        'z_index': media.z_index,
        'filter': media.filter,
    }


def shape_payload(shape):
    return {
        'id': shape.id,
        'user': user_payload(shape.user),
        'kind': shape.kind,
        'x': shape.x,
        'y': shape.y,
        'width': shape.width,
        'height': shape.height,
        'rotation': shape.rotation,
        'z_index': shape.z_index,
        'color': shape.color,
        'stroke_width': shape.stroke_width,
    }


def text_payload(text):
    return {
        'id': text.id,
        'user': user_payload(text.user),
        'text': text.text,
        'x': text.x,
        'y': text.y,
        'width': text.width,
        'height': text.height,
        'rotation': text.rotation,
        'z_index': text.z_index,
        'color': text.color,
        'font_size': text.font_size,
    }


def next_z_index(session_id):
    """Next stacking value so a freshly placed item lands above everything else."""
    top = None
    for Model in LAYER_MODELS.values():
        mx = Model.objects.filter(session_id=session_id).aggregate(mx=Max('z_index'))['mx']
        if mx is not None and (top is None or mx > top):
            top = mx
    return (top + 1) if top is not None else 0


def user_payload_by_id(user_id):
    from users.models import User
    user = User.objects.filter(pk=user_id).first()
    return user_payload(user) if user else None


def session_exists(session_id):
    return DrawSession.objects.filter(pk=session_id, is_live=True).exists()


def is_host(user_id, session_id):
    return DrawSession.objects.filter(pk=session_id, host_id=user_id).exists()


def join_session(session_id, user_id):
    SessionParticipant.objects.update_or_create(session_id=session_id, user_id=user_id)
    from users.models import User
    user = User.objects.get(pk=user_id)
    return user_payload(user)


def leave_session(session_id, user_id):
    SessionParticipant.objects.filter(session_id=session_id, user_id=user_id).delete()


def add_stroke(session_id, user_id, points, color, width):
    stroke = CanvasStroke.objects.create(
        session_id=session_id, user_id=user_id, points=points,
        color=color or '#5B21B6', width=width or 3,
    )
    return stroke_payload(stroke)


def undo_last_stroke(session_id, user_id):
    stroke = (
        CanvasStroke.objects.filter(session_id=session_id, user_id=user_id)
        .order_by('-created_at')
        .first()
    )
    if not stroke:
        return None
    stroke_id = stroke.id
    stroke.delete()
    return stroke_id


def update_media_transform(session_id, media_id, x, y, width, height, rotation, filter_str=None):
    fields = {'x': x, 'y': y, 'width': width, 'height': height, 'rotation': rotation}
    if filter_str is not None:
        fields['filter'] = filter_str
    updated = CanvasMedia.objects.filter(pk=media_id, session_id=session_id).update(**fields)
    if not updated:
        return None
    return media_payload(CanvasMedia.objects.select_related('user').get(pk=media_id))


def add_shape(session_id, user_id, kind, x, y, width, height, color, stroke_width):
    shape = CanvasShape.objects.create(
        session_id=session_id, user_id=user_id, kind=kind,
        x=x, y=y, width=width, height=height, z_index=next_z_index(session_id),
        color=color or '#5B21B6', stroke_width=stroke_width or 3,
    )
    return shape_payload(CanvasShape.objects.select_related('user').get(pk=shape.pk))


def update_shape_transform(session_id, shape_id, x, y, width, height, rotation):
    updated = CanvasShape.objects.filter(pk=shape_id, session_id=session_id).update(
        x=x, y=y, width=width, height=height, rotation=rotation,
    )
    if not updated:
        return None
    return shape_payload(CanvasShape.objects.select_related('user').get(pk=shape_id))


def delete_shape(session_id, shape_id, user_id):
    shape = CanvasShape.objects.filter(pk=shape_id, session_id=session_id).first()
    if not shape:
        return False
    if shape.user_id != user_id and not is_host(user_id, session_id):
        return False
    shape.delete()
    return True


def add_text(session_id, user_id, x, y, color, font_size):
    text = CanvasText.objects.create(
        session_id=session_id, user_id=user_id, x=x, y=y, z_index=next_z_index(session_id),
        color=color or '#5B21B6', font_size=font_size or 24,
    )
    return text_payload(CanvasText.objects.select_related('user').get(pk=text.pk))


def update_text_transform(session_id, text_id, x, y, width, height, rotation, text_value=None, color=None, font_size=None):
    fields = {'x': x, 'y': y, 'width': width, 'height': height, 'rotation': rotation}
    if text_value is not None:
        fields['text'] = text_value[:300]
    if color is not None:
        fields['color'] = color
    if font_size is not None:
        fields['font_size'] = font_size
    updated = CanvasText.objects.filter(pk=text_id, session_id=session_id).update(**fields)
    if not updated:
        return None
    return text_payload(CanvasText.objects.select_related('user').get(pk=text_id))


def delete_text(session_id, text_id, user_id):
    text = CanvasText.objects.filter(pk=text_id, session_id=session_id).first()
    if not text:
        return False
    if text.user_id != user_id and not is_host(user_id, session_id):
        return False
    text.delete()
    return True


def delete_media(session_id, media_id, user_id):
    """Only the item's own creator or the session host may delete it."""
    media = CanvasMedia.objects.filter(pk=media_id, session_id=session_id).first()
    if not media:
        return False
    if media.user_id != user_id and not is_host(user_id, session_id):
        return False
    media.delete()
    return True


def reorder_layer(session_id, kind, item_id, direction):
    Model = LAYER_MODELS.get(kind)
    if not Model:
        return None
    bounds = None
    for M in LAYER_MODELS.values():
        agg = M.objects.filter(session_id=session_id).aggregate(mn=Min('z_index'), mx=Max('z_index'))
        if agg['mn'] is None:
            continue
        if bounds is None:
            bounds = [agg['mn'], agg['mx']]
        else:
            bounds[0] = min(bounds[0], agg['mn'])
            bounds[1] = max(bounds[1], agg['mx'])
    if bounds is None:
        return None
    new_z = (bounds[1] + 1) if direction == 'front' else (bounds[0] - 1)
    updated = Model.objects.filter(pk=item_id, session_id=session_id).update(z_index=new_z)
    if not updated:
        return None
    return new_z


def clear_session(session_id):
    CanvasStroke.objects.filter(session_id=session_id).delete()
    CanvasMedia.objects.filter(session_id=session_id).delete()
    CanvasShape.objects.filter(session_id=session_id).delete()
    CanvasText.objects.filter(session_id=session_id).delete()
