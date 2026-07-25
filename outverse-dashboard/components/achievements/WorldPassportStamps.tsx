'use client';

import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import type { WorldPassport } from '@/lib/differentiatorApi';

const PALETTES = {
  light: { card: '#E9E1FA', text: '#211B3D', text2: '#79709E', line: 'rgba(124,58,237,0.16)', accent: '#7C3AED' },
  dark: { card: '#1E1740', text: '#F5F3FF', text2: '#B0A6D9', line: 'rgba(167,139,250,0.20)', accent: '#C4B5FD' },
};

const STAMP_EMOJI: Record<string, string> = {
  lab: '🧪',
  bottles: '🍶',
  ideas: '💡',
  capsules: '⏳',
  communities: '🌍',
  live: '📡',
};

export default function WorldPassportStamps({ passport }: { passport: WorldPassport }) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];

  return (
    <section className="rounded-2xl p-5 mb-6" style={{ background: C.card, border: `1px solid ${C.line}` }}>
      <h2 className="text-lg font-semibold mb-1" style={{ color: C.text }}>
        {t('achievements.passportTitle')}
      </h2>
      <p className="text-sm mb-4" style={{ color: C.text2 }}>
        {t('achievements.passportHint')}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {passport.worlds.map((w) => (
          <div
            key={w.key}
            className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.line}` }}
          >
            <div className="text-2xl mb-2">{STAMP_EMOJI[w.key] || '✨'}</div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.text2 }}>
              {w.world}
            </p>
            <p className="text-xl font-bold mt-1" style={{ color: C.accent }}>
              {w.count}
            </p>
            <p className="text-xs" style={{ color: C.text2 }}>
              {w.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
