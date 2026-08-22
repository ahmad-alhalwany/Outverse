'use client';

import dynamic from 'next/dynamic';
import FeedTabs from '@/components/home/FeedTabs';
import PostFeedSkeleton from '@/components/home/PostFeedSkeleton';
import HomeMobileNav from '@/components/home/HomeMobileNav';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mapPost, type ApiPost } from '@/utils/postMapper';
import { fetchFeedPage, type HomeFeed } from '@/lib/postsApi';
import { useLocale } from '@/components/LocaleProvider';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const Header = dynamic(() => import('@/components/Header'), { ssr: false });
const Sidebar = dynamic(() => import('@/components/Sidebar'), { ssr: false });
const CreatePostCard = dynamic(() => import('@/components/CreatePostCard'), {
  ssr: false,
  loading: () => <div className="h-32 rounded-2xl bg-surface/40 animate-pulse mb-6" />,
});
const FeedHero = dynamic(() => import('@/components/home/FeedHero'), {
  ssr: false,
  loading: () => <div className="h-24 rounded-2xl bg-surface/30 animate-pulse mb-4" />,
});
const HomeStoriesRail = dynamic(() => import('@/components/home/HomeStoriesRail'), {
  ssr: false,
  loading: () => <div className="h-20 rounded-xl bg-surface/30 animate-pulse mb-4" />,
});
const HomePostList = dynamic(() => import('@/components/home/HomePostList'), {
  ssr: false,
  loading: () => <PostFeedSkeleton count={4} />,
});
const RightSidebar = dynamic(() => import('@/components/RightSidebar'), {
  ssr: false,
  loading: () => <aside className="w-80 hidden xl:block shrink-0" aria-hidden />,
});
const DailyChallengeBanner = dynamic(
  () => import('@/components/home/DailyChallengeBanner'),
  { ssr: false, loading: () => null },
);
const DailyRitualPanel = dynamic(
  () => import('@/components/home/DailyRitualPanel'),
  { ssr: false, loading: () => null },
);
const HomeDiscoverMobile = dynamic(
  () => import('@/components/home/HomeDiscoverMobile'),
  { ssr: false, loading: () => null },
);

const FEED_PAGE_SIZE = 10;

export default function HomePageClient({
  initialPosts,
  initialFeed,
}: {
  initialPosts: ApiPost[];
  initialFeed: HomeFeed;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [posts, setPosts] = useState<ApiPost[]>(initialPosts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= FEED_PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [feed, setFeed] = useState<HomeFeed>(initialFeed);
  const offsetRef = useRef(initialPosts.length);
  // Tracks which feed the current `posts` state is actually for for, so the
  // fetch-on-feed-change effect below can't be skipped by ordering luck
  // between it and the server-hydration effect (both react to a tab click:
  // router.push triggers a fresh server render with new initialFeed/
  // initialPosts, while the local `feed` state change fires independently —
  // a boolean "skip once" flag raced between them and could silently drop
  // the fetch. Comparing against the actual feed value is race-proof.
  const syncedFeedRef = useRef(initialFeed);

  useEffect(() => {
    setFeed(initialFeed);
    setPosts(initialPosts);
    offsetRef.current = initialPosts.length;
    setHasMore(initialPosts.length >= FEED_PAGE_SIZE);
    setLoading(false);
    setError(false);
    syncedFeedRef.current = initialFeed;
  }, [initialFeed, initialPosts]);

  const fetchPosts = useCallback(async (reset = true, silent = false) => {
    if (reset) {
      if (!silent) setLoading(true);
      else setRefreshing(true);
    } else {
      setLoadingMore(true);
    }
    setError(false);
    try {
      const offset = reset ? 0 : offsetRef.current;
      const page = await fetchFeedPage({
        feed,
        limit: FEED_PAGE_SIZE,
        offset,
      });
      if (!page) throw new Error('feed failed');
      setPosts((prev) => (reset ? page.results : [...prev, ...page.results]));
      offsetRef.current = offset + page.results.length;
      setHasMore(page.has_more);
    } catch {
      if (reset) setPosts([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [feed]);

  useEffect(() => {
    if (syncedFeedRef.current === feed) return;
    syncedFeedRef.current = feed;
    void fetchPosts(true);
  }, [feed, fetchPosts]);

  const loadMorePosts = () => {
    if (!loadingMore && hasMore) void fetchPosts(false);
  };

  const mappedPosts = posts.map((post) => mapPost(post));

  const setFeedTab = (tab: HomeFeed) => {
    const q = tab === 'for_you' ? '' : `?feed=${tab}`;
    setFeed(tab);
    router.push(`/${q}`, { scroll: false });
  };

  return (
    <main className="min-h-screen bg-background text-text home-feed">
      <Header />
      <div className="home-page-shell home-app-shell app-shell pt-24 max-w-[1440px] mx-auto flex w-full min-w-0">
        <Sidebar />
        <section className="home-main-column flex-1 mx-auto px-3 sm:px-5 pb-20 md:pb-16 w-full min-w-0">
          <FeedHero />
          <DailyRitualPanel />
          <DailyChallengeBanner />
          <HomeStoriesRail onRefresh={() => fetchPosts(true, true)} />
          <div id="create-post">
            <CreatePostCard onPublished={() => fetchPosts(true, true)} />
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
              onClick={() => fetchPosts(true, true)}
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
            <div className="empty-feed rounded-2xl py-16 px-6 text-center home-empty-feed">
              <p className="text-4xl mb-3">🌌</p>
              <p className="font-semibold text-text mb-2">
                {feed === 'following'
                  ? 'Your following feed is quiet'
                  : feed === 'discover'
                    ? 'Nothing new to discover yet'
                    : feed === 'joined'
                      ? t('feed.emptyResonanceTitle')
                      : 'The cosmos awaits you'}
              </p>
              <p className="text-sm text-text-secondary max-w-sm mx-auto mb-4">
                {feed === 'following'
                  ? 'Follow creators from suggestions below or the sidebar on larger screens.'
                  : feed === 'discover'
                    ? 'Trending signals from beyond your orbit will appear here.'
                    : feed === 'joined'
                      ? t('feed.emptyResonanceBody')
                      : 'Post your first spark — a post or a story.'}
              </p>
              {feed === 'following' ? (
                <button
                  type="button"
                  onClick={() => setFeedTab('for_you')}
                  className="text-sm font-semibold text-vault hover:underline"
                >
                  View For You feed
                </button>
              ) : feed === 'discover' ? (
                <button
                  type="button"
                  onClick={() => setFeedTab('for_you')}
                  className="text-sm font-semibold text-vault hover:underline"
                >
                  Back to For You
                </button>
              ) : feed === 'joined' ? (
                <a
                  href="/communities"
                  className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-vault to-bazaar"
                >
                  {t('feed.browseCommunities')}
                </a>
              ) : (
                <a
                  href="#create-post"
                  className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-vault to-bazaar"
                >
                  Create a post
                </a>
              )}
            </div>
          ) : (
            <>
              <HomePostList
                posts={mappedPosts}
                onDeleted={() => fetchPosts(true, true)}
                onUpdated={() => fetchPosts(true, true)}
              />
              {hasMore && (
                <div className="flex justify-center mt-4 mb-8">
                  <button
                    type="button"
                    onClick={loadMorePosts}
                    disabled={loadingMore}
                    className="home-feed__loadmore"
                  >
                    {loadingMore ? t('common.loading') : t('feed.loadMoreFeed')}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
        <RightSidebar />
      </div>
      <HomeMobileNav />
    </main>
  );
}
