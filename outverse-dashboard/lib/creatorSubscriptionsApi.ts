import { apiFetch, apiFetchJson } from './api';

export type CreatorTier = {
  id: number;
  creator: number;
  name: string;
  description: string;
  price_usd_cents: number;
  price_usd: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

export type CreatorSubscription = {
  id: number;
  creator: number;
  creator_username: string;
  tier: CreatorTier;
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: string | null;
  created_at: string;
};

export type Subscriber = {
  id: number;
  fan_username: string;
  tier_name: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
};

export type SubscribersSummary = {
  subscriber_count: number;
  total_coins_earned: number;
  subscribers: Subscriber[];
};

export async function fetchCreatorTiers(creatorId: number | string): Promise<CreatorTier[]> {
  const res = await apiFetch(`subscriptions/creator-tiers/?creator=${creatorId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function fetchMyTiers(): Promise<CreatorTier[]> {
  const res = await apiFetch('subscriptions/creator-tiers/');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function createCreatorTier(
  name: string,
  description: string,
  priceUsdCents: number,
): Promise<{ ok: boolean; error?: string; tier?: CreatorTier }> {
  const res = await apiFetchJson('subscriptions/creator-tiers/', {
    method: 'POST',
    json: { name, description, price_usd_cents: priceUsdCents },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = Array.isArray(data) ? data[0] : data?.name?.[0] || data?.price_usd_cents?.[0] || data?.error;
    return { ok: false, error };
  }
  return { ok: true, tier: data };
}

export async function updateCreatorTier(
  id: number,
  patch: Partial<Pick<CreatorTier, 'name' | 'description' | 'price_usd_cents' | 'is_active'>>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetchJson(`subscriptions/creator-tiers/${id}/`, { method: 'PATCH', json: patch });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.error };
}

export async function deleteCreatorTier(id: number): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetchJson(`subscriptions/creator-tiers/${id}/`, { method: 'DELETE' });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => null);
  return { ok: false, error: data?.error };
}

export async function startCreatorSubscriptionCheckout(
  tierId: number,
): Promise<{ ok: boolean; checkoutUrl?: string; error?: string }> {
  const res = await apiFetchJson('subscriptions/creator-subscriptions/checkout/', {
    method: 'POST',
    json: { tier_id: tierId },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error };
  return { ok: true, checkoutUrl: data.checkout_url };
}

export async function fetchMyCreatorSubscriptions(): Promise<CreatorSubscription[]> {
  const res = await apiFetch('subscriptions/creator-subscriptions/mine/');
  if (!res.ok) return [];
  return res.json();
}

export async function fetchMySubscribers(): Promise<SubscribersSummary | null> {
  const res = await apiFetch('subscriptions/creator-subscriptions/subscribers/');
  if (!res.ok) return null;
  return res.json();
}
