'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { SparklesIcon, CheckIcon, StarIcon } from '@heroicons/react/24/outline';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
  },
} as const;

type Plan = {
  id: number;
  tier: string;
  name: string;
  price_usd: number;
  features: string[];
  is_recommended: boolean;
};

const FEATURE_CARDS = [
  { titleKey: 'premium.featureMoodConstellationsTitle', descKey: 'premium.featureMoodConstellationsDesc' },
  { titleKey: 'premium.featureDiamondBottlesTitle', descKey: 'premium.featureDiamondBottlesDesc' },
  { titleKey: 'premium.featurePriorityStoriesTitle', descKey: 'premium.featurePriorityStoriesDesc' },
] as const;

function PremiumContent() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const searchParams = useSearchParams();
  const user = useAuthUser();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const checkoutState = searchParams.get('checkout');

  const loadPlans = useCallback(() => {
    setLoading(true);
    setPlansError(false);
    apiFetch('subscriptions/plans/')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('failed'))))
      .then((data) => setPlans(Array.isArray(data) ? data : data.results || []))
      .catch(() => {
        setPlans([]);
        setPlansError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!user) return;
    void apiFetch('subscriptions/me/').then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (data?.plan?.tier) setActivePlan(data.plan.tier);
      else if (data?.tier) setActivePlan(data.tier);
    });
  }, [user]);

  async function choosePlan(tier: string) {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setBusyTier(tier);
    setError('');
    try {
      const res = await apiFetchJson('subscriptions/checkout/', {
        method: 'POST',
        json: { tier },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('premium.checkoutError'));
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError(t('premium.checkoutError'));
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-4xl mx-auto pt-10 pb-16 text-center">
        <div
          className="rounded-[28px] p-10 mb-10"
          style={{ background: `linear-gradient(135deg, ${C.card}, ${C.card2})`, border: `1px solid ${C.line}` }}
        >
          <SparklesIcon className="h-10 w-10 mx-auto mb-3" style={{ color: C.brownDk }} />
          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: C.text }}>{t('premium.title')}</h1>
          <p className="text-sm md:text-base max-w-xl mx-auto" style={{ color: C.text2 }}>{t('premium.subtitle')}</p>
          {activePlan && (
            <p className="mt-3 inline-block rounded-full px-4 py-1 text-xs font-semibold" style={{ background: C.brown, color: '#fff' }}>
              Active: {activePlan}
            </p>
          )}
        </div>

        {checkoutState === 'success' && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: C.card2, color: C.brownDk }}>
            {t('premium.checkoutSuccess')}
          </div>
        )}
        {checkoutState === 'cancelled' && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: C.card2, color: C.text2 }}>
            {t('premium.checkoutCancelled')}
          </div>
        )}
        {error && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: C.card2, color: '#c0392b' }}>
            {error}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4 mb-12 text-left">
          {FEATURE_CARDS.map((card) => (
            <div key={card.titleKey} className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              <StarIcon className="h-6 w-6 mb-2" style={{ color: C.brown }} />
              <h3 className="font-semibold mb-1" style={{ color: C.text }}>{t(card.titleKey)}</h3>
              <p className="text-sm" style={{ color: C.text2 }}>{t(card.descKey)}</p>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold mb-6" style={{ color: C.text }}>{t('premium.choosePlan')}</h2>

        {loading ? (
          <div className="py-10 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : plansError ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: C.card2, color: C.text2 }}>
            <p className="mb-3">{t('premium.loadError')}</p>
            <button
              type="button"
              onClick={loadPlans}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              {t('common.tryAgain')}
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: C.card2, color: C.text2 }}>
            {t('premium.notConfigured')}
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.tier}
                className="rounded-2xl p-6 flex flex-col text-left"
                style={{
                  background: plan.is_recommended ? C.brown : C.white,
                  color: plan.is_recommended ? '#fff' : C.text,
                  border: `1px solid ${C.line}`,
                }}
              >
                {plan.is_recommended && (
                  <span className="text-xs font-bold uppercase tracking-wide mb-2 opacity-90">{t('premium.recommended')}</span>
                )}
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <p className="text-2xl font-bold mb-4">
                  ${plan.price_usd}
                  <span className="text-sm font-normal opacity-80">/{t('premium.perMonth')}</span>
                </p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="h-4 w-4 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => void choosePlan(plan.tier)}
                  disabled={busyTier === plan.tier}
                  className="w-full py-3 rounded-xl font-semibold disabled:opacity-60"
                  style={{
                    background: plan.is_recommended ? '#fff' : C.brownDk,
                    color: plan.is_recommended ? C.brownDk : '#fff',
                  }}
                >
                  {busyTier === plan.tier ? t('premium.redirecting') : t('premium.choosePlanCta')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </WorldShell>
  );
}

export default function PremiumPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <PremiumContent />
    </Suspense>
  );
}
