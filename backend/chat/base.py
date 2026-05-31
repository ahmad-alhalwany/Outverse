from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView


class ChatAuthView(APIView):
    """Chat REST endpoints require a valid Token or session."""

    permission_classes = [IsAuthenticated]

    @property
    def uid(self):
        return int(self.request.user.pk)
