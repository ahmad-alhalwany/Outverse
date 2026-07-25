'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  SunIcon,
  MoonIcon,
  FireIcon,
  CheckIcon,
  ArrowRightCircleIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import {
  completeDailyRitual,
  fetchDailyRitual,
  type DailyRitual,
  type RitualPeriod,
} from '@/lib/ritualApi';

const PALETTES = {
  light: {
    card: '#FFFFFF',
    text: '#211B3D',
    muted: '#79709E',
    accent: '#7C3AED',
    chipBg: '#E9E1FA',
    border: '#DED0F7',
    morningGrad: 'linear-gradient(135deg,#FDE9C0 0%,#DDB8FF 100%)',
    eveningGrad: 'linear-gradient(135deg,#2B2543 0%,#4A3A8B 100%)',
  },
  dark: {
    card: '#1E1740',
    text: '#F5F3FF',
    muted: '#B0A6D9',
    accent: '#C4B5FD',
    chipBg: 'rgba(255,255,255,0.06)',
    border: 'rgba(255,255,255,0.08)',
    morningGrad: 'linear-gradient(135deg,#3A2A55 0%,#6B4590 100%)',
    eveningGrad: 'linear-gradient(135deg,#1B1530 0%,#3A2A6B 100%)',
  },
} as const;

function detectPeriod(): RitualPeriod {
  const hour = new Date().getHours();
  return hour < 18 ? 'morning' : 'evening';
}

export default function DailyRitualPanel() {
  const { theme } = useTheme();
  const { t, locale, dir } = useLocale();
  const router = useRouter();
  const C = PALETTES[theme];

  const [ritual, setRitual] = useState<DailyRitual | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [completeError, setCompleteError] = useState(false);

  const period = detectPeriod();
  const isMorning = period === 'morning';
  const titleKey = isMorning ? 'ritual.morningTitle' : 'ritual.eveningTitle';
  const subtitleKey = isMorning ? 'ritual.morningSubtitle' : 'ritual.eveningSubtitle';
  const Icon = isMorning ? SunIcon : MoonIcon;

  const load = useCallback(async () => {
    if (!getToken()) {
      setRitual(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchDailyRitual({ period, lang: locale });
      setRitual(data);
    } catch {
      setRitual(null);
    } finally {
      setLoading(false);
    }
  }, [period, locale]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleComplete() {
    if (!getToken()) return;
    setMarking(true);
    setCompleteError(false);
    try {
      const data = await completeDailyRitual({ period, lang: locale });
      if (data) setRitual(data);
      else setCompleteError(true);
    } finally {
      setMarking(false);
    }
  }

  function handleAnswer() {
    if (!ritual) return;
    // Navigate to home create card with the question text prefilled via session storage.
    try {
      sessionStorage.setItem('pendingInspiration', JSON.stringify({
        id: ritual.question.id,
        text: ritual.question.text,
        category: ritual.question.category,
        language: ritual.question.language,
        tags: ritual.question.tags ?? [],
      }));
    } catch {
      /* ignore */
    }
    router.push('/');
  }

  const completed = Boolean(ritual?.ritual.completed);
  const streak = ritual?.streak ?? 0;
  const authed = Boolean(getToken());

  if (!authed) return null;

  return (
    <section
      dir={dir}
      className="rounded-3xl overflow-hidden border"
      style={{ borderColor: C.border, background: C.card }}
    >
      <div
        className="px-6 py-5 md:px-7 md:py-6"
        style={{ background: isMorning ? C.morningGrad : C.eveningGrad }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base md:text-lg font-bold text-white">
                {t(titleKey as never)}
              </p>
              <p className="text-xs text-white/85">
                {t(subtitleKey as never)}
              </p>
            </div>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.18)' }}
            title={t('ritual.streakLabel' as never)}
          >
            <FireIcon className="h-4 w-4" />
            {streak > 0 ? `${streak} ${t('ritual.streakLabel' as never)}` : t('ritual.streakZero' as never)}
          </div>
        </div>
      </div>

      <div className="px-6 py-5 md:px-7 md:py-6">
        {loading ? (
          <p className="text-sm" style={{ color: C.muted }}>
            {t('ritual.loading' as never)}
          </p>
        ) : ritual ? (
          <>
            <p
              className="text-lg md:text-xl font-semibold leading-relaxed"
              style={{ color: C.text }}
            >
              {ritual.question.text}
            </p>
            <p className="mt-2 text-xs" style={{ color: C.muted }}>
              {t('ritual.refreshTomorrow' as never)}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleAnswer}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
                style={{ background: C.accent }}
              >
                <ArrowRightCircleIcon className="h-4 w-4" />
                {t('ritual.cta' as never)}
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={marking || completed}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60"
                style={{
                  background: completed ? C.chipBg : 'transparent',
                  color: completed ? C.muted : C.accent,
                  border: `1px solid ${completed ? C.border : C.accent}`,
                }}
              >
                <CheckIcon className="h-4 w-4" />
                {completed ? t('ritual.completed' as never) : t('ritual.complete' as never)}
              </button>
            </div>
            {completeError && (
              <p className="mt-2 text-xs" style={{ color: '#c0392b' }}>
                {t('ritual.completeError' as never)}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm" style={{ color: C.muted }}>
            {t('ritual.error' as never)}
          </p>
        )}
      </div>
    </section>
  );
}
