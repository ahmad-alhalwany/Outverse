'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QueueListIcon, PlusIcon, TrashIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useLocale } from '@/components/LocaleProvider';
import { mapPost } from '@/utils/postMapper';
import {
  addOrbitListMember,
  createOrbitList,
  deleteOrbitList,
  fetchOrbitListFeed,
  fetchOrbitLists,
  removeOrbitListMember,
  type OrbitList,
} from '@/lib/postsApi';

export default function OrbitListsPage() {
  const me = useAuthUser();
  const { t } = useLocale();
  const [tab, setTab] = useState<'mine' | 'following'>('mine');
  const [lists, setLists] = useState<OrbitList[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [feedPosts, setFeedPosts] = useState<ReturnType<typeof mapPost>[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState('');

  const loadLists = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchOrbitLists(tab === 'following');
      setLists(data);
    } catch {
      setLists([]);
      setError('Could not load Orbit Lists.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const active = lists.find((l) => l.id === activeId) || null;

  const openFeed = async (listId: number) => {
    setActiveId(listId);
    setFeedLoading(true);
    try {
      const page = await fetchOrbitListFeed(listId, { limit: 20, offset: 0 });
      setFeedPosts((page?.results || []).map(mapPost));
    } catch {
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const created = await createOrbitList({
        title: title.trim(),
        description: description.trim(),
        is_private: isPrivate,
      });
      if (created) {
        setTitle('');
        setDescription('');
        setIsPrivate(false);
        setTab('mine');
        await loadLists();
        setActiveId(created.id);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async () => {
    if (!activeId || !memberId.trim()) return;
    const uid = Number(memberId);
    if (!Number.isFinite(uid)) return;
    const updated = await addOrbitListMember(activeId, uid);
    if (updated) {
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setMemberId('');
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!activeId) return;
    const ok = await removeOrbitListMember(activeId, userId);
    if (ok) {
      setLists((prev) =>
        prev.map((l) =>
          l.id === activeId
            ? {
                ...l,
                members: (l.members || []).filter((m) => m.id !== userId),
                member_count: Math.max(0, (l.member_count || 1) - 1),
              }
            : l,
        ),
      );
    }
  };

  const handleDelete = async (listId: number) => {
    const ok = await deleteOrbitList(listId);
    if (ok) {
      setLists((prev) => prev.filter((l) => l.id !== listId));
      if (activeId === listId) {
        setActiveId(null);
        setFeedPosts([]);
      }
    }
  };

  if (!me) {
    return (
      <AppShell maxWidth="max-w-3xl" contentClassName="px-4 py-10">
        <p className="text-center text-text-secondary">Sign in to manage Orbit Lists.</p>
        <div className="mt-4 text-center">
          <Link href="/login" className="font-semibold text-lab">
            Log in
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth="max-w-4xl" contentClassName="px-4 py-6 pb-20">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <QueueListIcon className="h-7 w-7" strokeWidth={1.6} />
          {t('signal.orbitListsTitle')}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{t('signal.orbitListsHint')}</p>
      </header>

      <section className="mb-6 rounded-2xl border border-border bg-surface/40 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          {t('signal.createList')}
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('signal.listTitle')}
            className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
            {t('signal.privateList')}
          </label>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || !title.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-lab px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" /> {t('collections.create')}
          </button>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('signal.listDesc')}
          className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm"
        />
      </section>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            tab === 'mine' ? 'bg-lab text-white' : 'bg-surface text-text-secondary'
          }`}
        >
          {t('signal.myLists')}
        </button>
        <button
          type="button"
          onClick={() => setTab('following')}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
            tab === 'following' ? 'bg-lab text-white' : 'bg-surface text-text-secondary'
          }`}
        >
          {t('signal.followingLists')}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {loading ? (
            <p className="text-sm text-text-secondary">{t('common.loading')}</p>
          ) : lists.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('signal.emptyLists')}</p>
          ) : (
            lists.map((list) => (
              <div
                key={list.id}
                className={`rounded-2xl border p-3 ${
                  activeId === list.id ? 'border-lab bg-lab/10' : 'border-border bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void openFeed(list.id)}
                  className="w-full text-left"
                >
                  <p className="font-semibold">{list.title}</p>
                  <p className="text-xs text-text-secondary">
                    {list.member_count} {t('signal.members')}
                    {list.is_private ? ' · private' : ''}
                  </p>
                </button>
                {tab === 'mine' && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(list.id)}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-red-500"
                  >
                    <TrashIcon className="h-3.5 w-3.5" /> {t('signal.deleteList')}
                  </button>
                )}
              </div>
            ))
          )}
        </aside>

        <div>
          {active && tab === 'mine' && (
            <div className="mb-4 rounded-2xl border border-border bg-white p-4">
              <h3 className="mb-2 font-semibold">{active.title}</h3>
              <p className="mb-3 text-sm text-text-secondary">{active.description || '—'}</p>
              <div className="mb-3 flex gap-2">
                <input
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  placeholder={t('signal.addMember')}
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleAddMember()}
                  className="inline-flex items-center gap-1 rounded-xl bg-surface px-3 py-2 text-sm font-medium"
                >
                  <UserPlusIcon className="h-4 w-4" /> Add
                </button>
              </div>
              <ul className="space-y-1 text-sm">
                {(active.members || []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between">
                    <Link href={`/profile/${m.id}`} className="hover:underline">
                      @{m.username}
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleRemoveMember(m.id)}
                      className="text-xs text-red-500"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedLoading ? (
            <p className="text-sm text-text-secondary">{t('common.loading')}</p>
          ) : !activeId ? (
            <p className="text-sm text-text-secondary">{t('signal.openFeed')}</p>
          ) : feedPosts.length === 0 ? (
            <p className="text-sm text-text-secondary">{t('signal.noFeed')}</p>
          ) : (
            <div className="space-y-4">
              {feedPosts.map((post) => (
                <PostCard key={post.id} {...post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
