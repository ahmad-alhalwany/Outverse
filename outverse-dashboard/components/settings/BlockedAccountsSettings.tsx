'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { fetchSocialList, setSocialAction, type BlockedUser, type SocialAction } from '@/lib/socialApi';

const TABS: { type: 'blocked' | 'muted' | 'restricted'; action: SocialAction; labelKey: string; undoKey: string }[] = [
  { type: 'blocked', action: 'block', labelKey: 'social.tabBlocked', undoKey: 'social.unblock' },
  { type: 'muted', action: 'mute', labelKey: 'social.tabMuted', undoKey: 'social.unmute' },
  { type: 'restricted', action: 'restrict', labelKey: 'social.tabRestricted', undoKey: 'social.unrestrict' },
];

export default function BlockedAccountsSettings() {
  const { t } = useLocale();
  const [active, setActive] = useState<'blocked' | 'muted' | 'restricted'>('blocked');
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (type: 'blocked' | 'muted' | 'restricted') => {
    setLoading(true);
    const list = await fetchSocialList(type);
    setUsers(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(active);
  }, [active, load]);

  const tab = TABS.find((tItem) => tItem.type === active)!;

  async function handleUndo(userId: number) {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    await setSocialAction(userId, tab.action, true);
  }

  return (
    <div className="px-5 pb-4">
      <div className="mb-3 flex gap-2">
        {TABS.map((tItem) => (
          <button
            key={tItem.type}
            type="button"
            onClick={() => setActive(tItem.type)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
            style={{
              background: active === tItem.type ? 'var(--c-focus)' : 'rgb(var(--c-surface))',
              color: active === tItem.type ? '#FFFFFF' : 'rgb(var(--c-text-secondary))',
            }}
          >
            {t(tItem.labelKey)}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-sm opacity-60">…</p>
      ) : users.length === 0 ? (
        <p className="text-sm" style={{ color: 'rgb(var(--c-text-secondary))' }}>
          {t('social.emptyList')}
        </p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: 'rgb(var(--c-surface))' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {u.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatar} alt={u.username} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: 'var(--c-focus)', color: '#FFFFFF' }}
                  >
                    {u.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.username}</p>
                  {(u.first_name || u.last_name) && (
                    <p className="truncate text-xs" style={{ color: 'rgb(var(--c-text-secondary))' }}>
                      {[u.first_name, u.last_name].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleUndo(u.id)}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: 'var(--c-focus)', color: '#FFFFFF' }}
              >
                {t(tab.undoKey)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}