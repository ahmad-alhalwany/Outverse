'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { HashtagIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { mapPost } from '@/utils/postMapper';
import { apiFetch } from '@/lib/api';

import { apiUrl } from '@/lib/api';

const POSTS_API = apiUrl('posts/');

export default function TagPage() {
  const params = useParams();
  const raw = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const tag = raw ? decodeURIComponent(raw) : '';
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!tag) return;
    setLoading(true);
    setError(false);
    try {
      const res = await apiFetch(`posts/?tag=${encodeURIComponent(tag)}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
      } else {
        setPosts([]);
        setError(true);
      }
    } catch {
      setPosts([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    load();
  }, [load]);

  const mappedPosts = posts.map((post) => mapPost(post));

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-2xl mx-auto px-4 pb-12">
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-6 mb-6 flex items-center gap-3"
          >
            <span className="w-12 h-12 rounded-full bg-gradient-to-tr from-lab to-bazaar text-white flex items-center justify-center">
              <HashtagIcon className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold">#{tag}</h1>
              <p className="text-text-secondary text-sm">
                {loading ? 'Loading…' : `${mappedPosts.length} ${mappedPosts.length === 1 ? 'post' : 'posts'}`}
              </p>
            </div>
          </motion.div>

          {loading ? (
            <div className="text-center py-10">Loading…</div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-text-secondary mb-3">Could not load posts.</p>
              <button
                type="button"
                onClick={() => load()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-vault"
              >
                Try again
              </button>
            </div>
          ) : mappedPosts.length === 0 ? (
            <div className="text-center py-10 text-text-secondary">No posts with this tag yet.</div>
          ) : (
            mappedPosts.map((post, idx) => (
              <motion.div
                key={post.id || idx}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.03 }}
                className="mb-6"
              >
                <PostCard {...post} onDeleted={load} onUpdated={load} />
              </motion.div>
            ))
          )}
        </section>
    </AppShell>
  );
}
