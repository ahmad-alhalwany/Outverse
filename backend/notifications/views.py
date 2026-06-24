from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from outverse.auth_utils import require_user
from .models import Notification
from .serializers import NotificationSerializer

User = get_user_model()




class NotificationListView(APIView):

    permission_classes = [IsAuthenticated]



    def get(self, request):

        user, err = require_user(request)

        if err:

            return err

        qs = Notification.objects.filter(
            recipient_id=user.id
        ).select_related('actor').order_by('-created_at')
        notification_type = request.query_params.get('type', '').strip()
        if notification_type and notification_type != 'all':
            qs = qs.filter(type=notification_type)
        unread_count = qs.filter(is_read=False).count()
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(qs, request, view=self)
        serializer = NotificationSerializer(
            page, many=True, context={'request': request}
        )
        response = paginator.get_paginated_response(serializer.data)
        response.data['unread_count'] = unread_count
        return response





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


class NotificationBroadcastView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request):
        title = (request.data.get('title') or '').strip()
        message = (request.data.get('message') or '').strip()
        user_ids = request.data.get('user_ids') or []
        if not title or not message:
            return Response({'error': 'Title and message are required.'}, status=400)

        recipients = User.objects.all()
        if user_ids:
            recipients = recipients.filter(id__in=user_ids)

        notifications = [
            Notification(
                recipient=user,
                actor=request.user,
                verb='moderation_action',
                type='broadcast',
                text=f'{title}\n\n{message}',
            )
            for user in recipients
        ]
        Notification.objects.bulk_create(notifications, batch_size=500)
        return Response({'sent': len(notifications)})


