'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { formatCount } from '@/lib/profileEmotions';
import { reelPagePath } from '@/lib/fetchReel';
import { useLocale } from '@/components/LocaleProvider';
import type { ReelItem } from '@/lib/reelTypes';

type CreatorStats = {
  total_signals: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  top_signals: ReelItem[];
};

export default function ReelCreatorStats() {
  const { t } = useLocale();
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('reels/my_stats/');
      if (res.ok) setStats(await res.json());
      else setStats(null);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="reels-creator-stats mb-6 rounded-2xl border border-surface p-4 animate-pulse h-28" />
    );
  }

  if (!stats || stats.total_signals === 0) return null;

  return (
    <section className="reels-creator-stats mb-6 rounded-2xl border border-surface p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <ChartBarIcon className="h-5 w-5 text-vault" />
        <h2 className="text-sm font-bold text-text">{t('analytics.creatorSignalsTitle')}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { label: t('analytics.creatorSignals'), value: stats.total_signals },
          { label: t('profile.views'), value: stats.total_views },
          { label: t('profile.likes'), value: stats.total_likes },
          { label: t('profile.comments'), value: stats.total_comments },
          { label: t('profile.shares'), value: stats.total_shares },
        ].map((row) => (
          <div key={row.label} className="rounded-xl bg-surface px-3 py-2 text-center">
            <div className="text-lg font-bold text-text">{formatCount(row.value)}</div>
            <div className="text-[10px] uppercase tracking-wide text-text-secondary">{row.label}</div>
          </div>
        ))}
      </div>
      {stats.top_signals.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">{t('analytics.creatorTopSignals')}</p>
          <div className="flex flex-wrap gap-2">
            {stats.top_signals.map((reel) => (
              <Link
                key={reel.id}
                href={reelPagePath(reel.id)}
                className="text-xs rounded-full px-3 py-1 bg-surface hover:bg-vault/10 transition"
              >
                ▶ {formatCount(reel.views)} · {(reel.caption || 'Signal').slice(0, 32)}
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
