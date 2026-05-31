'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BookmarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { mapPost } from '@/utils/postMapper';
import { isAuthenticated } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { apiUrl } from '@/lib/api';

const SAVED_API = apiUrl('posts/saved/');

export default function SavedPostsPage() {
  const [posts, setPosts] = useState<ReturnType<typeof mapPost>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch('posts/saved/');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setPosts(Array.isArray(data) ? data.map(mapPost) : []);
    } catch {
      setPosts([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSavedChange = (postId: number, saved: boolean) => {
    if (!saved) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  };

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
      <section className="pt-2">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              <BookmarkIcon className="h-7 w-7 text-vault" />
              Saved posts
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Posts you bookmarked for later.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-text-secondary hover:text-text hover:bg-surface border border-surface transition disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {!isAuthenticated() && (
          <div className="rounded-2xl p-6 mb-6 bg-surface border border-surface text-center text-sm text-text-secondary">
            <Link href="/login" className="text-vault font-semibold hover:underline">
              Sign in
            </Link>{' '}
            to sync saved posts across devices.
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-text-secondary">Loading saved posts…</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-text-secondary mb-3">Could not load saved posts.</p>
            <button
              type="button"
              onClick={() => load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-vault"
            >
              Try again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl py-16 px-6 text-center border border-surface bg-surface/50"
          >
            <p className="text-4xl mb-3">🔖</p>
            <p className="font-semibold text-text mb-2">Nothing saved yet</p>
            <p className="text-sm text-text-secondary max-w-sm mx-auto mb-4">
              Tap the bookmark on any post in your feed to save it here.
            </p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-vault to-bazaar"
            >
              Explore feed
            </Link>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {posts.map((post, idx) => (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: Math.min(idx * 0.04, 0.2) }}
                className="mb-8"
              >
                <PostCard
                  {...post}
                  variant="premium"
                  onSavedChange={handleSavedChange}
                  onDeleted={() => handleSavedChange(post.id, false)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>
    </AppShell>
  );
}
