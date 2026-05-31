'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { mapPost } from '@/utils/postMapper';
import { apiFetch } from '@/lib/api';

import { apiUrl } from '@/lib/api';

const POSTS_API = apiUrl('posts/');

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [post, setPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    setError(false);
    try {
      const res = await apiFetch(`posts/${id}/`);
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
  }, [id]);

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
            <ArrowLeftIcon className="h-4 w-4" /> Back
          </button>

          {loading ? (
            <div className="text-center py-16">Loading…</div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-text-secondary mb-3">Could not load this post.</p>
              <button
                type="button"
                onClick={() => load()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-vault"
              >
                Try again
              </button>
            </div>
          ) : notFound || !post ? (
            <div className="text-center py-16 text-text-secondary">Post not found.</div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PostCard {...post} onDeleted={() => router.push('/')} onUpdated={load} />
            </motion.div>
          )}
        </section>
    </AppShell>
  );
}
