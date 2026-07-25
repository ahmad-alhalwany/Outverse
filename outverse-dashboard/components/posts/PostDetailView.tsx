'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { useLocale } from '@/components/LocaleProvider';
import { mapPost } from '@/utils/postMapper';
import { apiFetch } from '@/lib/api';

export default function PostDetailView({ postId }: { postId: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [post, setPost] = useState<ReturnType<typeof mapPost> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setNotFound(false);
    setError(false);
    try {
      const res = await apiFetch(`posts/${postId}/`);
      if (res.ok) {
        setPost(mapPost(await res.json()));
      } else if (res.status === 404) {
        setPost(null);
        setNotFound(true);
      } else {
        setPost(null);
        setError(true);
      }
    } catch {
      setPost(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
      <section>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-text mb-4 text-sm"
        >
          <ArrowLeftIcon className="h-4 w-4" /> {t('common.back')}
        </button>

        {loading ? (
          <div className="text-center py-16">{t('common.loading')}</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-text-secondary mb-3">{t('feed.loadError')}</p>
            <button
              type="button"
              onClick={() => load()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-vault"
            >
              {t('feed.retry')}
            </button>
          </div>
        ) : notFound || !post ? (
          <div className="text-center py-16 text-text-secondary">{t('feed.emptyFeed')}</div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <PostCard {...post} onDeleted={() => router.push('/')} onUpdated={load} />
          </motion.div>
        )}
      </section>
    </AppShell>
  );
}
