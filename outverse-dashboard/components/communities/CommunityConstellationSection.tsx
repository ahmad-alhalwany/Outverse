'use client';

import Link from 'next/link';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import type { CommunityConstellation } from '@/lib/communityApi';

export default function CommunityConstellationSection({ data }: { data: CommunityConstellation }) {
  const { t } = useLocale();
  if (data.questions.length === 0) return null;

  return (
    <section className="mt-4 rounded-xl border border-surface bg-surface/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <SparklesIcon className="h-4 w-4 text-vault" />
        <h2 className="text-xs font-semibold text-text-secondary">{t('communities.constellationTitle')}</h2>
      </div>
      <p className="mb-3 text-sm text-text-secondary">{t('communities.constellationHint')}</p>
      <div className="mb-3 space-y-2">
        {data.questions.map((q, idx) => (
          <div key={q.id ?? `ph-${idx}`} className="rounded-lg bg-background px-3 py-2 text-sm text-text-primary">
            {q.text}
          </div>
        ))}
      </div>
      <Link
        href={data.deep_links.lab}
        className="inline-block rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white"
      >
        {t('communities.constellationLabLink')}
      </Link>
    </section>
  );
}
