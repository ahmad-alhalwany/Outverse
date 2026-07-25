'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiUrl } from '@/lib/api';
import type { BazaarIdea } from '@/lib/bazaarTypes';

const BASE = apiUrl('ideas');

const PALETTES = {
  light: {
    cream: '#EEF9F0', card: '#DCF0E0', card2: '#F0FAF2', white: '#FFFFFF',
    brown: '#059669', brownDk: '#047857', text: '#0F2E1F', text2: '#5F8C74',
    line: 'rgba(5,150,105,0.16)',
  },
  dark: {
    cream: '#0A1F16', card: '#123324', card2: '#164430', white: '#1A4A34',
    brown: '#34D399', brownDk: '#10B981', text: '#EAFBF2', text2: '#8FC7AC',
    line: 'rgba(52,211,153,0.20)',
  },
} as const;

function growthStage(idea: BazaarIdea): { emoji: string; labelKey: string } {
  const score = (idea.supporters || 0) * 2 + Math.round((idea.funding_raised || 0) / 50);
  if (score >= 30) return { emoji: '🌳', labelKey: 'garden.stageTree' };
  if (score >= 15) return { emoji: '🌿', labelKey: 'garden.stageSapling' };
  if (score >= 5) return { emoji: '🌱', labelKey: 'garden.stageSprout' };
  return { emoji: '🌰', labelKey: 'garden.stageSeed' };
}

export default function IdeaGardenPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const [ideas, setIdeas] = useState<BazaarIdea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/?ordering=new`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setIdeas(Array.isArray(data) ? data : data.results || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorldShell colors={C}>
      <div className="max-w-5xl mx-auto pt-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: C.brown }}>🌱 {t('garden.title')}</h1>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>{t('garden.subtitle')}</p>

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : ideas.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('garden.empty')}</div>
        ) : (
          <div
            className="rounded-[28px] p-8"
            style={{ background: `radial-gradient(circle at top, ${C.card2}, ${C.cream})`, border: `1px solid ${C.line}` }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {ideas.map((idea) => {
                const stage = growthStage(idea);
                return (
                  <Link
                    key={idea.id}
                    href={`/bazaar/${idea.id}`}
                    className="rounded-2xl p-4 flex flex-col items-center text-center transition hover:-translate-y-1"
                    style={{ background: C.white, border: `1px solid ${C.line}` }}
                  >
                    <span className="text-4xl mb-2">{stage.emoji}</span>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.brown }}>
                      {t(stage.labelKey)}
                    </p>
                    <p className="text-sm font-medium truncate w-full" style={{ color: C.text }}>{idea.title}</p>
                    <p className="text-xs mt-1" style={{ color: C.text2 }}>
                      {idea.supporters} {t('garden.supporters')}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </WorldShell>
  );
}
