'use client';

import { FireIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import type { CommunityRitual } from '@/lib/communityApi';

export default function CommunityRitualSection({
  data, onComplete, busy,
}: { data: CommunityRitual; onComplete: () => void; busy?: boolean }) {
  const { t } = useLocale();
  if (!data.available || !data.prompt) return null;

  const streakLabel = data.streak > 0
    ? t('communities.ritualStreak').replace('{count}', String(data.streak))
    : t('communities.ritualStreakZero');

  return (
    <section className="mt-4 rounded-xl border border-surface bg-surface/30 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-text-secondary">{t('communities.ritualTitle')}</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-vault">
          <FireIcon className="h-3.5 w-3.5" />
          {streakLabel}
        </span>
      </div>
      <p className="mb-3 rounded-lg bg-background px-3 py-2 text-sm text-text-primary">{data.prompt.text}</p>
      <button
        type="button"
        onClick={onComplete}
        disabled={busy || data.completed}
        className="inline-flex items-center gap-1.5 rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        <CheckIcon className="h-3.5 w-3.5" />
        {data.completed ? t('communities.ritualCompleted') : t('communities.ritualComplete')}
      </button>
    </section>
  );
}
