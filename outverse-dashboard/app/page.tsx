'use client';

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import PostCard from '../components/PostCard';
import RightSidebar from '../components/RightSidebar';
import CreatePostCard from '../components/CreatePostCard';
<<<<<<< HEAD
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
=======
import StoriesSidebar from '../components/StoriesSidebar';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { formatRelativeTime } from '../utils/dateFormatter';

const API_URL = 'http://localhost:8000/api/posts/';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        setPosts(data);
      } catch (err) {
        setPosts([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  // بعد جلب البيانات:
  const mappedPosts = posts.map((post: any) => {
    // معالجة user
    const user = post.user
      ? {
          name: userFullName(post.user),
          avatar: post.user.avatar || '',
        }
      : { name: '', avatar: '' };
    // معالجة الصور والفيديوهات
    const images = post.media
      ? post.media.filter((m: any) => m.media_type === 'image').map((m: any) => fullMediaUrl(m.media_file))
      : [];
    const videos = post.media
      ? post.media.filter((m: any) => m.media_type === 'video').map((m: any) => fullMediaUrl(m.media_file))
      : [];
    // معالجة الإحصائيات
    const stats = {
      views: post.views || 0,
      comments: post.comments_count || 0,
      shares: post.shares_count || 0,
    };
    return {
      ...post,
      user,
      images,
      videos,
      stats,
      time: formatRelativeTime(new Date(post.created_at)),
    };
  });

  function userFullName(user: any) {
    if (user.first_name || user.last_name) return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return user.username || '';
  }
  function fullMediaUrl(url: string) {
    if (!url) return '';
    return url.startsWith('http') ? url : `http://localhost:8000${url}`;
  }

  return (
    <main className="min-h-screen bg-background text-text">
      <StoriesSidebar />
      <Header />
      <div className="pt-20 max-w-7xl mx-auto flex" style={{ marginLeft: 80 }}>
        <Sidebar />
        <section className="flex-1 max-w-2xl mx-auto px-4">
          <DailyChallengeCard />
          <CreatePostCard />
          {loading ? (
            <div className="text-center py-10">Loading...</div>
          ) : (
            <AnimatePresence initial={false}>
              {mappedPosts.map((post, idx) => (
                <motion.div
                  key={post.id || idx}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 0.5, type: 'spring', stiffness: 80 }}
                  className="mb-6"
                >
                  <PostCard {...post} />
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
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
