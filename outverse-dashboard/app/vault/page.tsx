'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { useTheme } from '@/components/ThemeProvider';
import { apiFetch } from '@/lib/api';
import { fetchDailyRitual } from '@/lib/ritualApi';
import { fetchCapsuleStats } from '@/lib/capsulesApi';

type MoodRow = { emotion: string; count: number };

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    ink: '#211B3D',
    muted: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    card: 'rgba(255,255,255,0.72)',
    glow: 'rgba(124,58,237,0.18)',
    accent: '#7C3AED',
  },
  dark: {
    cream: '#120E24',
    ink: '#F5F3FF',
    muted: '#B0A6D9',
    line: 'rgba(167,139,250,0.22)',
    card: 'rgba(30,23,64,0.72)',
    glow: 'rgba(167,139,250,0.22)',
    accent: '#C4B5FD',
  },
};

export default function VaultWorldPage() {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const C = PALETTES[theme === 'dark' ? 'dark' : 'light'];
  const [streak, setStreak] = useState(0);
  const [capsuleStats, setCapsuleStats] = useState<{ sealed: number; ready: number; opened: number } | null>(null);
  const [moods, setMoods] = useState<MoodRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const ritual = await fetchDailyRitual({ lang: locale });
        if (ritual) setStreak(ritual.streak || 0);
      } catch { /* ignore */ }
      try {
        const stats = await fetchCapsuleStats();
        if (stats) setCapsuleStats(stats);
      } catch { /* ignore */ }
      try {
        const res = await apiFetch('bottles/dashboard/');
        if (res.ok) {
          const data = await res.json();
          const rows = (data.mood_summary || data.emotions || []) as MoodRow[];
          if (Array.isArray(rows)) setMoods(rows.slice(0, 6));
        }
      } catch { /* ignore */ }
    })();
  }, [locale]);

  const chambers = [
    {
      href: '/bottles',
      label: t('vault.bottlesLabel'),
      title: t('vault.bottlesTitle'),
      body: t('vault.bottlesBody'),
    },
    {
      href: '/capsules',
      label: t('vault.capsulesLabel'),
      title: t('vault.capsulesTitle'),
      body: capsuleStats
        ? t('vault.capsulesStats')
            .replace('{sealed}', String(capsuleStats.sealed))
            .replace('{ready}', String(capsuleStats.ready))
            .replace('{opened}', String(capsuleStats.opened))
        : t('vault.capsulesBody'),
    },
    {
      href: '/year',
      label: t('vault.mapLabel'),
      title: t('vault.mapTitle'),
      body: t('vault.mapBody').replace('{streak}', String(streak)),
    },
  ];

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full">
      <div
        className="relative overflow-hidden"
        style={{
          background: `radial-gradient(circle at top left, ${C.glow}, transparent 42%), radial-gradient(circle at 80% 20%, rgba(167,139,250,0.16), transparent 35%), ${C.cream}`,
        }}
      >
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-10 max-w-2xl"
          >
            <p
              className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em]"
              style={{ color: C.accent }}
            >
              {t('vault.eyebrow')}
            </p>
            <h1
              className="text-4xl font-bold tracking-tight sm:text-5xl"
              style={{ color: C.ink }}
            >
              {t('vault.title')}
            </h1>
            <p className="mt-4 text-base leading-relaxed sm:text-lg" style={{ color: C.muted }}>
              {t('vault.subtitle')}
            </p>
          </motion.header>

          <section className="grid gap-4 md:grid-cols-3">
            {chambers.map((chamber, index) => (
              <motion.div
                key={chamber.href}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * index }}
              >
                <Link
                  href={chamber.href}
                  className="group block h-full rounded-[28px] border p-6 backdrop-blur-md transition hover:-translate-y-1"
                  style={{
                    background: C.card,
                    borderColor: C.line,
                    boxShadow: `0 18px 50px ${C.glow}`,
                  }}
                >
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.accent }}>
                    {chamber.label}
                  </p>
                  <h2 className="mb-2 text-xl font-bold" style={{ color: C.ink }}>
                    {chamber.title}
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                    {chamber.body}
                  </p>
                  <span
                    className="mt-5 inline-flex text-sm font-semibold transition group-hover:translate-x-1"
                    style={{ color: C.accent }}
                  >
                    {t('vault.enter')}
                  </span>
                </Link>
              </motion.div>
            ))}
          </section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mt-8 rounded-[32px] border p-6 sm:p-8"
            style={{
              background: C.card,
              borderColor: C.line,
              boxShadow: `0 24px 60px ${C.glow}`,
            }}
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold" style={{ color: C.ink }}>
                  {t('vault.emotionTitle')}
                </h2>
                <p className="mt-1 text-sm" style={{ color: C.muted }}>
                  {t('vault.emotionSubtitle')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/bottles"
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(180deg, ${C.accent}, #5B21B6)` }}
                >
                  {t('vault.openBottles')}
                </Link>
                <Link
                  href="/memories"
                  className="rounded-full border px-4 py-2 text-sm font-semibold"
                  style={{ borderColor: C.line, color: C.ink }}
                >
                  {t('vault.openMemories')}
                </Link>
              </div>
            </div>

            {moods.length === 0 ? (
              <p className="text-sm" style={{ color: C.muted }}>{t('vault.emotionEmpty')}</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {moods.map((row) => (
                  <li
                    key={row.emotion}
                    className="flex items-center justify-between rounded-2xl border px-4 py-3"
                    style={{ borderColor: C.line, background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.04)' }}
                  >
                    <span className="font-medium" style={{ color: C.ink }}>{row.emotion}</span>
                    <span className="text-lg font-bold" style={{ color: C.accent }}>{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        </div>
      </div>
    </AppShell>
  );
}
