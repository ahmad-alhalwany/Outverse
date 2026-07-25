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
    cover = serializers.SerializerMethodField()

    class Meta:
        model = ShopItem
        fields = [
            'id', 'name', 'description', 'price', 'type', 'type_display',
            'category', 'category_display', 'cover_url', 'download_url', 'cover', 'rating',
            'sales_count', 'is_featured', 'is_available', 'creator',
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
    class Meta:
        model = CoinPack
        fields = ['id', 'name', 'coins', 'price_usd_cents']
