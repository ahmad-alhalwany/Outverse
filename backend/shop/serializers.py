from rest_framework import serializers

from users.models import User

from .models import CoinPack, ShopItem, Tip, Transaction


class ShopCreatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class ShopItemSerializer(serializers.ModelSerializer):
    creator = ShopCreatorSerializer(read_only=True)
    creator_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='creator',
        write_only=True,
        required=False,
        allow_null=True,
    )
    type_display = serializers.CharField(
        source='get_type_display', read_only=True
    )
    category_display = serializers.CharField(
        source='get_category_display', read_only=True
    )
    idea_kind_display = serializers.CharField(
        source='get_idea_kind_display', read_only=True
    )
    cover = serializers.SerializerMethodField()
    content_locked = serializers.SerializerMethodField()

    class Meta:
        model = ShopItem
        fields = [
            'id', 'name', 'description', 'price', 'type', 'type_display',
            'category', 'category_display', 'cover_url', 'download_url', 'cover', 'rating',
            'sales_count', 'stock', 'idea_kind', 'idea_kind_display', 'unlock_at',
            'content_locked', 'is_featured', 'is_available', 'creator',
            'creator_id', 'created_at',
        ]
        read_only_fields = ['rating', 'sales_count', 'created_at']

    def get_cover(self, obj):
        if obj.cover_url:
            return obj.cover_url
        if obj.image:
            request = self.context.get('request')
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return ''

    def _viewer_unlocked_via_purchase(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if not user or not user.is_authenticated:
            return False
        return Transaction.objects.filter(
            user_id=user.id, item_id=obj.id, status='completed'
        ).exists()

    def get_content_locked(self, obj):
        if obj.idea_kind not in ('blind_drop', 'bottle'):
            return False
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        if user and user.is_authenticated and (user.is_staff or obj.creator_id == user.id):
            return False
        if not self._viewer_unlocked_via_purchase(obj):
            return True
        if obj.idea_kind == 'bottle' and not obj.is_unlocked:
            return True
        return False

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('content_locked'):
            data['description'] = ''
            data['download_url'] = ''
        return data


class TransactionSerializer(serializers.ModelSerializer):
    item = ShopItemSerializer(read_only=True)
    fulfillment_status_display = serializers.CharField(
        source='get_fulfillment_status_display', read_only=True
    )
    buyer_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'user', 'buyer_username', 'item', 'amount', 'status', 'timestamp',
            'shipping_address', 'fulfillment_status', 'fulfillment_status_display',
        ]


class TipUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'avatar']


class TipSerializer(serializers.ModelSerializer):
    sender = TipUserSerializer(read_only=True)
    recipient = TipUserSerializer(read_only=True)

    class Meta:
        model = Tip
        fields = [
            'id', 'sender', 'recipient', 'amount', 'post', 'reel', 'message', 'created_at',
        ]
        read_only_fields = fields


class CoinPackSerializer(serializers.ModelSerializer):
    available = serializers.SerializerMethodField()

    class Meta:
        model = CoinPack
        fields = ['id', 'name', 'coins', 'price_usd_cents', 'available']

    def get_available(self, obj):
        # Checkout is disabled server-side until a real Stripe price is
        # attached — expose that as a plain flag instead of the raw id.
        return bool(obj.stripe_price_id)
