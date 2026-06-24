from urllib.parse import parse_qs

from django.conf import settings


def _query_params(scope):
    query = scope.get('query_string', b'').decode()
    return parse_qs(query)


def parse_user_id_from_token(scope):
    """Resolve user id from `?token=` (DRF authtoken)."""
    params = _query_params(scope)
    token_key = params.get('token', [None])[0]
    if not token_key:
        return None
    from rest_framework.authtoken.models import Token

    try:
        return int(Token.objects.select_related('user').get(key=token_key).user_id)
    except Token.DoesNotExist:
        return None


def resolve_ws_user_id(scope):
    uid = parse_user_id_from_token(scope)
    if uid is not None:
        return uid
    return None
