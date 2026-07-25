'use client';

import { useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { SparklesIcon, BookOpenIcon, ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import CreatorAnalyticsDashboard from '@/components/analytics/CreatorAnalyticsDashboard';

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
    barBg: 'rgba(124,58,237,0.12)',
    bannerBg: '#E9E1FA',
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
    barBg: 'rgba(255,255,255,0.08)',
    bannerBg: '#251B4D',
  },
} as const;

type PersonalAnalytics = {
  creativity_score: number;
  completion_rate: number;
  bottles_caught: number;
  stories_count: number;
  weekly_activity: { day: string; date: string; total: number }[];
  mood_calendar: { day: number; date: string; dominant: string | null }[];
  above_average_pct: number;
  story_genre_breakdown: Record<string, number>;
};

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😔',
  creative: '✨',
};

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [data, setData] = useState<PersonalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiFetch('analytics/me/')
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }, [user]);

  const maxActivity = data ? Math.max(1, ...data.weekly_activity.map((d) => d.total)) : 1;

  return (
    <WorldShell colors={C}>
      <div className="mx-auto max-w-2xl pt-6 pb-10">
        <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: C.brown }}>
          {t('analytics.title')}
        </h1>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>{t('analytics.subtitle')}</p>

        {user && !loading && (
          <CreatorAnalyticsDashboard colors={C} />
        )}

        {!user ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            {t('analytics.signInPrompt')}
          </div>
        ) : loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : !data ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            {t('analytics.error')}
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-5 mb-4" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold" style={{ color: C.brownDk }}>{t('analytics.creativityScore')}</p>
                <SparklesIcon className="h-5 w-5" style={{ color: C.brownDk }} />
              </div>
              <p className="text-4xl font-bold" style={{ color: C.text }}>{data.creativity_score}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: C.barBg }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, data.creativity_score)}%`, background: C.brownDk }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: t('analytics.completionRate'), value: `${data.completion_rate}%` },
                { label: t('analytics.bottlesCaught'), value: data.bottles_caught },
                { label: t('analytics.storiesCount'), value: data.stories_count },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl p-3 text-center" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                  <div className="text-lg font-bold" style={{ color: C.brown }}>{stat.value}</div>
                  <div className="text-xs mt-1" style={{ color: C.text2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-5 mb-4" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>{t('analytics.weeklyActivity')}</p>
              <div className="flex items-end justify-between gap-2 h-24">
                {data.weekly_activity.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md"
                      style={{
                        height: `${Math.max(4, (day.total / maxActivity) * 80)}px`,
                        background: C.brownDk,
                      }}
                    />
                    <span className="text-[10px]" style={{ color: C.text2 }}>{day.day}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-5 mb-4" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>{t('analytics.moodPatterns')}</p>
              <div className="grid grid-cols-7 gap-1.5">
                {data.mood_calendar.map((cell) => (
                  <div
                    key={cell.date}
                    title={cell.date}
                    className="aspect-square rounded-lg flex items-center justify-center text-xs"
                    style={{ background: C.barBg, color: C.text2 }}
                  >
                    {cell.dominant ? MOOD_EMOJI[cell.dominant] || cell.day : cell.day}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{ background: C.bannerBg }}
            >
              <ArrowTrendingUpIcon className="h-6 w-6 shrink-0" style={{ color: C.brownDk }} />
              <p className="text-sm font-semibold" style={{ color: C.text }}>
                {t('analytics.aboveAverage', { pct: String(data.above_average_pct) })}
              </p>
            </div>

            <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpenIcon className="h-5 w-5" style={{ color: C.brown }} />
                <p className="text-sm font-semibold" style={{ color: C.text }}>{t('analytics.yourStories')}</p>
              </div>
              {Object.keys(data.story_genre_breakdown).length === 0 ? (
                <p className="text-sm" style={{ color: C.text2 }}>{t('analytics.noStories')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.story_genre_breakdown).map(([genre, count]) => (
                    <span key={genre} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                      {genre} · {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </WorldShell>
  );
}
