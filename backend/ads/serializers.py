from rest_framework import serializers

from .models import (
    AdCampaign,
    AdCreative,
    Ad,
    AdImpression,
    AdClick,
    AdConversion,
)


class AdCampaignSerializer(serializers.ModelSerializer):
    advertiser = serializers.StringRelatedField(read_only=True)
    reviewed_by = serializers.StringRelatedField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    can_be_activated = serializers.BooleanField(read_only=True)
    daily_spend_limit_reached = serializers.BooleanField(read_only=True)

    class Meta:
        model = AdCampaign
        fields = [
            'id', 'advertiser', 'name', 'status', 'objective', 'bid_strategy',
            'daily_budget', 'lifetime_budget', 'spent',
            'start_date', 'end_date', 'targeting',
            'created_at', 'updated_at', 'reviewed_at', 'reviewed_by',
            'is_active', 'can_be_activated', 'daily_spend_limit_reached',
        ]
        read_only_fields = [
            'advertiser', 'spent', 'created_at', 'updated_at',
            'reviewed_at', 'reviewed_by', 'is_active', 'can_be_activated', 'daily_spend_limit_reached',
        ]


class AdCampaignCreateSerializer(AdCampaignSerializer):
    """For creation — advertiser set from request user."""
    class Meta(AdCampaignSerializer.Meta):
        read_only_fields = ['id', 'advertiser', 'spent', 'is_active', 'can_be_activated', 'daily_spend_limit_reached',
                           'created_at', 'updated_at', 'reviewed_at', 'reviewed_by']


class AdCreativeSerializer(serializers.ModelSerializer):
    campaign = serializers.PrimaryKeyRelatedField(queryset=AdCampaign.objects.all())
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)

    class Meta:
        model = AdCreative
        fields = [
            'id', 'campaign', 'campaign_name', 'name', 'format', 'status',
            'media_urls', 'aspect_ratio', 'headline', 'primary_text',
            'description', 'cta_text', 'landing_url', 'utm_params',
            'created_at', 'updated_at', 'reviewed_at',
        ]
        read_only_fields = ['campaign_name', 'status', 'created_at', 'updated_at', 'reviewed_at']


class AdCreativeCreateSerializer(AdCreativeSerializer):
    """For creation — campaign set from context."""
    class Meta(AdCreativeSerializer.Meta):
        read_only_fields = ['campaign_name', 'status', 'created_at', 'updated_at', 'reviewed_at']


class AdSerializer(serializers.ModelSerializer):
    campaign = serializers.PrimaryKeyRelatedField(queryset=AdCampaign.objects.all())
    creative = AdCreativeSerializer(read_only=True)
    creative_id = serializers.PrimaryKeyRelatedField(
        queryset=AdCreative.objects.all(), source='creative', write_only=True,
    )
    campaign_name = serializers.CharField(source='campaign.name', read_only=True)
    ctr = serializers.SerializerMethodField()
    cpc = serializers.SerializerMethodField()
    cpm = serializers.SerializerMethodField()

    class Meta:
        model = Ad
        fields = [
            'id', 'campaign', 'campaign_name', 'creative', 'creative_id',
            'status', 'targeting_override',
            'impression_count', 'click_count', 'spend', 'ctr', 'cpc', 'cpm',
            'created_at', 'updated_at', 'last_delivered_at',
        ]
        read_only_fields = [
            'id', 'impression_count', 'click_count', 'spend',
            'ctr', 'cpc', 'cpm', 'created_at', 'updated_at', 'last_delivered_at',
        ]

    def get_ctr(self, obj):
        return obj.ctr

    def get_cpc(self, obj):
        return obj.cpc

    def get_cpm(self, obj):
        return obj.cpm


class AdImpressionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdImpression
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class AdClickSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdClick
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class AdConversionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdConversion
        fields = '__all__'
        read_only_fields = ['id', 'attributed_at']