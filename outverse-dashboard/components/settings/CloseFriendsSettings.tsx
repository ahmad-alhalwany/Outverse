'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';
import {
  addCloseFriend,
  fetchCloseFriends,
  removeCloseFriend,
  type CloseFriendItem,
} from '@/lib/storyUtils';

export default function CloseFriendsSettings() {
  const { t } = useLocale();
  const [friends, setFriends] = useState<CloseFriendItem[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: number; username: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchCloseFriends();
    setFriends(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 3500);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`search/?q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        setResults(users.slice(0, 8));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleAdd(friendId: number) {
    const ok = await addCloseFriend(friendId);
    if (ok) {
      setError('');
      setQuery('');
      setResults([]);
      await load();
    } else {
      setError(t('social.closeFriendAddFailed'));
    }
  }

  async function handleRemove(friendId: number) {
    const ok = await removeCloseFriend(friendId);
    if (ok) {
      setError('');
      await load();
    } else {
      setError(t('social.closeFriendRemoveFailed'));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--settings-muted, #79709E)' }}>
        {t('social.closeFriendsHint')}
      </p>
      {error && (
        <p className="text-xs font-medium text-red-500" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm opacity-60">{t('common.loading')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {friends.length === 0 ? (
            <span className="text-sm opacity-60">{t('social.closeFriendsEmpty')}</span>
          ) : (
            friends.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium bg-surface"
              >
                {f.username}
                <button type="button" aria-label={t('social.removeCloseFriend')} onClick={() => void handleRemove(f.id)}>
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            ))
          )}
        </div>
      )}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('social.closeFriendsSearchPlaceholder')}
          className="w-full rounded-xl px-3 py-2 text-sm border border-surface bg-background"
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-xl border border-surface bg-background shadow-lg overflow-hidden">
            {results.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface text-left"
                  onClick={() => void handleAdd(u.id)}
                >
                  <span>{u.name || u.username}</span>
                  <UserPlusIcon className="h-4 w-4 text-vault" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
