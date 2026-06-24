from django.core.cache import cache
from django.db import transaction
from django.db.models import F
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user

from users.models import Profile, User

from .models import ShopItem, Transaction
from .serializers import ShopItemSerializer, TransactionSerializer


def _profile_for_user(user_id):
    user = User.objects.get(pk=user_id)
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile


class ShopItemViewSet(viewsets.ModelViewSet):
    serializer_class = ShopItemSerializer

    def get_permissions(self):
        if self.action in ('wallet', 'purchase', 'transactions'):
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
        with transaction.atomic():
            item = ShopItem.objects.select_for_update().get(pk=pk)
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
                item=item,
                amount=item.price,
                status='completed',
            )
            ShopItem.objects.filter(pk=item.pk).update(sales_count=F('sales_count') + 1)
            profile.refresh_from_db(fields=['points'])
            item.refresh_from_db(fields=['sales_count'])
        serializer = TransactionSerializer(
            transaction_obj, context={'request': request}
        )
        data = serializer.data
        data['balance'] = profile.points
        return Response(data, status=201)
