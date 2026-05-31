from rest_framework.permissions import IsAuthenticated

from rest_framework.response import Response

from rest_framework.views import APIView



from outverse.auth_utils import require_user



from .models import Notification

from .serializers import NotificationSerializer





class NotificationListView(APIView):

    permission_classes = [IsAuthenticated]



    def get(self, request):

        user, err = require_user(request)

        if err:

            return err

        qs = Notification.objects.filter(

            recipient_id=user.id

        ).select_related('actor')

        unread_count = qs.filter(is_read=False).count()

        serializer = NotificationSerializer(

            qs[:30], many=True, context={'request': request}

        )

        return Response({

            'results': serializer.data,

            'unread_count': unread_count,

        })





class NotificationReadView(APIView):

    permission_classes = [IsAuthenticated]



    def post(self, request, pk):

        user, err = require_user(request)

        if err:

            return err

        updated = Notification.objects.filter(

            pk=pk, recipient_id=user.id, is_read=False

        ).update(is_read=True)

        if not updated:

            exists = Notification.objects.filter(

                pk=pk, recipient_id=user.id

            ).exists()

            if not exists:

                return Response({'error': 'Not found.'}, status=404)

        unread_count = Notification.objects.filter(

            recipient_id=user.id, is_read=False

        ).count()

        return Response({'unread_count': unread_count})





class NotificationReadAllView(APIView):

    permission_classes = [IsAuthenticated]



    def post(self, request):

        user, err = require_user(request)

        if err:

            return err

        Notification.objects.filter(

            recipient_id=user.id, is_read=False

        ).update(is_read=True)

        return Response({'unread_count': 0})


