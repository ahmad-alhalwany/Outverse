from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from outverse.auth_utils import user_from_request

from .models import FlaggedContent
from .serializers import FlaggedContentSerializer


class FlaggedContentViewSet(viewsets.ModelViewSet):
    queryset = FlaggedContent.objects.all().order_by('-created_at')
    serializer_class = FlaggedContentSerializer
    permission_classes = [AllowAny]

    def perform_create(self, serializer):
        user = user_from_request(self.request)
        reporter = (
            user.username
            if user
            else (self.request.data.get('reporter') or 'anonymous')
        )
        serializer.save(reporter=reporter[:100])
