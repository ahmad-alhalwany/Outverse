'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatCount } from '@/lib/profileEmotions';
import Link from 'next/link';
import { useLocale } from '@/components/LocaleProvider';

type PostStats = {
  total_posts: number;
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  inspiration_published?: number;
  inspiration_by_category?: Record<string, number>;
  top_posts: { id: number; text?: string; views: number }[];
};

const CATEGORY_KEYS: Record<string, string> = {
  historical: 'inspiration.categoryHistorical',
  fantasy: 'inspiration.categoryFantasy',
  scifi: 'inspiration.categoryScifi',
  philosophical: 'inspiration.categoryPhilosophical',
  mystery: 'inspiration.categoryMystery',
  surreal: 'inspiration.categorySurreal',
  everyday: 'inspiration.categoryEveryday',
  emotional: 'inspiration.categoryEmotional',
};

export default function PostCreatorStats() {
  const { t } = useLocale();
  const [stats, setStats] = useState<PostStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('posts/my_stats/');
      if (res.ok) setStats(await res.json());
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !stats || stats.total_posts === 0) return null;

  const inspired = stats.inspiration_published ?? 0;
  const topCategories = Object.entries(stats.inspiration_by_category ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <section className="rounded-2xl border border-surface p-4 sm:p-5 mb-6">
      <h2 className="text-sm font-bold text-text mb-4">{t('profile.postEngagement')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { label: t('profile.posts'), value: stats.total_posts },
          { label: t('profile.views'), value: stats.total_views },
          { label: t('profile.likes'), value: stats.total_likes },
          { label: t('profile.comments'), value: stats.total_comments },
          { label: t('profile.shares'), value: stats.total_shares },
        ].map((row) => (
          <div key={row.label} className="rounded-xl bg-surface px-3 py-2 text-center">
            <div className="text-lg font-bold">{formatCount(row.value)}</div>
            <div className="text-[10px] uppercase tracking-wide text-text-secondary">{row.label}</div>
          </div>
        ))}
      </div>

      {inspired > 0 && (
        <div className="rounded-xl bg-surface px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-secondary">{t('inspiration.statsInspired')}</p>
            <p className="text-lg font-bold">{formatCount(inspired)}</p>
            {topCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {topCategories.map(([cat, count]) => {
                  const key = CATEGORY_KEYS[cat];
                  return (
                    <span key={cat} className="text-[10px] rounded-full bg-background px-2 py-0.5">
                      {key ? t(key) : cat} · {count}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <Link href="/inspiration" className="text-xs font-semibold text-vault hover:underline">
            {t('inspiration.statsViewHistory')}
          </Link>
        </div>
      )}

      {stats.top_posts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.top_posts.map((p) => (
            <Link key={p.id} href={`/post/${p.id}`} className="text-xs rounded-full px-3 py-1 bg-surface">
              ▶ {formatCount(p.views)} · {(p.text || 'Post').slice(0, 32)}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
