'use client';

import { useEffect, useState } from 'react';
import { StarIcon } from '@heroicons/react/24/outline';
import {
  fetchCreatorTiers,
  startCreatorSubscriptionCheckout,
  type CreatorTier,
} from '@/lib/creatorSubscriptionsApi';
import { useLocale } from '@/components/LocaleProvider';

type Props = {
  creatorId: number;
  className?: string;
  buttonStyle?: React.CSSProperties;
};

export default function SubscribeTiersButton({ creatorId, className, buttonStyle }: Props) {
  const { t } = useLocale();
  const [tiers, setTiers] = useState<CreatorTier[]>([]);
  const [open, setOpen] = useState(false);
  const [busyTierId, setBusyTierId] = useState<number | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void fetchCreatorTiers(creatorId).then(setTiers);
  }, [creatorId]);

  if (tiers.length === 0) return null;

  const handleSubscribe = async (tierId: number) => {
    if (busyTierId) return;
    setBusyTierId(tierId);
    setStatus('');
    try {
      const res = await startCreatorSubscriptionCheckout(tierId);
      if (res.ok && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        setStatus(res.error || t('profile.checkoutError'));
      }
    } finally {
      setBusyTierId(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={className ?? 'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold'}
        style={buttonStyle}
      >
        <StarIcon className="h-4 w-4" />
        {t('profile.subscribe')}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-surface bg-background p-3 shadow-lg space-y-2">
          <p className="text-xs font-semibold text-text">{t('profile.supportThisCreator')}</p>
          {tiers.map((tier) => (
            <div key={tier.id} className="flex items-center justify-between rounded-lg border border-surface bg-surface/40 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{tier.name}</p>
                {tier.description && (
                  <p className="text-xs text-text-secondary truncate">{tier.description}</p>
                )}
                <p className="text-xs text-text-secondary">${tier.price_usd.toFixed(2)}{t('creatorHub.perMonthShort')}</p>
              </div>
              <button
                type="button"
                disabled={busyTierId === tier.id}
                onClick={() => void handleSubscribe(tier.id)}
                className="shrink-0 rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {busyTierId === tier.id ? '…' : t('profile.subscribe')}
              </button>
            </div>
          ))}
          {status && <p className="text-xs text-text-secondary">{status}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-text-secondary">
              {t('common.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
