from rest_framework import serializers

from .models import CreatorSubscription, CreatorTier, Subscription, SubscriptionPlan


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    price_usd = serializers.SerializerMethodField()
    available = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = ['id', 'tier', 'name', 'price_usd_cents', 'price_usd', 'features', 'is_recommended', 'available']

    def get_price_usd(self, obj):
        return round(obj.price_usd_cents / 100, 2)

    def get_available(self, obj):
        # Checkout is disabled server-side until a real Stripe price is
        # attached — expose that as a plain flag instead of the raw id.
        return bool(obj.stripe_price_id)


class SubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)

    class Meta:
        model = Subscription
        fields = ['id', 'plan', 'status', 'current_period_end', 'created_at']


class CreatorTierSerializer(serializers.ModelSerializer):
    price_usd = serializers.SerializerMethodField()

    class Meta:
        model = CreatorTier
        fields = [
            'id', 'creator', 'name', 'description', 'price_usd_cents', 'price_usd',
            'is_active', 'sort_order', 'created_at',
        ]
        read_only_fields = ['id', 'creator', 'created_at']

    def get_price_usd(self, obj):
        return round(obj.price_usd_cents / 100, 2)

    def validate_price_usd_cents(self, value):
        if value < 100:
            raise serializers.ValidationError('Minimum tier price is $1.00.')
        return value


class CreatorSubscriptionSerializer(serializers.ModelSerializer):
    tier = CreatorTierSerializer(read_only=True)
    creator_username = serializers.CharField(source='creator.username', read_only=True)

    class Meta:
        model = CreatorSubscription
        fields = ['id', 'creator', 'creator_username', 'tier', 'status', 'current_period_end', 'created_at']


class SubscriberSerializer(serializers.ModelSerializer):
    fan_username = serializers.CharField(source='fan.username', read_only=True)
    tier_name = serializers.CharField(source='tier.name', read_only=True)

    class Meta:
        model = CreatorSubscription
        fields = ['id', 'fan_username', 'tier_name', 'status', 'current_period_end', 'created_at']
