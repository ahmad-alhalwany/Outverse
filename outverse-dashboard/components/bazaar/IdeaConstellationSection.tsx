'use client';

import Link from 'next/link';
import { SparklesIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import type { IdeaConstellation } from '@/lib/differentiatorApi';

const PALETTES = {
  light: { card: '#F5F1FE', text: '#211B3D', text2: '#79709E', line: 'rgba(124,58,237,0.16)', accent: '#7C3AED' },
  dark: { card: '#251B4D', text: '#F5F3FF', text2: '#B0A6D9', line: 'rgba(167,139,250,0.20)', accent: '#C4B5FD' },
};

export default function IdeaConstellationSection({ data }: { data: IdeaConstellation }) {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];

  return (
    <section
      className="rounded-2xl p-5 mt-6"
      style={{ background: C.card, border: `1px solid ${C.line}` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <SparklesIcon className="h-5 w-5" style={{ color: C.accent }} />
        <h2 className="text-base font-semibold" style={{ color: C.text }}>
          {t('bazaar.constellationTitle')}
        </h2>
      </div>
      <p className="text-sm mb-4" style={{ color: C.text2 }}>
        {t('bazaar.constellationHint')}
      </p>

      {data.questions.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.text2 }}>
            {t('bazaar.constellationLab')}
          </p>
          {data.questions.map((q, idx) => (
            <div key={q.id ?? `ph-${idx}`} className="rounded-xl px-3 py-2 text-sm" style={{ background: 'rgba(255,255,255,0.04)', color: C.text }}>
              {q.id ? (
                <Link href={`/inspiration?q=${q.id}`} className="hover:underline">
                  {q.text}
                </Link>
              ) : (
                <span>{q.text}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {data.challenge_hint && (
        <p className="text-sm mb-4" style={{ color: C.text2 }}>
          <BeakerIcon className="inline h-4 w-4 me-1" style={{ color: C.accent }} />
          {t('bazaar.constellationChallenge')}{' '}
          <Link href={`/lab?challenge=${data.challenge_hint.id}`} className="font-medium underline" style={{ color: C.accent }}>
            {data.challenge_hint.title}
          </Link>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={data.deep_links.lab} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.accent }}>
          {t('bazaar.constellationLabLink')}
        </Link>
        <Link href={data.deep_links.bottle_create} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.text }}>
          {t('bazaar.constellationBottle')}
        </Link>
        <Link href={data.deep_links.capsule_create} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'transparent', border: `1px solid ${C.line}`, color: C.text }}>
          {t('bazaar.constellationCapsule')}
        </Link>
      </div>
    </section>
  );
}
