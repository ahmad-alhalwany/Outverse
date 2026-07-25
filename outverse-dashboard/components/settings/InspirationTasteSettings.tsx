'use client';

import { useCallback, useEffect, useState } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetchJson } from '@/lib/api';
import { fetchInspirationStats, type InspirationStats } from '@/lib/questionsApi';

const CATEGORY_KEYS: Record<string, string> = {
  historical: 'inspiration.categoryHistorical',
  fantasy: 'inspiration.categoryFantasy',
  scifi: 'inspiration.categoryScifi',
  philosophical: 'inspiration.categoryPhilosophical',
  mystery: 'inspiration.categoryMystery',
  surreal: 'inspiration.categorySurreal',
  everyday: 'inspiration.categoryEveryday',
  emotional: 'inspiration.categoryEmotional',
};

type Props = {
  palette: {
    card: string;
    text: string;
    textMuted: string;
    border: string;
    cardStrong: string;
    white: string;
  };
};

export default function InspirationTasteSettings({ palette }: Props) {
  const { t } = useLocale();
  const user = useAuthUser();
  const [stats, setStats] = useState<InspirationStats | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const data = await fetchInspirationStats();
    if (data) {
      setStats(data);
      setInterests(Array.isArray(data.interests) ? data.interests.filter((item) => typeof item === 'string') : []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveInterests() {
    if (!user) return;
    const next = draft
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const merged = [...new Set([...interests.filter((item) => !item.startsWith('guide:') && !item.startsWith('mood:')), ...next])];
    setStatus('');
    const res = await apiFetchJson(`users/${user.id}/update/`, {
      method: 'PATCH',
      json: { interests: merged },
    });
    if (res.ok) {
      setInterests(merged);
      setDraft('');
      setStatus(t('inspiration.tasteSaved'));
      void load();
    } else {
      setStatus(t('inspiration.tasteSaveError'));
    }
  }

  const labelFor = (cat: string) => {
    const key = CATEGORY_KEYS[cat];
    return key ? t(key) : cat;
  };

  return (
    <section
      className="rounded-3xl p-5 md:p-6"
      style={{ background: palette.card, border: `1px solid ${palette.border}` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <SparklesIcon className="h-6 w-6" style={{ color: palette.cardStrong }} />
        <div>
          <h2 className="text-lg font-semibold" style={{ color: palette.text }}>
            {t('inspiration.tasteTitle')}
          </h2>
          <p className="text-sm" style={{ color: palette.textMuted }}>
            {t('inspiration.tasteSubtitle')}
          </p>
        </div>
      </div>

      {stats?.preferred_categories?.length ? (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: palette.textMuted }}>
            {t('inspiration.tastePreferred')}
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.preferred_categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: palette.white, color: palette.cardStrong }}
              >
                {labelFor(cat)}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {interests.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: palette.textMuted }}>
            {t('inspiration.tasteInterests')}
          </p>
          <div className="flex flex-wrap gap-2">
            {interests
              .filter((item) => !item.startsWith('guide:') && !item.startsWith('mood:'))
              .slice(0, 12)
              .map((item) => (
                <span
                  key={item}
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ background: palette.white, color: palette.text }}
                >
                  {item}
                </span>
              ))}
          </div>
        </div>
      )}

      <label className="block text-sm font-medium mb-2" style={{ color: palette.text }}>
        {t('inspiration.tasteAddInterests')}
      </label>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('inspiration.tasteAddPlaceholder')}
        className="w-full rounded-xl px-3 py-2 text-sm mb-3"
        style={{ background: palette.white, color: palette.text, border: `1px solid ${palette.border}` }}
      />
      <button
        type="button"
        onClick={() => void saveInterests()}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: palette.cardStrong }}
      >
        {t('inspiration.tasteSave')}
      </button>
      {status ? (
        <p className="mt-2 text-xs" style={{ color: palette.textMuted }}>
          {status}
        </p>
      ) : null}
    </section>
  );
}
