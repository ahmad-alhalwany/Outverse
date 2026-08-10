"""Authentication helpers that degrade gracefully for public endpoints."""

from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class SoftTokenAuthentication(TokenAuthentication):
    """Like TokenAuthentication, but invalid/expired tokens become anonymous.

    DRF's default TokenAuthentication raises AuthenticationFailed (401) when
    the Authorization header is present but the key is unknown — even on
    AllowAny views. After switching DB environments (local → AWS RDS), old
    browser tokens cause the whole homepage to look empty. Treating bad
    tokens as anonymous keeps public reads working; IsAuthenticated views
    still reject the request.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except AuthenticationFailed:
            return None
