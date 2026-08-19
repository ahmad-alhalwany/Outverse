'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SparklesIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetch, apiFetchJson } from '@/lib/api';

type CoinPack = {
  id: number;
  name: string;
  coins: number;
  price_usd_cents: number;
  available: boolean;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function WalletContent() {
  const { t } = useLocale();
  const user = useAuthUser();
  const searchParams = useSearchParams();
  const checkoutState = searchParams.get('checkout');

  const [packs, setPacks] = useState<CoinPack[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPack, setBusyPack] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('shop/coin-packs/')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((data) => setPacks(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError(t('wallet.loadError')))
      .finally(() => setLoading(false));
  }, [t]);

  const loadBalance = useCallback(() => {
    if (!user) return;
    void apiFetch('shop/items/wallet/').then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.balance === 'number') setBalance(data.balance);
    });
  }, [user]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useEffect(() => {
    if (checkoutState === 'success') loadBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutState]);

  async function handleBuy(packId: number) {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    setBusyPack(packId);
    setError('');
    try {
      const res = await apiFetchJson('shop/coin-checkout/', {
        method: 'POST',
        json: { pack_id: packId },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t('wallet.checkoutError'));
        return;
      }
      window.location.href = data.checkout_url;
    } catch {
      setError(t('wallet.checkoutError'));
    } finally {
      setBusyPack(null);
    }
  }

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-16">
      <div className="pt-4 space-y-6">
        <div className="rounded-2xl border border-surface bg-surface/40 p-6 text-center">
          <p className="text-sm text-text-secondary mb-1">{t('wallet.balance')}</p>
          <p className="text-3xl font-bold flex items-center justify-center gap-1.5">
            <SparklesIcon className="h-7 w-7 text-vault" />
            {balance ?? '—'}
          </p>
        </div>

        {checkoutState === 'success' && (
          <p className="rounded-xl bg-green-500/10 px-4 py-3 text-sm text-green-500">
            {t('wallet.checkoutSuccess')}
          </p>
        )}
        {checkoutState === 'cancelled' && (
          <p className="rounded-xl bg-surface px-4 py-3 text-sm text-text-secondary">
            {t('wallet.checkoutCancelled')}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</p>
        )}

        <div>
          <h2 className="text-lg font-bold mb-3">{t('wallet.title')}</h2>
          {loading ? (
            <p className="text-sm text-text-secondary text-center py-8">{t('common.loading')}</p>
          ) : packs.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-8">{t('wallet.empty')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="rounded-2xl border border-surface bg-surface/30 p-4 flex flex-col items-center text-center"
                >
                  <p className="font-semibold">{pack.name}</p>
                  <p className="text-2xl font-bold my-2 flex items-center gap-1">
                    {pack.coins} <SparklesIcon className="h-5 w-5 text-vault" />
                  </p>
                  <button
                    type="button"
                    disabled={busyPack === pack.id || !pack.available}
                    onClick={() => void handleBuy(pack.id)}
                    className="mt-2 w-full rounded-full bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busyPack === pack.id
                      ? t('common.loading')
                      : pack.available
                        ? formatPrice(pack.price_usd_cents)
                        : t('wallet.comingSoon')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function WalletFallback() {
  const { t } = useLocale();
  return <div className="min-h-screen flex items-center justify-center">{t('common.loading')}</div>;
}

export default function WalletPage() {
  return (
    <Suspense fallback={<WalletFallback />}>
      <WalletContent />
    </Suspense>
  );
}
