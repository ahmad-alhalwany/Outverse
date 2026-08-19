"""Helper for recording admin-privileged actions to AuditLog.

Call log_action(...) from any staff-only view after a mutation succeeds.
Never let logging failures break the actual request.
"""

from .models import AuditLog


def log_action(request, action, description, *, target_user=None, metadata=None):
    try:
        ip = request.META.get('REMOTE_ADDR') if request else None
        user_agent = request.META.get('HTTP_USER_AGENT', '') if request else ''
        actor = getattr(request, 'user', None) if request else None
        if actor is not None and not actor.is_authenticated:
            actor = None
        entry_metadata = dict(metadata or {})
        if target_user is not None:
            entry_metadata.setdefault('target_user_id', target_user.id if hasattr(target_user, 'id') else target_user)
        AuditLog.objects.create(
            user=actor,
            action=action,
            description=description,
            ip_address=ip,
            user_agent=user_agent,
            metadata=entry_metadata,
        )
    except Exception:
        pass
