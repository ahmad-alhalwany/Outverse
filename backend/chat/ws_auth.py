from urllib.parse import parse_qs

from channels.db import database_sync_to_async


def _query_params(scope):
    query = scope.get('query_string', b'').decode()
    return parse_qs(query)


def parse_user_id_from_token(scope):
    """Resolve user id from `?token=` (DRF authtoken). Sync — call via resolve_ws_user_id."""
    params = _query_params(scope)
    token_key = params.get('token', [None])[0]
    if not token_key:
        return None
    from rest_framework.authtoken.models import Token

    try:
        return int(Token.objects.select_related('user').get(key=token_key).user_id)
    except Token.DoesNotExist:
        return None


@database_sync_to_async
def resolve_ws_user_id(scope):
    """Async-safe token lookup for websocket consumers."""
    return parse_user_id_from_token(scope)
