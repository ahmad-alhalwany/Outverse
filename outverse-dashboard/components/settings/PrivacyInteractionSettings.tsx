'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';
import type { PrivacyPrefs } from '@/lib/socialApi';

type Palette = {
  card: string;
  cardStrong: string;
  icon: string;
  textMuted: string;
};

const POLICY_OPTIONS = [
  { value: 'everyone', labelKey: 'social.policyEveryone' },
  { value: 'followers', labelKey: 'social.policyFollowers' },
  { value: 'following', labelKey: 'social.policyFollowing' },
  { value: 'none', labelKey: 'social.policyNone' },
] as const;

const POLICY_LABEL_KEYS: Record<'dm_policy' | 'comment_policy' | 'mention_policy' | 'tag_policy', string> = {
  dm_policy: 'social.dmPolicy',
  comment_policy: 'social.commentPolicy',
  mention_policy: 'social.mentionPolicy',
  tag_policy: 'social.tagPolicy',
};

export default function PrivacyInteractionSettings({ palette }: { palette: Palette }) {
  const { t } = useLocale();
  const [prefs, setPrefs] = useState<PrivacyPrefs>({
    dm_policy: 'everyone',
    comment_policy: 'everyone',
    mention_policy: 'everyone',
    tag_policy: 'everyone',
    hidden_words: [],
    quiet_hours_start: null,
    quiet_hours_end: null,
  });
  const [wordsInput, setWordsInput] = useState('');
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const res = await apiFetch('preferences/');
    if (!res.ok) return;
    const data = await res.json();
    setPrefs({
      dm_policy: data.dm_policy ?? 'everyone',
      comment_policy: data.comment_policy ?? 'everyone',
      mention_policy: data.mention_policy ?? 'everyone',
      tag_policy: data.tag_policy ?? 'everyone',
      hidden_words: data.hidden_words ?? [],
      quiet_hours_start: data.quiet_hours_start ? String(data.quiet_hours_start).slice(0, 5) : null,
      quiet_hours_end: data.quiet_hours_end ? String(data.quiet_hours_end).slice(0, 5) : null,
    });
    setWordsInput((data.hidden_words ?? []).join(', '));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<PrivacyPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const res = await apiFetch('preferences/', {
      method: 'PUT',
      body: JSON.stringify(next),
    });
    setStatus(res.ok ? t('social.prefsSaved') : t('social.prefsError'));
  };

  return (
    <div className="space-y-4 px-5 pb-4">
      {(['dm_policy', 'comment_policy', 'mention_policy', 'tag_policy'] as const).map((key) => (
        <div key={key}>
          <label className="mb-2 block text-sm font-semibold">{t(POLICY_LABEL_KEYS[key])}</label>
          <select
            value={prefs[key]}
            onChange={(e) => void save({ [key]: e.target.value as PrivacyPrefs[typeof key] })}
            className="w-full rounded-xl px-3 py-2 text-sm"
            style={{ background: palette.card, color: palette.icon }}
          >
            {POLICY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div>
        <label className="mb-2 block text-sm font-semibold">{t('social.hiddenWords')}</label>
        <input
          type="text"
          value={wordsInput}
          onChange={(e) => setWordsInput(e.target.value)}
          onBlur={() => {
            const hidden_words = wordsInput
              .split(',')
              .map((w) => w.trim())
              .filter(Boolean)
              .slice(0, 50);
            void save({ hidden_words });
          }}
          placeholder={t('social.hiddenWordsHint')}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: palette.card, color: palette.icon }}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold">{t('social.quietHours')}</label>
        <p className="mb-2 text-xs" style={{ color: palette.textMuted }}>
          {t('social.quietHoursHint')}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <span className="mb-1 block text-xs" style={{ color: palette.textMuted }}>
              {t('social.quietHoursFrom')}
            </span>
            <input
              type="time"
              value={prefs.quiet_hours_start ?? ''}
              onChange={(e) => void save({ quiet_hours_start: e.target.value || null })}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: palette.card, color: palette.icon }}
            />
          </div>
          <div className="flex-1">
            <span className="mb-1 block text-xs" style={{ color: palette.textMuted }}>
              {t('social.quietHoursTo')}
            </span>
            <input
              type="time"
              value={prefs.quiet_hours_end ?? ''}
              onChange={(e) => void save({ quiet_hours_end: e.target.value || null })}
              className="w-full rounded-xl px-3 py-2 text-sm"
              style={{ background: palette.card, color: palette.icon }}
            />
          </div>
        </div>
      </div>
      {status && (
        <p className="text-xs" style={{ color: palette.textMuted }}>
          {status}
        </p>
      )}
    </div>
  );
}
