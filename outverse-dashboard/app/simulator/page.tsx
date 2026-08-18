'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { ArrowPathIcon, SparklesIcon, BookmarkIcon, ClipboardDocumentIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkIconSolid } from '@heroicons/react/24/solid';

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

const PIN_STORAGE_KEY = 'cosmory_simulator_pins';

const PRESETS = [
  { key: 'chaos', emoji: '🌀', creativity: 85, abstractness: 90, stability: 15 },
  { key: 'disciplined', emoji: '🏛️', creativity: 60, abstractness: 25, stability: 85 },
  { key: 'powerhouse', emoji: '🚀', creativity: 90, abstractness: 40, stability: 75 },
  { key: 'dreamer', emoji: '🌙', creativity: 30, abstractness: 85, stability: 30 },
  { key: 'balanced', emoji: '⚖️', creativity: 50, abstractness: 50, stability: 50 },
] as const;

const FLAVOR_MAP: Record<string, string> = {
  balanced: 'simulator.flavorBalanced',
  hihihi: 'simulator.flavorVisionary',
  hihilo: 'simulator.flavorChaotic',
  hilohi: 'simulator.flavorPowerhouse',
  hilolo: 'simulator.flavorReckless',
  lohihi: 'simulator.flavorMethodical',
  lohilo: 'simulator.flavorDreamer',
  lolohi: 'simulator.flavorSteady',
  lololo: 'simulator.flavorQuiet',
};

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getFlavorKey(creativity: number, abstractness: number, stability: number): string {
  const dc = creativity - 50;
  const da = abstractness - 50;
  const ds = stability - 50;
  const THRESH = 15;
  if (Math.abs(dc) < THRESH && Math.abs(da) < THRESH && Math.abs(ds) < THRESH) return 'balanced';
  const bit = (v: number) => (v >= 0 ? 'hi' : 'lo');
  return `${bit(dc)}${bit(da)}${bit(ds)}`;
}

type Baseline = { creativity_score: number; completion_rate: number; above_average_pct: number };

type PinnedUniverse = {
  id: string;
  creativity: number;
  abstractness: number;
  stability: number;
  creativityScore: number;
  completionRate: number;
  flavorKey: string;
};

type RadarAxis = { label: string; current: number; alternate: number };

function RadarChart({ axes, C }: { axes: RadarAxis[]; C: (typeof PALETTES)[keyof typeof PALETTES] }) {
  const size = 220;
  const center = size / 2;
  const radius = size / 2 - 30;
  const angleFor = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const pointFor = (i: number, value: number): [number, number] => {
    const angle = angleFor(i);
    const r = (value / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const polygon = (values: number[]) => values.map((v, i) => pointFor(i, v).join(',')).join(' ');
  const rings = [25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[220px] mx-auto block">
      {rings.map((r) => (
        <polygon key={r} points={axes.map((_, i) => pointFor(i, r).join(',')).join(' ')} fill="none" stroke={C.line} strokeWidth={1} />
      ))}
      {axes.map((axis, i) => {
        const [x, y] = pointFor(i, 100);
        const [lx, ly] = pointFor(i, 122);
        return (
          <g key={axis.label}>
            <line x1={center} y1={center} x2={x} y2={y} stroke={C.line} strokeWidth={1} />
            <text x={lx} y={ly} fontSize="9" textAnchor="middle" fill={C.text2}>{axis.label}</text>
          </g>
        );
      })}
      <polygon points={polygon(axes.map((a) => a.current))} fill={C.text2} fillOpacity={0.16} stroke={C.text2} strokeWidth={1.5} />
      <polygon points={polygon(axes.map((a) => a.alternate))} fill={C.brown} fillOpacity={0.3} stroke={C.brownDk} strokeWidth={2} />
    </svg>
  );
}

export default function SimulatorPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [creativity, setCreativity] = useState(50);
  const [abstractness, setAbstractness] = useState(50);
  const [stability, setStability] = useState(50);
  const [seed, setSeed] = useState(1);
  const [pins, setPins] = useState<PinnedUniverse[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch('analytics/me/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setBaseline({
        creativity_score: data.creativity_score,
        completion_rate: data.completion_rate,
        above_average_pct: data.above_average_pct ?? 0,
      }))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIN_STORAGE_KEY);
      if (raw) setPins(JSON.parse(raw));
    } catch {
      /* ignore corrupt/blocked storage */
    }
  }, []);

  function persistPins(next: PinnedUniverse[]) {
    setPins(next);
    try {
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota/blocked storage */
    }
  }

  const alternate = useMemo(() => {
    const baseCreativity = baseline?.creativity_score ?? 50;
    const baseCompletion = baseline?.completion_rate ?? 50;
    const baseActivity = clamp(50 + (baseline?.above_average_pct ?? 0) / 2);
    const modifier = (creativity - 50) + (abstractness - 50) * 0.6 - (stability - 50) * 0.3;
    const noise = Math.round(seededRandom(seed + creativity + abstractness + stability) * 20 - 10);
    return {
      creativityScore: clamp(baseCreativity + modifier * 0.5 + noise),
      completionRate: clamp(baseCompletion - modifier * 0.3 + noise),
      activityPulse: clamp(baseActivity + modifier * 0.4 + noise * 0.5),
    };
  }, [baseline, creativity, abstractness, stability, seed]);

  const currentDims = useMemo(() => ({
    creativityScore: baseline?.creativity_score ?? 0,
    completionRate: baseline?.completion_rate ?? 0,
    activityPulse: clamp(50 + (baseline?.above_average_pct ?? 0) / 2),
  }), [baseline]);

  const flavorKey = useMemo(() => getFlavorKey(creativity, abstractness, stability), [creativity, abstractness, stability]);
  const rollKey = `${creativity}-${abstractness}-${stability}-${seed}`;

  const sliders = [
    { label: t('simulator.creativity'), value: creativity, set: setCreativity },
    { label: t('simulator.abstractness'), value: abstractness, set: setAbstractness },
    { label: t('simulator.stability'), value: stability, set: setStability },
  ];

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setCreativity(preset.creativity);
    setAbstractness(preset.abstractness);
    setStability(preset.stability);
    setSeed((s) => s + 1);
  }

  function pinCurrent() {
    const pin: PinnedUniverse = {
      id: `${Date.now()}`,
      creativity,
      abstractness,
      stability,
      creativityScore: alternate.creativityScore,
      completionRate: alternate.completionRate,
      flavorKey,
    };
    persistPins([pin, ...pins].slice(0, 6));
  }

  function removePin(id: string) {
    persistPins(pins.filter((p) => p.id !== id));
  }

  async function copySummary(pin?: PinnedUniverse) {
    const score = pin ? pin.creativityScore : alternate.creativityScore;
    const completion = pin ? pin.completionRate : alternate.completionRate;
    const key = pin ? pin.flavorKey : flavorKey;
    const text = `${t('simulator.title')}\n${t('simulator.creativityScore')}: ${score} · ${t('simulator.completionRate')}: ${completion}\n${t(FLAVOR_MAP[key] || FLAVOR_MAP.balanced)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(pin?.id ?? 'current');
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable — silently skip */
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-3xl mx-auto pt-6 pb-12">
        <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: C.brown }}>{t('simulator.title')}</h1>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>{t('simulator.subtitle')}</p>

        {!user ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('simulator.signInPrompt')}</div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.text2 }}>{t('simulator.presets')}</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
                >
                  <span>{preset.emoji}</span>
                  {t(`simulator.preset_${preset.key}`)}
                </button>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.text2 }}>{t('simulator.currentReality')}</p>
                <p className="text-3xl font-bold" style={{ color: C.text }}>{baseline ? currentDims.creativityScore : '—'}</p>
                <p className="text-xs mt-1" style={{ color: C.text2 }}>{t('simulator.creativityScore')}</p>
              </div>
              <div className="rounded-2xl p-5 overflow-hidden" style={{ background: C.brown }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-white opacity-90">{t('simulator.alternateReality')}</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={rollKey}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.25 }}
                    className="text-3xl font-bold text-white"
                  >
                    {alternate.creativityScore}
                  </motion.p>
                </AnimatePresence>
                <p className="text-xs mt-1 text-white opacity-90">{t('simulator.creativityScore')}</p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={flavorKey}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl p-4 mb-6 flex items-start gap-3"
                style={{ background: C.card2 }}
              >
                <SparklesIcon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.brownDk }} />
                <p className="text-sm" style={{ color: C.text }}>{t(FLAVOR_MAP[flavorKey])}</p>
              </motion.div>
            </AnimatePresence>

            <div className="rounded-2xl p-5 mb-6" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3 text-center" style={{ color: C.text2 }}>{t('simulator.dimensions')}</p>
              <RadarChart
                C={C}
                axes={[
                  { label: t('simulator.creativity'), current: currentDims.creativityScore, alternate: alternate.creativityScore },
                  { label: t('simulator.completionRate'), current: currentDims.completionRate, alternate: alternate.completionRate },
                  { label: t('simulator.activityPulse'), current: currentDims.activityPulse, alternate: alternate.activityPulse },
                ]}
              />
              <div className="flex items-center justify-center gap-4 text-xs mt-2">
                <span className="inline-flex items-center gap-1.5" style={{ color: C.text2 }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: C.text2 }} />
                  {t('simulator.currentReality')}
                </span>
                <span className="inline-flex items-center gap-1.5" style={{ color: C.text2 }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: C.brownDk }} />
                  {t('simulator.alternateReality')}
                </span>
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

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setSeed((s) => s + 1)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white"
                style={{ background: C.brownDk }}
              >
                <ArrowPathIcon className="h-4 w-4" />
                {t('simulator.reroll')}
              </button>
              <button
                type="button"
                onClick={pinCurrent}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold"
                style={{ background: C.card2, color: C.brownDk }}
              >
                <BookmarkIcon className="h-4 w-4" />
                {t('simulator.pinThis')}
              </button>
              <button
                type="button"
                onClick={() => void copySummary()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold"
                style={{ background: C.card2, color: C.brownDk }}
              >
                <ClipboardDocumentIcon className="h-4 w-4" />
                {copiedId === 'current' ? t('simulator.copied') : t('simulator.copySummary')}
              </button>
            </div>

            {pins.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.text2 }}>{t('simulator.pinnedTitle')}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {pins.map((pin) => (
                    <div key={pin.id} className="rounded-xl p-3" style={{ background: C.card2 }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-2xl font-bold" style={{ color: C.brownDk }}>{pin.creativityScore}</p>
                        <BookmarkIconSolid className="h-4 w-4 shrink-0 mt-1.5" style={{ color: C.brownDk }} />
                      </div>
                      <p className="text-xs italic mb-2" style={{ color: C.text2 }}>{t(FLAVOR_MAP[pin.flavorKey] || FLAVOR_MAP.balanced)}</p>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void copySummary(pin)}
                          className="text-xs font-semibold inline-flex items-center gap-1"
                          style={{ color: C.brown }}
                        >
                          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                          {copiedId === pin.id ? t('simulator.copied') : t('simulator.copySummary')}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePin(pin.id)}
                          className="text-xs font-semibold inline-flex items-center gap-1 ms-auto"
                          style={{ color: '#c0392b' }}
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {t('simulator.unpin')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: C.card2 }}>
              <SparklesIcon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: C.brownDk }} />
              <p className="text-sm" style={{ color: C.text }}>{t('simulator.disclaimer')}</p>
            </div>
          </>
        )}
      </div>
    </WorldShell>
  );
}
