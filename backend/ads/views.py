"""
Ads API Views — Campaign, Creative, Ad management + Delivery endpoints.
"""
from __future__ import annotations

import secrets
from decimal import Decimal

import random

from django.db import transaction
from django.db.models import F, Q, Sum
from django.utils import timezone
from rest_framework import serializers, viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from outverse.auth_utils import require_user, user_from_request
from outverse.throttles import (
    BurstThrottle,
    SustainedThrottle,
    ContentPostCreateThrottle,
    AnonReadThrottle,
)

from .models import AdCampaign, AdCreative, Ad, AdImpression, AdClick, AdConversion
from .serializers import (
    AdCampaignSerializer, AdCampaignCreateSerializer,
    AdCreativeSerializer, AdCreativeCreateSerializer,
    AdSerializer,
    AdImpressionSerializer, AdClickSerializer, AdConversionSerializer,
)

# =============================================================================
# Ad Campaign ViewSet
# =============================================================================

class AdCampaignViewSet(viewsets.ModelViewSet):
    """Advertiser-facing campaign management."""
    queryset = AdCampaign.objects.select_related('advertiser', 'reviewed_by').all()
    serializer_class = AdCampaignSerializer
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AdCampaignCreateSerializer
        return AdCampaignSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and not user.is_staff:
            # Advertiser: own campaigns (all statuses) — this is their dashboard.
            qs = qs.filter(advertiser=user)
        elif not user.is_authenticated:
            # Public/anonymous: only active campaigns (list AND retrieve).
            qs = qs.filter(status='active')
        # Staff sees all
        return qs

    def perform_create(self, serializer):
        serializer.save(advertiser=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.advertiser_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not your campaign.'}, status=403)
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        # Advertisers cannot force-activate a draft/rejected campaign.
        if (
            data.get('status') == 'active'
            and instance.status not in ('active', 'paused')
            and not request.user.is_staff
        ):
            data['status'] = 'pending_review'
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        campaign = self.get_object()
        if campaign.advertiser_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not your campaign.'}, status=403)
        campaign.status = 'paused'
        campaign.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(campaign).data)

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        campaign = self.get_object()
        if campaign.advertiser_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not your campaign.'}, status=403)
        if not campaign.can_be_activated:
            return Response({'detail': 'Campaign cannot be resumed (budget exhausted or schedule ended).'}, status=400)
        campaign.status = 'active'
        campaign.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(campaign).data)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """
        Activate a draft/paused campaign.

        Checks and deducts Outverse coins from the advertiser wallet as escrow.
        Exchange rate: 100 coins = $1 USD.  The full remaining budget (lifetime_budget
        minus already-spent) is debited on first activation.  Insufficient balance
        returns HTTP 402.
        """
        from users.models import Profile
        from django.db import transaction as db_transaction

        campaign = self.get_object()
        if campaign.advertiser_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not your campaign.'}, status=403)
        if campaign.status == 'active':
            return Response({'detail': 'Campaign is already active.'}, status=400)
        if not campaign.can_be_activated:
            return Response(
                {'detail': 'Campaign cannot be activated (budget exhausted or schedule ended).'},
                status=400,
            )

        COINS_PER_DOLLAR = Decimal('100')
        remaining_budget = campaign.lifetime_budget - campaign.spent
        coins_needed = int((remaining_budget * COINS_PER_DOLLAR).to_integral_value())

        with db_transaction.atomic():
            profile = Profile.objects.select_for_update().get_or_create(user=campaign.advertiser)[0]
            if profile.points < coins_needed:
                return Response(
                    {
                        'detail': (
                            f'Insufficient coins. Need {coins_needed} coins '
                            f'(≈ ${float(remaining_budget):.2f} budget). '
                            f'Current balance: {profile.points} coins.'
                        ),
                        'coins_needed': coins_needed,
                        'coins_balance': profile.points,
                    },
                    status=402,
                )
            profile.points = F('points') - coins_needed
            profile.save(update_fields=['points'])
            campaign.status = 'active'
            campaign.save(update_fields=['status', 'updated_at'])

        return Response({
            **self.get_serializer(campaign).data,
            'coins_debited': coins_needed,
        })

    @action(detail=True, methods=['get'])
    def stats(self, request, pk=None):
        """Aggregated stats for a campaign."""
        campaign = self.get_object()
        if campaign.advertiser_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not your campaign.'}, status=403)

        today = timezone.now().date()
        week_ago = today - timezone.timedelta(days=7)

        # Last 7 days impressions/clicks/spend
        daily = campaign.impressions.filter(created_at__date__gte=week_ago).values('created_at__date').annotate(
            imps=Sum('id'),  # count
            spend=Sum('cost'),
        ).order_by('created_at__date')

        # This is simplified — in production use proper aggregations
        total_impressions = campaign.impressions.count()
        total_clicks = campaign.clicks.count()
        total_conversions = campaign.conversions.count()
        total_spend = float(campaign.spent)

        return Response({
            'campaign_id': campaign.id,
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'total_conversions': total_conversions,
            'total_spend': total_spend,
            'ctr': round((total_clicks / total_impressions * 100) if total_impressions else 0, 2),
            'cpc': round(total_spend / total_clicks, 4) if total_clicks else 0,
            'cpm': round((total_spend / total_impressions * 1000) if total_impressions else 0, 4),
            'daily': list(daily),
        })


# =============================================================================
# Ad Creative ViewSet
# =============================================================================

class AdCreativeViewSet(viewsets.ModelViewSet):
    """Creative management within a campaign."""
    queryset = AdCreative.objects.select_related('campaign').all()
    serializer_class = AdCreativeSerializer
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AdCreativeCreateSerializer
        return AdCreativeSerializer

    def get_permissions(self):
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        if not self.request.user.is_staff:
            qs = qs.filter(campaign__advertiser=self.request.user)
        campaign_id = self.request.query_params.get('campaign')
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        campaign_id = self.request.data.get('campaign')
        if not campaign_id:
            raise ValidationError({'campaign': 'Required.'})
        from .models import AdCampaign
        try:
            campaign = AdCampaign.objects.get(pk=campaign_id)
        except AdCampaign.DoesNotExist:
            raise ValidationError({'campaign': 'Not found.'})
        if campaign.advertiser_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('Not your campaign.')
        serializer.save(campaign=campaign)

    @action(detail=True, methods=['post'], permission_classes=[])
    def approve(self, request, pk=None):
        """Staff-only: approve a pending creative."""
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response({'detail': 'Staff access required.'}, status=403)
        creative = self.get_object()
        creative.status = 'approved'
        creative.reviewed_at = timezone.now()
        creative.save(update_fields=['status', 'reviewed_at'])
        from audit.utils import log_action
        log_action(request, 'MODERATE', f'Approved ad creative #{creative.id}.')
        return Response(AdCreativeSerializer(creative).data)

    @action(detail=True, methods=['post'], permission_classes=[])
    def reject(self, request, pk=None):
        """Staff-only: reject a pending creative."""
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response({'detail': 'Staff access required.'}, status=403)
        creative = self.get_object()
        creative.status = 'rejected'
        creative.reviewed_at = timezone.now()
        creative.save(update_fields=['status', 'reviewed_at'])
        from audit.utils import log_action
        log_action(request, 'MODERATE', f'Rejected ad creative #{creative.id}.')
        return Response(AdCreativeSerializer(creative).data)


# =============================================================================
# Ad ViewSet
# =============================================================================

class AdViewSet(viewsets.ModelViewSet):
    """Runtime ad — delivery management."""
    queryset = Ad.objects.select_related('campaign', 'creative').all()
    serializer_class = AdSerializer
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_authenticated and not user.is_staff:
            # Advertiser: own ads (all statuses) — this is their dashboard.
            qs = qs.filter(campaign__advertiser=user)
        elif not user.is_authenticated:
            # Public/anonymous: only active ads (list AND retrieve).
            qs = qs.filter(status='active')
        campaign_id = self.request.query_params.get('campaign')
        if campaign_id:
            qs = qs.filter(campaign_id=campaign_id)
        return qs

    def perform_create(self, serializer):
        creative_id = self.request.data.get('creative') or self.request.data.get('creative_id')
        if not creative_id:
            raise ValidationError({'creative_id': 'Required.'})
        from .models import AdCreative, AdCampaign
        try:
            creative = AdCreative.objects.select_related('campaign').get(pk=creative_id)
        except AdCreative.DoesNotExist:
            raise ValidationError({'creative_id': 'Not found.'})
        if creative.campaign.advertiser_id != self.request.user.id and not self.request.user.is_staff:
            raise PermissionDenied('Not your campaign.')
        serializer.save(campaign=creative.campaign, creative=creative)

    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        ad = self.get_object()
        if ad.campaign.advertiser_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not your ad.'}, status=403)
        ad.status = 'paused'
        ad.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(ad).data)

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        ad = self.get_object()
        if ad.campaign.advertiser_id != request.user.id and not request.user.is_staff:
            return Response({'detail': 'Not your ad.'}, status=403)
        if not ad.campaign.is_active:
            return Response({'detail': 'Parent campaign not active.'}, status=400)
        ad.status = 'active'
        ad.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(ad).data)


# =============================================================================
# Delivery Endpoints (Public — called by frontend to log impressions/clicks)
# =============================================================================

class AdDeliveryViewSet(viewsets.ViewSet):
    """
    Public endpoints for ad delivery tracking.
    Called by frontend when ad is shown/clicked.
    """
    permission_classes = [AllowAny]
    throttle_classes = [AnonReadThrottle]

    VALID_PLACEMENTS = {'feed', 'stories', 'reels', 'explore', 'profile'}

    def list(self, request):
        """
        Select an ad to deliver for a placement.
        Query params: placement (default 'feed')
        Returns a list with 0 or 1 ad — the frontend takes the first result.
        """
        placement = request.query_params.get('placement', 'feed')
        if placement not in self.VALID_PLACEMENTS:
            placement = 'feed'
        now = timezone.now()

        candidates = (
            Ad.objects.filter(
                status='active',
                creative__status='approved',
                campaign__status='active',
                campaign__start_date__lte=now,
                campaign__spent__lt=F('campaign__lifetime_budget'),
            )
            .filter(Q(campaign__end_date__isnull=True) | Q(campaign__end_date__gte=now))
            .select_related('campaign', 'creative')
        )

        eligible = []
        for ad in candidates:
            placements = ad.targeting_override.get('placements') or ad.campaign.targeting.get('placements')
            if placements and placement not in placements:
                continue
            if ad.campaign.daily_spend_limit_reached:
                continue
            eligible.append(ad)

        if not eligible:
            return Response([])

        chosen = random.choice(eligible)
        Ad.objects.filter(pk=chosen.pk).update(last_delivered_at=now)
        return Response([AdSerializer(chosen).data])

    @action(detail=False, methods=['post'], url_path='impression')
    def log_impression(self, request):
        """
        Log an ad impression. Frontend calls this when ad enters viewport.
        Body: { ad_id, placement, session_id?, content_type?, content_id? }
        Returns: { success: true, ad_data: {...} }
        """
        ad_id = request.data.get('ad_id')
        placement = request.data.get('placement', 'feed')
        session_id = request.data.get('session_id', '')
        content_type = request.data.get('content_type', '')
        content_id = request.data.get('content_id')

        if not ad_id:
            return Response({'error': 'ad_id required'}, status=400)

        try:
            ad = Ad.objects.select_related('campaign', 'creative').get(
                pk=ad_id, status='active'
            )
        except Ad.DoesNotExist:
            return Response({'error': 'Ad not found or not active'}, status=404)

        campaign = ad.campaign
        if not campaign.is_active:
            return Response({'error': 'Campaign not active'}, status=404)

        # Check daily budget
        if campaign.daily_spend_limit_reached:
            return Response({'error': 'Daily budget reached'}, status=429)

        # CPM cost calculation — rate sourced from settings (ADS_CPM_RATE, default $5.00)
        from django.conf import settings as _settings
        cpm_rate = Decimal(str(_settings.ADS_CPM_RATE))
        cost = (cpm_rate / Decimal('1000')).quantize(Decimal('0.000001'))

        # Get geo from request (simplified)
        country = getattr(request, 'country', '') or ''
        city = getattr(request, 'city', '') or ''

        impression = AdImpression.objects.create(
            ad=ad,
            campaign=campaign,
            creative=ad.creative,
            user=request.user if request.user.is_authenticated else None,
            session_id=session_id[:64],
            placement=placement[:20],
            content_type=content_type[:20],
            content_id=content_id,
            country=country[:2],
            city=city[:100],
            device_type='',  # Could parse from user-agent
            os='',
            browser='',
            cost=cost,
            bid_price=cost,
        )

        return Response({
            'success': True,
            'impression_id': impression.id,
            'ad': AdSerializer(ad).data,
        })

    @action(detail=False, methods=['post'], url_path='click')
    def log_click(self, request):
        """
        Log an ad click. Frontend calls this on click.
        Body: { impression_id, landing_url?, referrer_url? }
        Returns: { success: true, redirect_url: '...' }
        """
        impression_id = request.data.get('impression_id')
        landing_url = request.data.get('landing_url', '')
        referrer_url = request.data.get('referrer_url', '')

        if not impression_id:
            return Response({'error': 'impression_id required'}, status=400)

        try:
            impression = AdImpression.objects.select_related('ad', 'campaign').get(pk=impression_id)
        except AdImpression.DoesNotExist:
            return Response({'error': 'Impression not found'}, status=404)

        ad = impression.ad
        campaign = impression.campaign

        # CPC cost calculation — rate sourced from settings (ADS_CPC_RATE, default $0.50)
        from django.conf import settings as _settings
        cpc_rate = Decimal(str(_settings.ADS_CPC_RATE))
        cost = cpc_rate

        click = AdClick.objects.create(
            impression=impression,
            ad=ad,
            campaign=campaign,
            user=request.user if request.user.is_authenticated else None,
            session_id=impression.session_id,
            cost=cost,
            referrer_url=referrer_url[:500],
            landing_url=landing_url or ad.creative.landing_url,
        )

        # Return the landing URL with UTM params for tracking
        redirect_url = ad.creative.landing_url
        utm = ad.creative.utm_params or {}
        if utm:
            from urllib.parse import urlencode
            separator = '&' if '?' in redirect_url else '?'
            redirect_url += separator + urlencode(utm)
        redirect_url += ('&' if '?' in redirect_url else '?') + f'ad_click_id={click.id}'

        return Response({
            'success': True,
            'click_id': click.id,
            'redirect_url': redirect_url,
        })


# =============================================================================
# Reporting ViewSet (Advertiser only)
# =============================================================================

class AdReportViewSet(viewsets.ViewSet):
    """Aggregated reporting for advertisers."""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Summary across all campaigns for the advertiser."""
        user = request.user
        campaigns = AdCampaign.objects.filter(advertiser=user)

        total_spent = campaigns.aggregate(total=Sum('spent'))['total'] or Decimal('0')
        total_impressions = AdImpression.objects.filter(campaign__in=campaigns).count()
        total_clicks = AdClick.objects.filter(campaign__in=campaigns).count()
        total_conversions = AdConversion.objects.filter(campaign__in=campaigns).count()

        # By campaign
        by_campaign = []
        for c in campaigns:
            imps = c.impressions.count()
            cls = c.clicks.count()
            conv = c.conversions.count()
            by_campaign.append({
                'campaign_id': c.id,
                'name': c.name,
                'status': c.status,
                'impressions': imps,
                'clicks': cls,
                'conversions': conv,
                'spend': float(c.spent),
                'ctr': round((cls / imps * 100) if imps else 0, 2),
                'cpc': round(float(c.spent) / cls, 4) if cls else 0,
            })

        return Response({
            'total_spent': float(total_spent),
            'total_impressions': total_impressions,
            'total_clicks': total_clicks,
            'total_conversions': total_conversions,
            'overall_ctr': round((total_clicks / total_impressions * 100) if total_impressions else 0, 2),
            'by_campaign': by_campaign,
        })

    @action(detail=False, methods=['get'])
    def campaign_detail(self, request):
        """Detailed report for a single campaign."""
        campaign_id = request.query_params.get('campaign_id')
        if not campaign_id:
            return Response({'error': 'campaign_id required'}, status=400)

        try:
            campaign = AdCampaign.objects.get(pk=campaign_id, advertiser=request.user)
        except AdCampaign.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)

        # Daily breakdown (last 30 days)
        from datetime import timedelta
        end = timezone.now().date()
        start = end - timedelta(days=30)

        daily = campaign.impressions.filter(created_at__date__range=[start, end]).extra(
            select={'date': 'date(created_at)'}
        ).values('date').annotate(
            impressions=Sum('id'),
            spend=Sum('cost'),
        ).order_by('date')

        clicks_daily = campaign.clicks.filter(created_at__date__range=[start, end]).extra(
            select={'date': 'date(created_at)'}
        ).values('date').annotate(
            clicks=Sum('id'),
        ).order_by('date')

        return Response({
            'campaign': AdCampaignSerializer(campaign).data,
            'daily': list(daily),
            'clicks_daily': list(clicks_daily),
        })