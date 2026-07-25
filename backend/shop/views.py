from django.core.cache import cache
from django.db import transaction
from django.db.models import F, Sum, Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from outverse.auth_utils import require_user

from users.models import Profile, User
from users.social import is_blocked_between

from .models import CoinPack, CoinPurchase, ShopItem, Tip, Transaction
from .serializers import CoinPackSerializer, ShopItemSerializer, TipSerializer, TransactionSerializer


def _profile_for_user(user_id):
    user = User.objects.get(pk=user_id)
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


class ShopItemViewSet(viewsets.ModelViewSet):
    serializer_class = ShopItemSerializer

    def get_permissions(self):
        if self.action in ('wallet', 'purchase', 'transactions', 'my_sales', 'update_fulfillment'):
            return [IsAuthenticated()]
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        if user and user.is_authenticated and user.is_staff:
            qs = ShopItem.objects.all()
        else:
            qs = ShopItem.objects.filter(is_available=True)
        params = self.request.query_params
        category = params.get('category')
        item_type = params.get('type')
        ordering = params.get('ordering')
        if category and category != 'all':
            qs = qs.filter(category=category)
        if item_type and item_type != 'all':
            qs = qs.filter(type=item_type)
        if ordering == 'trending':
            return qs.order_by('-sales_count', '-rating')
        if ordering == 'top_rated':
            return qs.order_by('-rating')
        return qs.order_by('-created_at')

    @action(detail=False, methods=['get'])
    def featured(self, request):
        cached = cache.get('shop:featured')
        if cached is not None:
            return Response(cached)
        items = ShopItem.objects.filter(
            is_available=True, is_featured=True
        ).order_by('-sales_count')[:6]
        payload = ShopItemSerializer(
            items, many=True, context={'request': request}
        ).data
        cache.set('shop:featured', payload, 300)
        return Response(payload)

    @action(detail=False, methods=['get'])
    def wallet(self, request):
        user, err = require_user(request)
        if err:
            return err
        profile = _profile_for_user(user.id)
        transactions = (
            Transaction.objects.filter(user_id=user.id, status='completed')
            .select_related('item')
            .order_by('-created_at')
        )
        owned_ids = []
        owned_items = []
        seen = set()
        for tx in transactions:
            if tx.item_id in seen:
                continue
            seen.add(tx.item_id)
            owned_ids.append(tx.item_id)
            owned_items.append(tx.item)
        item_serializer = ShopItemSerializer(
            owned_items, many=True, context={'request': request}
        )
        return Response({
            'balance': profile.points,
            'owned_item_ids': owned_ids,
            'owned_items': item_serializer.data,
        })

    @action(detail=False, methods=['get'])
    def transactions(self, request):
        user, err = require_user(request)
        if err:
            return err
        transactions = (
            Transaction.objects.filter(user_id=user.id)
            .select_related('item')
            .order_by('-timestamp')
        )
        serializer = TransactionSerializer(
            transactions, many=True, context={'request': request}
        )
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def purchase(self, request, pk=None):
        user, err = require_user(request)
        if err:
            return err
        shipping_address = (request.data.get('shipping_address') or '').strip()
        with transaction.atomic():
            item = ShopItem.objects.select_for_update().get(pk=pk)
            if item.type == 'physical' and not shipping_address:
                return Response(
                    {'error': 'A shipping address is required for physical items.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if Transaction.objects.select_for_update().filter(
                user_id=user.id, item=item, status='completed'
            ).exists():
                return Response(
                    {'error': 'You already own this item.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile = Profile.objects.select_for_update().get_or_create(user=user)[0]
            if profile.points < item.price:
                return Response(
                    {
                        'error': 'Insufficient coins.',
                        'balance': profile.points,
                        'price': item.price,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profile.points = F('points') - item.price
            profile.save(update_fields=['points'])
            transaction_obj = Transaction.objects.create(
                user_id=user.id,
                seller_id=item.creator_id,
                item=item,
                amount=item.price,
                status='completed',
                shipping_address=shipping_address if item.type == 'physical' else '',
                fulfillment_status='pending' if item.type == 'physical' else 'not_applicable',
            )
            ShopItem.objects.filter(pk=item.pk).update(sales_count=F('sales_count') + 1)
            profile.refresh_from_db(fields=['points'])
            item.refresh_from_db(fields=['sales_count'])
        try:
            from .spending import update_spender_tier
            update_spender_tier(user)
        except Exception:
            pass
        try:
            from notifications.utils import create_notification
            if item.creator_id and item.creator_id != user.id:
                create_notification(
                    recipient_id=item.creator_id,
                    actor_id=user.id,
                    verb='shop_purchase',
                    text=f'Sold "{item.name}" for {item.price} ✨',
                    notification_type='shop',
                )
            create_notification(
                recipient_id=user.id,
                actor_id=item.creator_id or user.id,
                verb='shop_purchase',
                text=f'You unlocked "{item.name}"',
                notification_type='shop',
            )
        except Exception:
            pass
        serializer = TransactionSerializer(
            transaction_obj, context={'request': request}
        )
        data = serializer.data
        data['balance'] = profile.points
        return Response(data, status=201)

    @action(detail=False, methods=['post'], url_path='fulfillment')
    def update_fulfillment(self, request):
        user, err = require_user(request)
        if err:
            return err
        new_status = request.data.get('fulfillment_status')
        transaction_id = request.data.get('transaction_id')
        if new_status not in ('shipped', 'delivered'):
            return Response(
                {'error': 'fulfillment_status must be "shipped" or "delivered".'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            transaction_obj = Transaction.objects.select_related('item').get(pk=transaction_id)
        except Transaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not user.is_staff and transaction_obj.item.creator_id != user.id:
            return Response(
                {'error': 'Only the seller or an admin can update fulfillment for this order.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if transaction_obj.item.type != 'physical':
            return Response(
                {'error': 'Only physical item orders can be fulfilled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        transaction_obj.fulfillment_status = new_status
        transaction_obj.save(update_fields=['fulfillment_status'])
        serializer = TransactionSerializer(transaction_obj, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-sales')
    def my_sales(self, request):
        user, err = require_user(request)
        if err:
            return err
        items = ShopItem.objects.filter(creator_id=user.id).order_by('-created_at')
        sales = (
            Transaction.objects.filter(seller_id=user.id, status='completed')
            .select_related('item', 'user')
            .order_by('-timestamp')
        )
        revenue = sum(tx.amount for tx in sales)
        pending_fulfillment = sum(1 for tx in sales if tx.fulfillment_status == 'pending')
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models.functions import TruncDate
        since = timezone.now() - timedelta(days=28)
        sales_by_day = (
            sales.filter(timestamp__gte=since)
            .annotate(day=TruncDate('timestamp'))
            .values('day')
            .annotate(revenue=Sum('amount'), orders=Count('id'))
            .order_by('day')
        )
        item_serializer = ShopItemSerializer(items, many=True, context={'request': request})
        sales_serializer = TransactionSerializer(sales, many=True, context={'request': request})
        return Response({
            'revenue': revenue,
            'orders_count': sales.count(),
            'active_products': items.filter(is_available=True).count(),
            'pending_fulfillment': pending_fulfillment,
            'sales_by_day': [
                {
                    'day': row['day'].isoformat() if row['day'] else '',
                    'revenue': row['revenue'] or 0,
                    'orders': row['orders'] or 0,
                }
                for row in sales_by_day
            ],
            'items': item_serializer.data,
            'orders': sales_serializer.data,
        })


class TipView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """List tips this user sent or received (default: received)."""
        direction = request.query_params.get('direction', 'received')
        if direction == 'sent':
            qs = Tip.objects.filter(sender_id=request.user.id)
        else:
            qs = Tip.objects.filter(recipient_id=request.user.id)
        qs = qs.select_related('sender', 'recipient')[:50]
        return Response(TipSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        user, err = require_user(request)
        if err:
            return err

        recipient_id = request.data.get('recipient_id')
        try:
            amount = int(request.data.get('amount'))
        except (TypeError, ValueError):
            return Response({'error': 'amount must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({'error': 'amount must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)
        if not recipient_id or int(recipient_id) == user.id:
            return Response({'error': 'Invalid recipient.'}, status=status.HTTP_400_BAD_REQUEST)

        recipient = User.objects.filter(pk=recipient_id).first()
        if not recipient:
            return Response({'error': 'Recipient not found.'}, status=status.HTTP_404_NOT_FOUND)
        if is_blocked_between(user.id, recipient.id):
            return Response({'error': 'Cannot tip this user.'}, status=status.HTTP_403_FORBIDDEN)

        post_id = request.data.get('post_id')
        reel_id = request.data.get('reel_id')
        message = (request.data.get('message') or '').strip()[:200]

        with transaction.atomic():
            sender_profile = Profile.objects.select_for_update().get_or_create(user=user)[0]
            if sender_profile.points < amount:
                return Response(
                    {'error': 'Insufficient coins.', 'balance': sender_profile.points},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            recipient_profile = Profile.objects.select_for_update().get_or_create(user=recipient)[0]
            sender_profile.points = F('points') - amount
            sender_profile.save(update_fields=['points'])
            recipient_profile.points = F('points') + amount
            recipient_profile.save(update_fields=['points'])
            tip = Tip.objects.create(
                sender=user,
                recipient=recipient,
                amount=amount,
                post_id=post_id or None,
                reel_id=reel_id or None,
                message=message,
            )
            sender_profile.refresh_from_db(fields=['points'])

        try:
            from .spending import update_spender_tier
            update_spender_tier(user)
        except Exception:
            pass
        try:
            from notifications.utils import create_notification
            create_notification(
                recipient_id=recipient.id,
                actor_id=user.id,
                verb='tip',
                text=f'Tipped you {amount} ✨' + (f' — "{message}"' if message else ''),
                notification_type='shop',
            )
        except Exception:
            pass

        data = TipSerializer(tip, context={'request': request}).data
        data['balance'] = sender_profile.points
        return Response(data, status=status.HTTP_201_CREATED)


class CoinPackViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CoinPack.objects.filter(is_active=True)
    serializer_class = CoinPackSerializer
    permission_classes = [AllowAny]


class CreateCoinCheckoutView(APIView):
    """Starts a one-time Stripe Checkout session to convert real money into
    Outverse coins. Disabled (503) until STRIPE_SECRET_KEY is configured —
    mirrors subscriptions.views.CreateCheckoutSessionView's pattern."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        import os
        import stripe
        from django.conf import settings

        user, err = require_user(request)
        if err:
            return err
        if not settings.STRIPE_SECRET_KEY:
            return Response(
                {'error': 'Payments are not configured yet. Set STRIPE_SECRET_KEY to enable coin top-ups.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        pack_id = request.data.get('pack_id')
        try:
            pack = CoinPack.objects.get(pk=pack_id, is_active=True)
        except CoinPack.DoesNotExist:
            return Response({'error': 'Unknown coin pack.'}, status=status.HTTP_400_BAD_REQUEST)
        if not pack.stripe_price_id:
            return Response(
                {'error': f'Pack "{pack.name}" has no Stripe price configured yet.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        try:
            session = stripe.checkout.Session.create(
                mode='payment',
                line_items=[{'price': pack.stripe_price_id, 'quantity': 1}],
                success_url=f'{frontend_url}/wallet?checkout=success',
                cancel_url=f'{frontend_url}/wallet?checkout=cancelled',
                client_reference_id=str(user.id),
                metadata={
                    'type': 'coin_pack',
                    'user_id': str(user.id),
                    'pack_id': str(pack.id),
                    'coins': str(pack.coins),
                },
            )
        except stripe.error.StripeError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({'checkout_url': session.url})
