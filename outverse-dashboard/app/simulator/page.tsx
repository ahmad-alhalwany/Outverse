'use client';

import { useEffect, useMemo, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { ArrowPathIcon, SparklesIcon } from '@heroicons/react/24/outline';

const PALETTES = {
  light: {
    cream: '#F3F0FC', card: '#E9E1FA', card2: '#F5F1FE', white: '#FFFFFF',
    brown: '#7C3AED', brownDk: '#5B21B6', text: '#211B3D', text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
  },
  dark: {
    cream: '#14102A', card: '#1E1740', card2: '#251B4D', white: '#2A2154',
    brown: '#C4B5FD', brownDk: '#A78BFA', text: '#F5F3FF', text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
  },
} as const;

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export default function SimulatorPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [baseline, setBaseline] = useState<{ creativity_score: number; completion_rate: number } | null>(null);
  const [creativity, setCreativity] = useState(50);
  const [abstractness, setAbstractness] = useState(50);
  const [stability, setStability] = useState(50);
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    if (!user) return;
    apiFetch('analytics/me/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setBaseline({ creativity_score: data.creativity_score, completion_rate: data.completion_rate }))
      .catch(() => {});
  }, [user]);

  const alternate = useMemo(() => {
    const base = baseline?.creativity_score ?? 50;
    const modifier = (creativity - 50) + (abstractness - 50) * 0.6 - (stability - 50) * 0.3;
    const noise = Math.round(seededRandom(seed + creativity + abstractness + stability) * 20 - 10);
    return {
      creativity_score: Math.max(0, Math.min(100, Math.round(base + modifier * 0.5 + noise))),
      completion_rate: Math.max(0, Math.min(100, Math.round((baseline?.completion_rate ?? 50) - modifier * 0.3 + noise))),
    };
  }, [baseline, creativity, abstractness, stability, seed]);

  const sliders = [
    { label: t('simulator.creativity'), value: creativity, set: setCreativity },
    { label: t('simulator.abstractness'), value: abstractness, set: setAbstractness },
    { label: t('simulator.stability'), value: stability, set: setStability },
  ];

  return (
    <WorldShell colors={C}>
      <div className="max-w-3xl mx-auto pt-6 pb-12">
        <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: C.brown }}>{t('simulator.title')}</h1>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>{t('simulator.subtitle')}</p>

        {!user ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('simulator.signInPrompt')}</div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.text2 }}>{t('simulator.currentReality')}</p>
                <p className="text-3xl font-bold" style={{ color: C.text }}>{baseline?.creativity_score ?? '—'}</p>
                <p className="text-xs mt-1" style={{ color: C.text2 }}>{t('simulator.creativityScore')}</p>
              </div>
              <div className="rounded-2xl p-5" style={{ background: C.brown }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-white opacity-90">{t('simulator.alternateReality')}</p>
                <p className="text-3xl font-bold text-white">{alternate.creativity_score}</p>
                <p className="text-xs mt-1 text-white opacity-90">{t('simulator.creativityScore')}</p>
              </div>
            </div>

            <div className="rounded-2xl p-5 mb-6" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              {sliders.map((slider) => (
                <div key={slider.label} className="mb-4 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: C.text }}>{slider.label}</span>
                    <span className="text-sm font-semibold" style={{ color: C.brown }}>{slider.value}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={slider.value}
                    onChange={(e) => slider.set(Number(e.target.value))}
                    className="w-full accent-current"
                    style={{ color: C.brown }}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              <ArrowPathIcon className="h-4 w-4" />
              {t('simulator.reroll')}
            </button>

            <div className="rounded-2xl p-4 mt-6 flex items-start gap-3" style={{ background: C.card2 }}>
              <SparklesIcon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.brownDk }} />
              <p className="text-sm" style={{ color: C.text }}>{t('simulator.disclaimer')}</p>
            </div>
          </>
        )}
      </div>
    </WorldShell>
  );
}
