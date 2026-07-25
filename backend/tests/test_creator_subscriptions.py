"""Automated coverage for creator-fan paid subscriptions.

Full end-to-end checkout against real Stripe test-mode API keys isn't
possible in this environment (no Stripe test credentials are configured
here, and fabricating them isn't appropriate) — this suite instead mocks
Stripe's SDK at the boundary (stripe.Webhook.construct_event and
stripe.checkout.Session.create) so the webhook/checkout *handling logic*
itself gets real, durable regression coverage instead of relying on
one-off manual curl checks.
"""
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from subscriptions.models import (
    CREATOR_PAYOUT_COINS_PER_USD_CENT,
    PLATFORM_FEE_PERCENT,
    CreatorSubscription,
    CreatorSubscriptionPayout,
    CreatorTier,
)
from users.models import Profile


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def creator(django_user_model):
    return django_user_model.objects.create_user(
        username='creator1', email='creator1@example.com', password='pass1234', is_verified=True,
    )


@pytest.fixture
def fan(django_user_model):
    return django_user_model.objects.create_user(
        username='fan1', email='fan1@example.com', password='pass1234', is_verified=True,
    )


@pytest.fixture
def tier(creator):
    return CreatorTier.objects.create(
        creator=creator, name='Supporter', price_usd_cents=500, stripe_price_id='price_test_123',
    )


# ---- CreatorTier management ----

@pytest.mark.django_db
def test_creator_tier_cap_enforced(api_client, creator):
    api_client.force_authenticate(user=creator)
    for i in range(CreatorTier.MAX_TIERS_PER_CREATOR):
        res = api_client.post('/api/subscriptions/creator-tiers/', {
            'name': f'Tier {i}', 'price_usd_cents': 300 + i,
        }, format='json')
        assert res.status_code == 201, res.content

    res = api_client.post('/api/subscriptions/creator-tiers/', {
        'name': 'One too many', 'price_usd_cents': 999,
    }, format='json')
    assert res.status_code == 400
    assert CreatorTier.objects.filter(creator=creator).count() == CreatorTier.MAX_TIERS_PER_CREATOR


@pytest.mark.django_db
def test_creator_tier_ownership_enforced(api_client, creator, fan, tier):
    api_client.force_authenticate(user=fan)
    res = api_client.patch(f'/api/subscriptions/creator-tiers/{tier.id}/', {'name': 'Hijacked'}, format='json')
    assert res.status_code == 403

    res = api_client.delete(f'/api/subscriptions/creator-tiers/{tier.id}/')
    assert res.status_code == 403
    assert CreatorTier.objects.filter(pk=tier.id).exists()


@pytest.mark.django_db
def test_creator_tier_list_is_public(api_client, creator, tier):
    res = api_client.get(f'/api/subscriptions/creator-tiers/?creator={creator.id}')
    assert res.status_code == 200
    assert any(row['id'] == tier.id for row in res.data['results'])


# ---- Checkout ----

@pytest.mark.django_db
def test_checkout_disabled_without_stripe_key(api_client, fan, tier, settings):
    settings.STRIPE_SECRET_KEY = ''
    api_client.force_authenticate(user=fan)
    res = api_client.post('/api/subscriptions/creator-subscriptions/checkout/', {'tier_id': tier.id}, format='json')
    assert res.status_code == 503


@pytest.mark.django_db
def test_cannot_subscribe_to_own_tier(api_client, creator, tier, settings):
    settings.STRIPE_SECRET_KEY = 'sk_test_fake'
    api_client.force_authenticate(user=creator)
    res = api_client.post('/api/subscriptions/creator-subscriptions/checkout/', {'tier_id': tier.id}, format='json')
    assert res.status_code == 400
    assert 'own tier' in res.data['error']


@pytest.mark.django_db
def test_checkout_creates_stripe_session(api_client, fan, tier, settings):
    settings.STRIPE_SECRET_KEY = 'sk_test_fake'
    api_client.force_authenticate(user=fan)
    fake_session = SimpleNamespace(url='https://checkout.stripe.com/test-session')
    with patch('subscriptions.views.stripe.checkout.Session.create', return_value=fake_session) as mock_create:
        res = api_client.post('/api/subscriptions/creator-subscriptions/checkout/', {'tier_id': tier.id}, format='json')
    assert res.status_code == 200, res.content
    assert res.data['checkout_url'] == 'https://checkout.stripe.com/test-session'
    _, kwargs = mock_create.call_args
    assert kwargs['metadata']['type'] == 'creator_sub'
    assert kwargs['metadata']['tier_id'] == str(tier.id)


# ---- Webhook: checkout.session.completed (creator_sub) ----

def _mock_construct_event(event_type, data_object):
    return {'type': event_type, 'data': {'object': data_object}}


@pytest.mark.django_db
def test_webhook_activates_creator_subscription(api_client, creator, fan, tier, settings):
    settings.STRIPE_SECRET_KEY = 'sk_test_fake'
    settings.STRIPE_WEBHOOK_SECRET = 'whsec_fake'
    session = {
        'id': 'cs_test_1',
        'customer': 'cus_test_1',
        'subscription': 'sub_test_1',
        'metadata': {
            'type': 'creator_sub',
            'fan_id': str(fan.id),
            'creator_id': str(creator.id),
            'tier_id': str(tier.id),
        },
    }
    event = _mock_construct_event('checkout.session.completed', session)
    with patch('subscriptions.views.stripe.Webhook.construct_event', return_value=event):
        res = api_client.post(
            '/api/subscriptions/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )
    assert res.status_code == 200

    sub = CreatorSubscription.objects.get(fan=fan, creator=creator)
    assert sub.status == 'active'
    assert sub.tier_id == tier.id
    assert sub.stripe_subscription_id == 'sub_test_1'


# ---- Webhook: invoice.payment_succeeded (payout crediting) ----

@pytest.mark.django_db
def test_webhook_credits_creator_payout(api_client, creator, fan, tier, settings):
    settings.STRIPE_SECRET_KEY = 'sk_test_fake'
    settings.STRIPE_WEBHOOK_SECRET = 'whsec_fake'
    sub = CreatorSubscription.objects.create(
        fan=fan, creator=creator, tier=tier, status='active', stripe_subscription_id='sub_test_2',
    )
    starting_points = Profile.objects.get_or_create(user=creator)[0].points

    invoice = {'id': 'in_test_1', 'subscription': 'sub_test_2', 'amount_paid': 500}
    event = _mock_construct_event('invoice.payment_succeeded', invoice)
    with patch('subscriptions.views.stripe.Webhook.construct_event', return_value=event):
        res = api_client.post(
            '/api/subscriptions/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )
    assert res.status_code == 200

    expected_cents = 500 * (100 - PLATFORM_FEE_PERCENT) // 100
    expected_coins = expected_cents * CREATOR_PAYOUT_COINS_PER_USD_CENT

    profile = Profile.objects.get(user=creator)
    assert profile.points == starting_points + expected_coins

    payout = CreatorSubscriptionPayout.objects.get(subscription=sub, stripe_invoice_id='in_test_1')
    assert payout.coins_credited == expected_coins
    assert payout.amount_usd_cents == 500


@pytest.mark.django_db
def test_webhook_payout_idempotent_on_retry(api_client, creator, fan, tier, settings):
    """A retried webhook delivery for the same invoice must not double-credit."""
    settings.STRIPE_SECRET_KEY = 'sk_test_fake'
    settings.STRIPE_WEBHOOK_SECRET = 'whsec_fake'
    CreatorSubscription.objects.create(
        fan=fan, creator=creator, tier=tier, status='active', stripe_subscription_id='sub_test_3',
    )
    invoice = {'id': 'in_test_2', 'subscription': 'sub_test_3', 'amount_paid': 500}
    event = _mock_construct_event('invoice.payment_succeeded', invoice)

    with patch('subscriptions.views.stripe.Webhook.construct_event', return_value=event):
        res1 = api_client.post(
            '/api/subscriptions/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )
        points_after_first = Profile.objects.get(user=creator).points
        res2 = api_client.post(
            '/api/subscriptions/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )
        points_after_second = Profile.objects.get(user=creator).points

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert points_after_first == points_after_second
    assert CreatorSubscriptionPayout.objects.filter(stripe_invoice_id='in_test_2').count() == 1


# ---- Webhook: customer.subscription.deleted (cancellation) ----

@pytest.mark.django_db
def test_webhook_cancels_creator_subscription(api_client, creator, fan, tier, settings):
    settings.STRIPE_SECRET_KEY = 'sk_test_fake'
    settings.STRIPE_WEBHOOK_SECRET = 'whsec_fake'
    sub = CreatorSubscription.objects.create(
        fan=fan, creator=creator, tier=tier, status='active', stripe_subscription_id='sub_test_4',
    )
    event = _mock_construct_event('customer.subscription.deleted', {'id': 'sub_test_4'})
    with patch('subscriptions.views.stripe.Webhook.construct_event', return_value=event):
        res = api_client.post(
            '/api/subscriptions/webhook/', data=b'{}', content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=fake',
        )
    assert res.status_code == 200
    sub.refresh_from_db()
    assert sub.status == 'canceled'


# ---- Content gating sanity check (subscriber-only posts) ----

@pytest.mark.django_db
def test_active_subscription_unlocks_gated_post(api_client, creator, fan, tier):
    from posts.models import Post

    post = Post.objects.create(user=creator, text='members only', visibility='subscribers')
    api_client.force_authenticate(user=fan)

    # Not subscribed yet -> hidden from the author's feed.
    res = api_client.get(f'/api/posts/?author={creator.id}')
    ids = [row['id'] for row in (res.data if isinstance(res.data, list) else res.data['results'])]
    assert post.id not in ids

    CreatorSubscription.objects.create(fan=fan, creator=creator, tier=tier, status='active')
    res = api_client.get(f'/api/posts/?author={creator.id}')
    ids = [row['id'] for row in (res.data if isinstance(res.data, list) else res.data['results'])]
    assert post.id in ids
