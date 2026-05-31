'use client';

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import RightSidebar from '../components/RightSidebar';
import CreatePostCard from '../components/CreatePostCard';
import FeedHero from '@/components/home/FeedHero';
import HomeStoriesRail from '@/components/home/HomeStoriesRail';
import DailyChallengeBanner from '@/components/home/DailyChallengeBanner';
import FeedTabs from '@/components/home/FeedTabs';
import PostFeedSkeleton from '@/components/home/PostFeedSkeleton';
import HomeMobileNav from '@/components/home/HomeMobileNav';
import HomeDiscoverMobile from '@/components/home/HomeDiscoverMobile';
import { AnimatePresence, motion } from 'framer-motion';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mapPost } from '../utils/postMapper';
import { apiFetch, apiUrl } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const API_URL = apiUrl('posts/');

function HomeContent() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [feed, setFeed] = useState<'all' | 'following'>(
    searchParams.get('feed') === 'following' ? 'following' : 'all',
  );

  useEffect(() => {
    setFeed(searchParams.get('feed') === 'following' ? 'following' : 'all');
  }, [searchParams]);

  const fetchPosts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(false);
    try {
      const feedParam = feed === 'following' ? '?feed=following' : '';
      const res = await apiFetch(`posts/${feedParam}`);
      if (!res.ok) throw new Error('feed failed');
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch {
      setPosts([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [feed]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const mappedPosts = posts.map((post: unknown) => mapPost(post));

  const setFeedTab = (tab: 'all' | 'following') => {
    router.push(tab === 'following' ? '/?feed=following' : '/');
  };

  return (
    <main className="min-h-screen bg-background text-text home-feed">
      <Header />
      <div className="home-app-shell app-shell pt-20 max-w-7xl mx-auto flex w-full min-w-0">
        <Sidebar />
        <section className="flex-1 max-w-2xl lg:max-w-3xl mx-auto px-3 sm:px-4 pb-20 md:pb-16 w-full min-w-0">
          <FeedHero />
          <HomeStoriesRail onRefresh={() => fetchPosts(true)} />
          <DailyChallengeBanner />
          <div id="create-post">
            <CreatePostCard onPublished={() => fetchPosts(true)} />
          </div>

          <HomeDiscoverMobile />

          <FeedTabs
            feed={feed}
            onChange={setFeedTab}
            postCount={loading ? undefined : mappedPosts.length}
          />

          <div className="flex justify-end mb-3">
            <button
              type="button"
              onClick={() => fetchPosts(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-vault transition disabled:opacity-50"
              aria-label="Refresh feed"
            >
              <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {t('feed.refresh')}
            </button>
          </div>

          {loading ? (
            <PostFeedSkeleton count={4} />
          ) : error ? (
            <div className="empty-feed rounded-2xl py-12 px-6 text-center">
              <ExclamationTriangleIcon className="h-10 w-10 mx-auto text-bazaar mb-3" />
              <p className="font-semibold text-text mb-2">{t('feed.loadError')}</p>
              <button
                type="button"
                onClick={() => fetchPosts()}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-vault"
              >
                {t('feed.retry')}
              </button>
            </div>
          ) : mappedPosts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-feed rounded-2xl py-16 px-6 text-center"
            >
              <p className="text-4xl mb-3">🌌</p>
              <p className="font-semibold text-text mb-2">
                {feed === 'following'
                  ? 'Your following feed is quiet'
                  : 'The cosmos awaits you'}
              </p>
              <p className="text-sm text-text-secondary max-w-sm mx-auto mb-4">
                {feed === 'following'
                  ? 'Follow creators from suggestions below or the sidebar on larger screens.'
                  : 'Post your first spark — a post or a story.'}
              </p>
              {feed === 'following' ? (
                <button
                  type="button"
                  onClick={() => setFeedTab('all')}
                  className="text-sm font-semibold text-vault hover:underline"
                >
                  View everyone&apos;s feed
                </button>
              ) : (
                <a
                  href="#create-post"
                  className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-vault to-bazaar"
                >
                  Create a post
                </a>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout" initial={false}>
              {mappedPosts.map((post, idx) => (
                <motion.div
                  key={post.id || idx}
                  layout
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{
                    duration: 0.45,
                    type: 'spring',
                    stiffness: 90,
                    delay: Math.min(idx * 0.04, 0.2),
                  }}
                  className="mb-8"
                >
                  <PostCard
                    {...post}
                    variant="premium"
                    onDeleted={() => fetchPosts(true)}
                    onUpdated={() => fetchPosts(true)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </section>
        <RightSidebar />
      </div>
      <HomeMobileNav />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background text-text flex items-center justify-center pt-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full border-2 border-vault border-t-transparent animate-spin" />
            <span className="text-text-secondary text-sm">Loading Outverse…</span>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
