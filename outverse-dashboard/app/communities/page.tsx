'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserGroupIcon, PlusIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useLocale } from '@/components/LocaleProvider';
import { createCommunity, fetchCommunities, type Community } from '@/lib/communityApi';

export default function CommunitiesPage() {
  const { t } = useLocale();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrivacy, setNewPrivacy] = useState<'public' | 'private'>('public');
  const [createBusy, setCreateBusy] = useState(false);
  const [sort, setSort] = useState<'popular' | 'trending'>('popular');

  const load = useCallback(async (q?: string, sortMode?: 'popular' | 'trending') => {
    setLoading(true);
    const list = await fetchCommunities(q, sortMode === 'trending' ? 'trending' : undefined);
    setCommunities(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(query || undefined, sort), 300);
    return () => clearTimeout(timer);
  }, [query, sort, load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || createBusy) return;
    setCreateBusy(true);
    try {
      const community = await createCommunity(name, newDescription.trim(), newPrivacy);
      if (community) {
        setNewName('');
        setNewDescription('');
        setNewPrivacy('public');
        setCreating(false);
        void load(query || undefined);
      }
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-16">
      <div className="pt-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <UserGroupIcon className="h-6 w-6" />
            {t('communities.title')}
          </h1>
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="flex items-center gap-1.5 rounded-full bg-vault px-4 py-2 text-sm font-semibold text-white"
          >
            <PlusIcon className="h-4 w-4" />
            {t('communities.create')}
          </button>
        </div>

        {creating && (
          <div className="rounded-2xl border border-surface bg-surface/40 p-4 space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('communities.namePlaceholder')}
              className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
            />
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder={t('communities.descriptionPlaceholder')}
              rows={2}
              className="w-full rounded-xl border border-surface bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setNewPrivacy('public')}
                className={`flex-1 rounded-xl px-3 py-2 font-semibold ${newPrivacy === 'public' ? 'bg-vault text-white' : 'bg-surface text-text-secondary'}`}
              >
                {t('communities.public')}
              </button>
              <button
                type="button"
                onClick={() => setNewPrivacy('private')}
                className={`flex-1 rounded-xl px-3 py-2 font-semibold ${newPrivacy === 'private' ? 'bg-vault text-white' : 'bg-surface text-text-secondary'}`}
              >
                {t('communities.private')}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-text-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={createBusy || !newName.trim()}
                onClick={() => void handleCreate()}
                className="rounded-xl bg-vault px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createBusy ? t('common.loading') : t('communities.create')}
              </button>
            </div>
          </div>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('communities.searchPlaceholder')}
          className="w-full rounded-xl border border-surface bg-surface px-4 py-2.5 text-sm"
        />

        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSort('popular')}
            className={`rounded-full px-4 py-1.5 font-semibold ${sort === 'popular' ? 'bg-vault text-white' : 'bg-surface text-text-secondary'}`}
          >
            {t('communities.popular')}
          </button>
          <button
            type="button"
            onClick={() => setSort('trending')}
            className={`rounded-full px-4 py-1.5 font-semibold ${sort === 'trending' ? 'bg-vault text-white' : 'bg-surface text-text-secondary'}`}
          >
            {t('communities.trending')}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-text-secondary py-8 text-center">{t('common.loading')}</p>
        ) : communities.length === 0 ? (
          <p className="text-sm text-text-secondary py-8 text-center">{t('communities.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {communities.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/communities/${c.slug}`}
                  className="flex items-center justify-between rounded-2xl border border-surface bg-surface/30 px-4 py-3 hover:bg-surface/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-xs text-text-secondary truncate">{c.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-text-secondary ml-3">
                    {t('communities.memberCount', { count: String(c.members_count) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
