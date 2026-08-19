import os

import stripe
from django.conf import settings
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from outverse.throttles import AnonReadThrottle, BurstThrottle, ContentScheduledCreateThrottle, ThrottleMixin

from outverse.auth_utils import require_user, user_from_request

from .models import (
    CREATOR_PAYOUT_COINS_PER_USD_CENT,
    PLATFORM_FEE_PERCENT,
    CreatorSubscription,
    CreatorSubscriptionPayout,
    CreatorTier,
    Subscription,
    SubscriptionPlan,
)
from .serializers import (
    CreatorSubscriptionSerializer,
    CreatorTierSerializer,
    SubscriberSerializer,
    SubscriptionPlanSerializer,
    SubscriptionSerializer,
)


def _stripe_configured():
    return bool(settings.STRIPE_SECRET_KEY)


class SubscriptionPlanViewSet(ThrottleMixin, viewsets.ReadOnlyModelViewSet):
    queryset = SubscriptionPlan.objects.all()
    throttle_scopes = {
        'create': 'content.post_create',
        'perform_create': 'content.post_create',
        'update': 'content.draft_write',
        'partial_update': 'content.draft_write',
        'perform_update': 'content.draft_write',
        'destroy': 'content.draft_write',
        'perform_destroy': 'content.draft_write',
        'list': 'anon.read',
        'retrieve': 'anon.read',
    }

    serializer_class = SubscriptionPlanSerializer
    permission_classes = [AllowAny]


class MySubscriptionView(APIView):
    throttle_classes = [BurstThrottle, ContentScheduledCreateThrottle]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subscription = Subscription.objects.select_related('plan').filter(user=request.user).first()
        if not subscription:
            return Response({'active': False, 'subscription': None})
        return Response({'active': subscription.is_active, 'subscription': SubscriptionSerializer(subscription).data})


class CreateCheckoutSessionView(APIView):
    throttle_classes = [BurstThrottle, ContentScheduledCreateThrottle]
    """Starts a Stripe Checkout session for the requested plan.

    Disabled (503) until STRIPE_SECRET_KEY is configured — Cosmic Pass ships
    fully wired, but real checkout only activates once real Stripe keys exist.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user, err = require_user(request)
        if err:
            return err
        if not _stripe_configured():
            return Response(
                {'error': 'Payments are not configured yet. Set STRIPE_SECRET_KEY to enable Cosmic Pass checkout.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        tier = request.data.get('tier')
        try:
            plan = SubscriptionPlan.objects.get(tier=tier)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Unknown plan.'}, status=status.HTTP_400_BAD_REQUEST)
        if not plan.stripe_price_id:
            return Response(
                {'error': f'Plan "{plan.name}" has no Stripe price configured yet.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        try:
            session = stripe.checkout.Session.create(
                mode='subscription',
                line_items=[{'price': plan.stripe_price_id, 'quantity': 1}],
                success_url=f'{frontend_url}/premium?checkout=success',
                cancel_url=f'{frontend_url}/premium?checkout=cancelled',
                client_reference_id=str(user.id),
                metadata={'user_id': str(user.id), 'tier': plan.tier},
            )
        except stripe.error.StripeError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({'checkout_url': session.url})


class CreatorTierViewSet(ThrottleMixin, viewsets.ModelViewSet):
    """A creator's paid perk tiers. Anyone can list a creator's active tiers
    (?creator=<id>); only the owning creator can create/edit/delete their own,
    capped at CreatorTier.MAX_TIERS_PER_CREATOR active tiers."""

    serializer_class = CreatorTierSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        qs = CreatorTier.objects.all()
        creator_id = self.request.query_params.get('creator')
        if creator_id:
            qs = qs.filter(creator_id=creator_id, is_active=True)
        elif self.action in ('list',):
            viewer = user_from_request(self.request)
            qs = qs.filter(creator_id=viewer.id) if viewer else qs.none()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        active_count = CreatorTier.objects.filter(creator=user, is_active=True).count()
        if active_count >= CreatorTier.MAX_TIERS_PER_CREATOR:
            raise ValidationError(
                f'You can only have up to {CreatorTier.MAX_TIERS_PER_CREATOR} active tiers.',
            )
        serializer.save(creator=user)

    def _check_reactivation_cap(self, request, tier):
        wants_active = request.data.get('is_active')
        if wants_active and not tier.is_active:
            active_count = CreatorTier.objects.filter(creator=tier.creator, is_active=True).exclude(pk=tier.pk).count()
            if active_count >= CreatorTier.MAX_TIERS_PER_CREATOR:
                return Response(
                    {'error': f'You can only have up to {CreatorTier.MAX_TIERS_PER_CREATOR} active tiers.'},
                    status=400,
                )
        return None

    def update(self, request, *args, **kwargs):
        tier = self.get_object()
        if tier.creator_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=403)
        cap_error = self._check_reactivation_cap(request, tier)
        if cap_error:
            return cap_error
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        tier = self.get_object()
        if tier.creator_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=403)
        cap_error = self._check_reactivation_cap(request, tier)
        if cap_error:
            return cap_error
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        tier = self.get_object()
        if tier.creator_id != request.user.id:
            return Response({'error': 'Forbidden.'}, status=403)
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {'error': 'This tier has subscribers and cannot be deleted. Deactivate it instead.'},
                status=400,
            )


class CreatorSubscriptionCheckoutView(APIView):
    throttle_classes = [BurstThrottle, ContentScheduledCreateThrottle]
    """Starts a Stripe Checkout session for a fan subscribing to one of a
    creator's tiers. Disabled (503) until STRIPE_SECRET_KEY is configured."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user, err = require_user(request)
        if err:
            return err
        if not _stripe_configured():
            return Response(
                {'error': 'Payments are not configured yet. Set STRIPE_SECRET_KEY to enable creator subscriptions.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        tier_id = request.data.get('tier_id')
        try:
            tier = CreatorTier.objects.select_related('creator').get(pk=tier_id, is_active=True)
        except CreatorTier.DoesNotExist:
            return Response({'error': 'Unknown tier.'}, status=status.HTTP_400_BAD_REQUEST)
        if tier.creator_id == user.id:
            return Response({'error': 'You cannot subscribe to your own tier.'}, status=status.HTTP_400_BAD_REQUEST)
        if not tier.stripe_price_id:
            return Response(
                {'error': f'Tier "{tier.name}" has no Stripe price configured yet.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        stripe.api_key = settings.STRIPE_SECRET_KEY
        frontend_url = os.environ.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        try:
            session = stripe.checkout.Session.create(
                mode='subscription',
                line_items=[{'price': tier.stripe_price_id, 'quantity': 1}],
                success_url=f'{frontend_url}/profile/{tier.creator_id}?checkout=success',
                cancel_url=f'{frontend_url}/profile/{tier.creator_id}?checkout=cancelled',
                client_reference_id=str(user.id),
                metadata={
                    'type': 'creator_sub',
                    'fan_id': str(user.id),
                    'creator_id': str(tier.creator_id),
                    'tier_id': str(tier.id),
                },
            )
        except stripe.error.StripeError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        return Response({'checkout_url': session.url})


class MyCreatorSubscriptionsView(APIView):
    throttle_classes = [BurstThrottle, ContentScheduledCreateThrottle]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        subs = CreatorSubscription.objects.select_related('tier', 'creator').filter(fan=request.user)
        return Response(CreatorSubscriptionSerializer(subs, many=True).data)


class CreatorSubscribersView(APIView):
    throttle_classes = [BurstThrottle, ContentScheduledCreateThrottle]
    """A creator's own subscriber list plus a lightweight earnings summary
    from recorded CreatorSubscriptionPayout rows."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum

        subs = CreatorSubscription.objects.select_related('tier', 'fan').filter(
            creator=request.user, status='active',
        )
        total_coins = CreatorSubscriptionPayout.objects.filter(
            subscription__creator=request.user,
        ).aggregate(total=Sum('coins_credited'))['total'] or 0
        return Response({
            'subscriber_count': subs.count(),
            'total_coins_earned': total_coins,
            'subscribers': SubscriberSerializer(subs, many=True).data,
        })


class StripeWebhookView(APIView):
    throttle_classes = [BurstThrottle, ContentScheduledCreateThrottle]
    permission_classes = [AllowAny]

    def post(self, request):
        if not _stripe_configured():
            return Response(status=status.HTTP_503_SERVICE_UNAVAILABLE)

        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
        except (ValueError, stripe.error.SignatureVerificationError):
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            metadata = session.get('metadata', {}) or {}
            user_id = metadata.get('user_id') or session.get('client_reference_id')

            if metadata.get('type') == 'coin_pack':
                self._credit_coin_pack(session, metadata, user_id)
            elif metadata.get('type') == 'creator_sub':
                self._activate_creator_subscription(session, metadata)
            else:
                tier = metadata.get('tier')
                if user_id and tier:
                    plan = SubscriptionPlan.objects.filter(tier=tier).first()
                    if plan:
                        Subscription.objects.update_or_create(
                            user_id=user_id,
                            defaults={
                                'plan': plan,
                                'status': 'active',
                                'stripe_customer_id': session.get('customer', ''),
                                'stripe_subscription_id': session.get('subscription', ''),
                            },
                        )
        elif event['type'] == 'invoice.payment_succeeded':
            self._credit_creator_payout(event['data']['object'])
        elif event['type'] == 'customer.subscription.deleted':
            stripe_sub_id = event['data']['object'].get('id')
            Subscription.objects.filter(stripe_subscription_id=stripe_sub_id).update(
                status='canceled', updated_at=timezone.now()
            )
            CreatorSubscription.objects.filter(stripe_subscription_id=stripe_sub_id).update(
                status='canceled', updated_at=timezone.now()
            )

        return Response(status=status.HTTP_200_OK)

    def _credit_coin_pack(self, session, metadata, user_id):
        """Credits Profile.points for a completed coin-pack Checkout session.
        Idempotent on the Stripe session id so a retried webhook delivery
        can't double-credit the same purchase."""
        from django.db import transaction as db_transaction

        from shop.models import CoinPack, CoinPurchase
        from users.models import Profile

        session_id = session.get('id', '')
        pack_id = metadata.get('pack_id')
        if not (user_id and pack_id and session_id):
            return
        if CoinPurchase.objects.filter(stripe_checkout_session_id=session_id).exists():
            return
        pack = CoinPack.objects.filter(pk=pack_id).first()
        if not pack:
            return
        with db_transaction.atomic():
            from django.db.models import F

            profile = Profile.objects.select_for_update().get_or_create(user_id=user_id)[0]
            profile.points = F('points') + pack.coins
            profile.save(update_fields=['points'])
            CoinPurchase.objects.create(
                user_id=user_id,
                pack=pack,
                coins=pack.coins,
                price_usd_cents=pack.price_usd_cents,
                stripe_checkout_session_id=session_id,
            )

    def _activate_creator_subscription(self, session, metadata):
        """First-payment activation — creates/reactivates the CreatorSubscription
        row. The actual points payout happens on invoice.payment_succeeded,
        which fires for this first invoice too, so it isn't duplicated here."""
        fan_id = metadata.get('fan_id')
        creator_id = metadata.get('creator_id')
        tier_id = metadata.get('tier_id')
        if not (fan_id and creator_id and tier_id):
            return
        tier = CreatorTier.objects.filter(pk=tier_id).first()
        if not tier:
            return
        CreatorSubscription.objects.update_or_create(
            fan_id=fan_id, creator_id=creator_id,
            defaults={
                'tier': tier,
                'status': 'active',
                'stripe_customer_id': session.get('customer', ''),
                'stripe_subscription_id': session.get('subscription', ''),
            },
        )

    def _credit_creator_payout(self, invoice):
        """Recurring (and first) successful charge on a creator-subscription:
        credit the creator PLATFORM_FEE_PERCENT-adjusted coins. Idempotent on
        the Stripe invoice id."""
        from django.db import transaction as db_transaction
        from django.db.models import F

        from users.models import Profile

        stripe_sub_id = invoice.get('subscription')
        invoice_id = invoice.get('id', '')
        amount_paid = invoice.get('amount_paid', 0)
        if not (stripe_sub_id and invoice_id and amount_paid):
            return
        subscription = CreatorSubscription.objects.filter(stripe_subscription_id=stripe_sub_id).first()
        if not subscription:
            return
        if CreatorSubscriptionPayout.objects.filter(stripe_invoice_id=invoice_id).exists():
            return
        creator_share_cents = amount_paid * (100 - PLATFORM_FEE_PERCENT) // 100
        coins = creator_share_cents * CREATOR_PAYOUT_COINS_PER_USD_CENT
        with db_transaction.atomic():
            profile = Profile.objects.select_for_update().get_or_create(user_id=subscription.creator_id)[0]
            profile.points = F('points') + coins
            profile.save(update_fields=['points'])
            CreatorSubscriptionPayout.objects.create(
                subscription=subscription,
                stripe_invoice_id=invoice_id,
                amount_usd_cents=amount_paid,
                coins_credited=coins,
            )
