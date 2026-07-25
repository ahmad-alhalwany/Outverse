from rest_framework.pagination import PageNumberPagination
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from outverse.auth_utils import require_user
from .marketing import resolve_segment_users, send_campaign
from .models import MarketingCampaign, Notification, PushSubscription
from .serializers import MarketingCampaignSerializer, NotificationSerializer

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


class PushSubscribeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user, err = require_user(request)
        if err:
            return err
        endpoint = (request.data.get('endpoint') or '').strip()
        keys = request.data.get('keys') or {}
        p256dh = (keys.get('p256dh') or '').strip()
        auth_key = (keys.get('auth') or '').strip()
        if not endpoint or not p256dh or not auth_key:
            return Response({'error': 'Invalid subscription.'}, status=400)
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user_id': user.id,
                'p256dh': p256dh,
                'auth': auth_key,
                'user_agent': (request.META.get('HTTP_USER_AGENT') or '')[:255],
            },
        )
        return Response({'subscribed': True})

    def delete(self, request):
        user, err = require_user(request)
        if err:
            return err
        endpoint = (request.data.get('endpoint') or request.query_params.get('endpoint') or '').strip()
        if endpoint:
            PushSubscription.objects.filter(user_id=user.id, endpoint=endpoint).delete()
        else:
            PushSubscription.objects.filter(user_id=user.id).delete()
        return Response({'subscribed': False})


class PushVapidPublicKeyView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'public_key': getattr(settings, 'VAPID_PUBLIC_KEY', '') or ''})


class MarketingCampaignListCreateView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        campaigns = MarketingCampaign.objects.all()
        return Response(MarketingCampaignSerializer(campaigns, many=True).data)

    def post(self, request):
        serializer = MarketingCampaignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=201)


class MarketingCampaignDetailView(APIView):
    permission_classes = [IsAdminUser]

    def _get(self, pk):
        return get_object_or_404(MarketingCampaign, pk=pk)

    def patch(self, request, pk):
        campaign = self._get(pk)
        if campaign.status != 'draft':
            return Response({'error': 'Only draft campaigns can be edited.'}, status=400)
        serializer = MarketingCampaignSerializer(campaign, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        campaign = self._get(pk)
        if campaign.status != 'draft':
            return Response({'error': 'Only draft campaigns can be deleted.'}, status=400)
        campaign.delete()
        return Response(status=204)


class MarketingCampaignPreviewView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        campaign = get_object_or_404(MarketingCampaign, pk=pk)
        count = resolve_segment_users(campaign.segment).count()
        return Response({'recipient_count': count})


class MarketingCampaignSendView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        campaign = get_object_or_404(MarketingCampaign, pk=pk)
        if campaign.status == 'sent':
            return Response({'error': 'Campaign was already sent.'}, status=400)
        campaign.status = 'sending'
        campaign.save(update_fields=['status'])
        sent = send_campaign(campaign)
        campaign.status = 'sent'
        campaign.recipient_count = sent
        campaign.sent_at = timezone.now()
        campaign.save(update_fields=['status', 'recipient_count', 'sent_at'])
        return Response(MarketingCampaignSerializer(campaign).data)

