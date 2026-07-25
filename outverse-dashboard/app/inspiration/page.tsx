'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { SparklesIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import {
  fetchInspirationHistory,
  fetchInspirationStats,
  type InspirationHistoryItem,
  type InspirationStats,
} from '@/lib/questionsApi';

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

export default function InspirationHistoryPage() {
  const { t } = useLocale();
  const user = useAuthUser();
  const [history, setHistory] = useState<InspirationHistoryItem[]>([]);
  const [stats, setStats] = useState<InspirationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [rows, taste] = await Promise.all([fetchInspirationHistory(), fetchInspirationStats()]);
    setHistory(rows);
    setStats(taste);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  const labelFor = (cat: string) => {
    const key = CATEGORY_KEYS[cat];
    return key ? t(key) : cat;
  };

  return (
    <AppShell className="min-h-screen bg-background text-text" maxWidth="max-w-2xl">
      <div className="py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text mb-4">
          <ArrowLeftIcon className="h-4 w-4" />
          {t('common.back')}
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <SparklesIcon className="h-8 w-8 text-vault" />
          <div>
            <h1 className="text-2xl font-bold">{t('inspiration.historyTitle')}</h1>
            <p className="text-sm text-text-secondary">{t('inspiration.historySubtitle')}</p>
          </div>
        </div>

        {!user ? (
          <p className="text-sm text-text-secondary">{t('inspiration.historyLogin')}</p>
        ) : loading ? (
          <p className="text-sm text-text-secondary">{t('inspiration.loading')}</p>
        ) : (
          <>
            {stats?.preferred_categories?.length ? (
              <div className="rounded-2xl border border-surface p-4 mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
                  {t('inspiration.tastePreferred')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {stats.preferred_categories.map((cat) => (
                    <span key={cat} className="rounded-full bg-surface px-3 py-1 text-xs font-medium">
                      {labelFor(cat)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {history.length === 0 ? (
              <div className="rounded-2xl border border-surface p-8 text-center text-sm text-text-secondary">
                {t('inspiration.historyEmpty')}
                <div className="mt-4">
                  <Link href="/" className="text-vault font-semibold">
                    {t('inspiration.inspireMe')}
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {history.map((row) => (
                  <li key={`${row.question.id}-${row.viewed_at}`} className="rounded-2xl border border-surface p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase tracking-wide rounded-full bg-surface px-2 py-0.5">
                        {labelFor(row.question.category)}
                      </span>
                      {row.published && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-vault/20 text-vault px-2 py-0.5">
                          {t('inspiration.historyPublished')}
                        </span>
                      )}
                      {row.skipped && !row.published && (
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-surface px-2 py-0.5 text-text-secondary">
                          {t('inspiration.historySkipped')}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-medium">{row.question.text}</p>
                    <p className="text-xs text-text-secondary mt-2">
                      {new Date(row.viewed_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
