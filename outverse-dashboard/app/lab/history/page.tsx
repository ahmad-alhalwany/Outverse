'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';
import { CheckBadgeIcon, ClockIcon } from '@heroicons/react/24/outline';

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
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
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
    successBg: 'rgba(74,222,128,0.15)',
    successText: '#4ade80',
  },
};

type Entry = {
  id: number;
  content: string;
  submitted_at?: string;
  created_at?: string;
  is_approved: boolean;
  challenge_title?: string;
  challenge?: {
    id: number;
    title: string;
    type: string;
    cover_url: string;
  };
};

function formatDate(value: string | undefined, justNow: string) {
  if (!value) return justNow;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return justNow;
  return date.toLocaleString();
}

export default function LabHistoryPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await apiFetch('challenges/user_entries/');
        if (!res.ok) throw new Error('failed');
        setEntries(await res.json());
      } catch {
        setEntries([]);
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <WorldShell colors={C} maxWidth="max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>
            {t('lab.historyTitle')}
          </h1>
          <p className="text-sm" style={{ color: C.text2 }}>
            {t('lab.historySubtitle')}
          </p>
        </div>
        <Link
          href="/lab"
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: C.white, color: C.brownDk, border: `1px solid ${C.line}` }}
        >
          {t('lab.backToLab')}
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
          {t('lab.loadingEntries')}
        </div>
      ) : error ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
          {t('lab.historyLoadError')}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
          {t('lab.noEntries')}
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-2xl p-5"
              style={{ background: C.white, border: `1px solid ${C.line}` }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: C.text }}>
                    {entry.challenge?.title || entry.challenge_title || t('lab.challengeFallback')}
                  </h2>
                  <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: C.text2 }}>
                    {entry.content}
                  </p>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: entry.is_approved ? C.successBg : C.card2,
                    color: entry.is_approved ? C.successText : C.brownDk,
                  }}
                >
                  {entry.is_approved ? <CheckBadgeIcon className="h-4 w-4" /> : <ClockIcon className="h-4 w-4" />}
                  {entry.is_approved ? t('lab.approved') : t('lab.pendingReview')}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs" style={{ color: C.text2 }}>
                <span>{formatDate(entry.submitted_at || entry.created_at, t('lab.justNow'))}</span>
                {entry.challenge?.type ? <span>{entry.challenge.type}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </WorldShell>
  );
}