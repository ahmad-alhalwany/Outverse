export type PremiumPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
};

export type PremiumPlan = {
  id: number;
  tier: string;
  name: string;
  price_usd: number;
  features: string[];
  is_recommended: boolean;
  available: boolean;
};

export const PREMIUM_FEATURE_CARDS = [
  { titleKey: 'premium.featureMoodConstellationsTitle', descKey: 'premium.featureMoodConstellationsDesc' },
  { titleKey: 'premium.featureDiamondBottlesTitle', descKey: 'premium.featureDiamondBottlesDesc' },
  { titleKey: 'premium.featurePriorityStoriesTitle', descKey: 'premium.featurePriorityStoriesDesc' },
] as const;

export function usePremiumPalette(isDark: boolean): PremiumPalette {
  if (isDark) {
    return {
      cream: '#14102A',
      card: '#1E1740',
      card2: '#251B4D',
      white: '#2A2154',
      brown: '#C4B5FD',
      brownDk: '#A78BFA',
      text: '#F5F3FF',
      text2: '#B0A6D9',
      line: 'rgba(167,139,250,0.20)',
    };
  }
  return {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
  };
}

export function asPremiumPlans(data: unknown): PremiumPlan[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows
    .map((row) => {
      const p = (row || {}) as Partial<PremiumPlan> & { stripe_price_id?: string; price_usd_cents?: number };
      const features = Array.isArray(p.features) ? p.features.map((f) => String(f)) : [];
      const price =
        typeof p.price_usd === 'number'
          ? p.price_usd
          : typeof p.price_usd_cents === 'number'
            ? Math.round(p.price_usd_cents) / 100
            : 0;
      return {
        id: Number(p.id),
        tier: String(p.tier || ''),
        name: String(p.name || ''),
        price_usd: price,
        features,
        is_recommended: Boolean(p.is_recommended),
        available: p.available !== false,
      };
    })
    .filter((p) => p.tier);
}

export function formatPlanPrice(price: number) {
  const n = Number(price);
  if (!Number.isFinite(n)) return '$0';
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function mySubscriptionTier(data: unknown): string | null {
  const obj = (data && typeof data === 'object' ? data : {}) as {
    active?: boolean;
    subscription?: { plan?: { tier?: string } };
  };
  if (!obj.active) return null;
  return obj.subscription?.plan?.tier || null;
}
