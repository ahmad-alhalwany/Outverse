'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch } from '@/lib/api';

type EmailPrefs = {
  digest_frequency: 'never' | 'daily' | 'weekly';
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  shares: boolean;
  messages: boolean;
  tips: boolean;
  marketing: boolean;
};

const DEFAULT_PREFS: EmailPrefs = {
  digest_frequency: 'weekly',
  likes: true,
  comments: true,
  follows: true,
  mentions: true,
  shares: true,
  messages: true,
  tips: true,
  marketing: false,
};

const TOGGLE_KEYS: { key: keyof Omit<EmailPrefs, 'digest_frequency'>; labelKey: string }[] = [
  { key: 'likes', labelKey: 'settings.emailLikes' },
  { key: 'comments', labelKey: 'settings.emailComments' },
  { key: 'follows', labelKey: 'settings.emailFollows' },
  { key: 'mentions', labelKey: 'settings.emailMentions' },
  { key: 'shares', labelKey: 'settings.emailShares' },
  { key: 'messages', labelKey: 'settings.emailMessages' },
  { key: 'tips', labelKey: 'settings.emailTips' },
  { key: 'marketing', labelKey: 'settings.emailMarketing' },
];

export default function EmailDigestSettings() {
  const { t } = useLocale();
  const [prefs, setPrefs] = useState<EmailPrefs>(DEFAULT_PREFS);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('notifications/email-preferences/');
      if (res.ok) {
        const data = await res.json();
        setPrefs((prev) => ({ ...prev, ...data }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<EmailPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      const res = await apiFetch('notifications/email-preferences/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setStatus(res.ok ? t('settings.emailPrefsSaved') : t('settings.emailPrefsError'));
    } catch {
      setStatus(t('settings.emailPrefsError'));
    }
  };

  if (loading) {
    return (
      <p className="px-5 pb-4 text-sm" style={{ color: 'var(--c-icon)' }}>
        {t('common.loading')}
      </p>
    );
  }

  return (
    <div className="space-y-4 px-5 pb-4">
      <div>
        <label className="mb-2 block text-sm font-semibold">{t('settings.digestFrequency')}</label>
        <select
          value={prefs.digest_frequency}
          onChange={(e) => void save({ digest_frequency: e.target.value as EmailPrefs['digest_frequency'] })}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: 'rgb(var(--c-surface))', color: 'var(--c-icon)' }}
        >
          <option value="never">{t('settings.digestNever')}</option>
          <option value="daily">{t('settings.digestDaily')}</option>
          <option value="weekly">{t('settings.digestWeekly')}</option>
        </select>
      </div>

      <div className="space-y-1">
        {TOGGLE_KEYS.map(({ key, labelKey }) => (
          <button
            key={key}
            type="button"
            onClick={() => void save({ [key]: !prefs[key] } as Partial<EmailPrefs>)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition"
            style={{ color: 'rgb(var(--c-text))', background: 'rgb(var(--c-surface))' }}
          >
            <span className="flex-1 text-left">{t(labelKey)}</span>
            <span
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
              style={{ background: prefs[key] ? 'var(--c-focus)' : 'var(--c-track)' }}
              role="switch"
              aria-checked={prefs[key]}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                style={{ transform: prefs[key] ? 'translateX(1.4rem)' : 'translateX(0.25rem)' }}
              />
            </span>
          </button>
        ))}
      </div>

      {status && (
        <p className="text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>
          {status}
        </p>
      )}
    </div>
  );
}
