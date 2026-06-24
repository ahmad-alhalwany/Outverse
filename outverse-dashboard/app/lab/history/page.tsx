'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { apiUrl } from '@/lib/api';
import { CheckBadgeIcon, ClockIcon } from '@heroicons/react/24/outline';

const BASE = apiUrl('challenges');

const PALETTES = {
  light: {
    cream: '#FBF3EE',
    card: '#F5E4DB',
    card2: '#F9ECE4',
    white: '#FFFFFF',
    brown: '#A0563B',
    brownDk: '#854330',
    text: '#3D2B22',
    text2: '#9A8278',
    line: 'rgba(160,86,59,0.14)',
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
  },
  dark: {
    cream: '#1a1a2e',
    card: '#23234a',
    card2: '#2d1b4a',
    white: '#2a2a45',
    brown: '#c49a6c',
    brownDk: '#a0563b',
    text: '#F5F6FA',
    text2: '#B3B3B3',
    line: 'rgba(106,0,255,0.18)',
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

function formatDate(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString();
}

export default function LabHistoryPage() {
  const { theme } = useTheme();
  const C = PALETTES[theme];
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`${BASE}/user_entries/`, { credentials: 'include' });
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
            My Lab History
          </h1>
          <p className="text-sm" style={{ color: C.text2 }}>
            Every challenge entry you&apos;ve submitted across the Weirdness Lab.
          </p>
        </div>
        <Link
          href="/lab"
          className="rounded-xl px-4 py-2 text-sm font-semibold"
          style={{ background: C.white, color: C.brownDk, border: `1px solid ${C.line}` }}
        >
          Back to Lab
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
          Loading your entries…
        </div>
      ) : error ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
          Could not load your lab history.
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
          You haven&apos;t submitted any challenge entries yet.
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
                    {entry.challenge?.title || entry.challenge_title || 'Challenge'}
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
                  {entry.is_approved ? 'Approved' : 'Pending review'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs" style={{ color: C.text2 }}>
                <span>{formatDate(entry.submitted_at || entry.created_at)}</span>
                {entry.challenge?.type ? <span>{entry.challenge.type}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </WorldShell>
  );
}