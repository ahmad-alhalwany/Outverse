from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from outverse.throttles import AnonReadThrottle, BurstThrottle, ContentDraftWriteThrottle

from .models import UserPreferences
from .serializers import DEFAULT_NOTIFICATION_PREFS, UserPreferencesSerializer


class UserPreferencesView(APIView):
    throttle_classes = [BurstThrottle, AnonReadThrottle]
    permission_classes = [IsAuthenticated]

    def _get_preferences(self, user):
        prefs, created = UserPreferences.objects.get_or_create(
            user=user,
            defaults={'notification_prefs': DEFAULT_NOTIFICATION_PREFS},
        )
        if created:
            return prefs
        if not prefs.notification_prefs:
            prefs.notification_prefs = DEFAULT_NOTIFICATION_PREFS
            prefs.save(update_fields=['notification_prefs'])
        return prefs

    def get(self, request):
        prefs = self._get_preferences(request.user)
        serializer = UserPreferencesSerializer(prefs)
        return Response(serializer.data)

    def put(self, request):
        prefs = self._get_preferences(request.user)
        serializer = UserPreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def patch(self, request):
        return self.put(request)
