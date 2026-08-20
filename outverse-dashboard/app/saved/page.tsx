'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import SavedIdeaCard from '@/components/bazaar/SavedIdeaCard';
import { mapPost } from '@/utils/postMapper';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetch } from '@/lib/api';
import { fetchCollections, updateCollection, type SavedCollection } from '@/lib/postsApi';
import { toggleIdeaSave } from '@/lib/bazaarApi';
import type { BazaarIdea } from '@/lib/bazaarTypes';
import { useLocale } from '@/components/LocaleProvider';

const COLLECTIONS = [
  { key: 'all', labelKey: 'saved.tabAll' },
  { key: 'post', labelKey: 'saved.tabPosts' },
  { key: 'reel', labelKey: 'saved.tabReels' },
  { key: 'idea', labelKey: 'saved.tabIdeas' },
  { key: 'story', labelKey: 'saved.tabStories' },
] as const;

type SavedItem = {
  saved_id: string;
  saved_type: 'post' | 'reel' | 'idea' | 'story';
  [key: string]: unknown;
};

export default function SavedPostsPage() {
  const me = useAuthUser();
  const { t } = useLocale();
  const [active, setActive] = useState<(typeof COLLECTIONS)[number]['key']>('all');
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [folders, setFolders] = useState<SavedCollection[]>([]);
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const [updatingFolderId, setUpdatingFolderId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      if (activeFolder != null) {
        const res = await apiFetch(`posts/saved/?collection_id=${activeFolder}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setItems(
          list.map((p: { id?: number }) => ({
            ...p,
            saved_type: 'post' as const,
            saved_id: `post_${p.id}`,
          })),
        );
      } else {
        const res = await apiFetch(`saved/?collection=${active}`);
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [active, activeFolder]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchCollections().then(setFolders).catch(() => setFolders([]));
  }, []);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(''), 3500);
    return () => clearTimeout(timer);
  }, [actionError]);

  const handleUnsave = (savedId: string) => {
    setItems((prev) => prev.filter((item) => item.saved_id !== savedId));
  };

  const posts = useMemo(
    () => items.filter((i) => i.saved_type === 'post').map((i) => mapPost(i as unknown as import('@/utils/postMapper').ApiPost)),
    [items]
  );

  const ideas = useMemo(
    () => items.filter((i) => i.saved_type === 'idea') as unknown as BazaarIdea[],
    [items],
  );

  const visibleItems = useMemo(() => {
    if (activeFolder != null) return { posts, ideas: [] as BazaarIdea[] };
    if (active === 'post') return { posts, ideas: [] as BazaarIdea[] };
    if (active === 'idea') return { posts: [], ideas };
    if (active === 'all') return { posts, ideas };
    return { posts: [], ideas: [] as BazaarIdea[] };
  }, [active, activeFolder, ideas, posts]);

  const totalVisible = visibleItems.posts.length + visibleItems.ideas.length;

  async function handleUnsaveIdea(ideaId: number) {
    const res = await toggleIdeaSave(ideaId);
    if (res) {
      setActionError('');
      handleUnsave(`idea_${ideaId}`);
    } else {
      setActionError(t('saved.unsaveIdeaFailed'));
    }
  }

  async function toggleFolderPublic(folder: SavedCollection) {
    if (updatingFolderId) return;
    setUpdatingFolderId(folder.id);
    const updated = await updateCollection(folder.id, { is_public: !folder.is_public });
    if (updated) {
      setFolders((prev) => prev.map((item) => (item.id === folder.id ? updated : item)));
      setActionError('');
    } else {
      setActionError(t('saved.toggleVisibilityFailed'));
    }
    setUpdatingFolderId(null);
  }

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
      <section className="pt-2">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              <BookmarkIcon className="h-7 w-7 text-vault" />
              {t('saved.header')}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {t('saved.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-secondary hover:text-text hover:bg-surface border border-surface transition disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('saved.refresh')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {COLLECTIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActive(tab.key); setActiveFolder(null); }}
              disabled={activeFolder != null}
              className={`px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-40 ${
                active === tab.key && activeFolder == null
                  ? 'bg-vault text-white'
                  : 'bg-surface text-text-secondary hover:text-text'
              }`}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {folders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-text-secondary">{t('collections.title')}:</span>
            <button
              type="button"
              onClick={() => setActiveFolder(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                activeFolder == null ? 'bg-bazaar text-white' : 'bg-surface text-text-secondary hover:text-text'
              }`}
            >
              {t('collections.all')}
            </button>
            {folders.map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveFolder(f.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    activeFolder === f.id ? 'bg-bazaar text-white' : 'bg-surface text-text-secondary hover:text-text'
                  }`}
                >
                  {f.name} <span className="opacity-60">{f.item_count}</span>
                </button>
                {f.is_public ? (
                  <Link href={`/boards/${f.id}`} className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold text-vault hover:underline">
                    {t('saved.publicBoard')}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => void toggleFolderPublic(f)}
                  disabled={updatingFolderId === f.id}
                  className="rounded-full bg-surface px-2 py-1 text-[10px] font-semibold text-text-secondary hover:text-vault disabled:opacity-50"
                >
                  {f.is_public ? t('saved.makePrivate') : t('saved.makePublic')}
                </button>
              </span>
            ))}
          </div>
        )}

        {actionError && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm font-medium text-red-500 bg-red-500/10 border border-red-500/20" role="alert">
            {actionError}
          </div>
        )}

        {!me && (
          <div className="rounded-2xl p-6 mb-6 bg-surface border border-surface text-center text-sm text-text-secondary">
            <Link href="/login" className="text-vault font-semibold hover:underline">
              {t('saved.signIn')}
            </Link>{' '}
            {t('saved.signInHint')}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-text-secondary">{t('saved.loading')}</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-text-secondary mb-3">{t('saved.loadError')}</p>
            <button
              type="button"
              onClick={() => load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-vault"
            >
              {t('saved.tryAgain')}
            </button>
          </div>
        ) : totalVisible === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl py-16 px-6 text-center border border-surface bg-surface/50"
          >
            <p className="text-4xl mb-3">🔖</p>
            <p className="font-semibold text-text mb-2">{t('saved.emptyTitle')}</p>
            <p className="text-sm text-text-secondary max-w-sm mx-auto mb-4">
              {t('saved.emptyBody')}
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-vault to-bazaar"
            >
              {t('saved.exploreFeed')}
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleItems.ideas.map((idea, idx) => (
              <motion.div
                key={`idea-${idea.id}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: Math.min(idx * 0.04, 0.2) }}
              >
                <SavedIdeaCard
                  idea={idea}
                  onUnsave={() => void handleUnsaveIdea(idea.id)}
                  onToggleSave={() => void handleUnsaveIdea(idea.id)}
                />
              </motion.div>
            ))}
            {visibleItems.posts.map((post, idx) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: Math.min(idx * 0.04, 0.2) }}
                className="mb-8"
              >
                {post.id != null && (
                  <PostCard
                    {...post}
                    variant="premium"
                    onSavedChange={() => handleUnsave(`post_${post.id}`)}
                    onDeleted={() => handleUnsave(`post_${post.id}`)}
                  />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>
    </AppShell>
  );
}
