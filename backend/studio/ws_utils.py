from .models import CanvasMedia, CanvasShape, CanvasStroke, DrawSession, SessionParticipant


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
        x=x, y=y, width=width, height=height,
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


def clear_session(session_id):
    CanvasStroke.objects.filter(session_id=session_id).delete()
    CanvasMedia.objects.filter(session_id=session_id).delete()
    CanvasShape.objects.filter(session_id=session_id).delete()
