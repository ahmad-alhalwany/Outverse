'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { HashtagIcon, PlayIcon } from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import PostCard from '@/components/PostCard';
import { mapPost, type ApiPost } from '@/utils/postMapper';
import { apiFetch, mediaUrl } from '@/lib/api';
import { reelPagePath } from '@/lib/fetchReel';
import { formatCount } from '@/lib/profileEmotions';
import type { ReelItem } from '@/lib/reelTypes';

export default function TagPage() {
  const params = useParams();
  const raw = Array.isArray(params.tag) ? params.tag[0] : params.tag;
  const tag = raw ? decodeURIComponent(raw) : '';
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [tab, setTab] = useState<'posts' | 'reels'>('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!tag) return;
    setLoading(true);
    setError(false);
    try {
      const [postsRes, reelsRes] = await Promise.all([
        apiFetch(`posts/?tag=${encodeURIComponent(tag)}`),
        apiFetch(`reels/?tag=${encodeURIComponent(tag)}`),
      ]);
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(Array.isArray(data) ? data : data.results || []);
      } else {
        setPosts([]);
        setError(true);
      }
      if (reelsRes.ok) {
        const data = await reelsRes.json();
        setReels(Array.isArray(data) ? data : data.results || []);
      } else {
        setReels([]);
      }
    } catch {
      setPosts([]);
      setReels([]);
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
                {loading
                  ? 'Loading…'
                  : `${mappedPosts.length} ${mappedPosts.length === 1 ? 'post' : 'posts'} · ${reels.length} ${reels.length === 1 ? 'reel' : 'reels'}`}
              </p>
            </div>
          </motion.div>

          {!loading && !error && (
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setTab('posts')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  tab === 'posts' ? 'bg-vault text-white' : 'bg-surface text-text-secondary'
                }`}
              >
                Posts ({mappedPosts.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('reels')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  tab === 'reels' ? 'bg-vault text-white' : 'bg-surface text-text-secondary'
                }`}
              >
                Reels ({reels.length})
              </button>
            </div>
          )}

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
          ) : tab === 'posts' ? (
            mappedPosts.length === 0 ? (
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
            )
          ) : reels.length === 0 ? (
            <div className="text-center py-10 text-text-secondary">No reels with this tag yet.</div>
          ) : (
            <div className="profile-reels-grid">
              {reels.map((reel) => {
                const thumb = mediaUrl(reel.video) || reel.video;
                return (
                  <Link
                    key={reel.id}
                    href={reelPagePath(reel.id)}
                    className="profile-reels-grid__card bg-surface border border-surface"
                  >
                    <div className="profile-reels-grid__thumb">
                      <video
                        src={thumb}
                        className="profile-reels-grid__video"
                        muted
                        playsInline
                        preload="metadata"
                        onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                        onMouseLeave={(e) => {
                          e.currentTarget.pause();
                          e.currentTarget.currentTime = 0;
                        }}
                      />
                      <span className="profile-reels-grid__play">
                        <PlayIcon className="h-5 w-5" />
                      </span>
                      <span className="profile-reels-grid__stat">
                        ▶ {formatCount(reel.views)}
                      </span>
                    </div>
                    <p className="profile-reels-grid__caption">
                      {(reel.caption || 'Signal').slice(0, 42)}
                      {(reel.caption?.length ?? 0) > 42 ? '…' : ''}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
    </AppShell>
  );
}
