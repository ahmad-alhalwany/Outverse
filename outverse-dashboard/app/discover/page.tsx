'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  MagnifyingGlassIcon,
  FireIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import PostTeaser from '@/components/ui/PostTeaser';
import ReelsIcon from '@/components/icons/ReelsIcon';
import { useLocale } from '@/components/LocaleProvider';
import { getUser } from '@/lib/auth';
import { apiFetch, mediaUrl } from '@/lib/api';
import { fetchFeedPage } from '@/lib/postsApi';
import { fetchCommunitiesResult, type Community } from '@/lib/communityApi';
import { fetchReelsDiscover } from '@/lib/reelsApi';
import { mapPost, type MappedPost } from '@/utils/postMapper';
import type { ReelItem } from '@/lib/reelTypes';

type SuggestedCreator = { id: number; username: string; avatar: string | null; followers_count: number };
type Section<T> = { loading: boolean; error: boolean; items: T[] };
const INITIAL = { loading: true, error: false, items: [] };

function SectionHeader({
  icon, title, seeAllHref, seeAllLabel,
}: { icon: React.ReactNode; title: string; seeAllHref?: string; seeAllLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-text">{icon}{title}</h2>
      {seeAllHref && <Link href={seeAllHref} className="text-xs font-semibold text-vault">{seeAllLabel}</Link>}
    </div>
  );
}

function SectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => <div key={i} className="h-14 rounded-xl skeleton-pulse" />)}
    </div>
  );
}

function CommunityTeaser({ c }: { c: Community }) {
  return (
    <Link href={`/communities/${c.slug}`} className="flex items-center justify-between rounded-xl border border-surface bg-surface/30 px-3 py-2.5 hover:bg-surface/60 transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{c.name}</p>
        <p className="text-xs text-text-secondary truncate">{c.description}</p>
      </div>
      <span className="shrink-0 text-xs text-text-secondary ms-3">{c.members_count}</span>
    </Link>
  );
}

function PersonTeaser({ c }: { c: SuggestedCreator }) {
  return (
    <Link href={`/profile/${c.id}`} className="shrink-0 w-28 rounded-xl border border-surface bg-surface/30 p-3 text-center">
      {c.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.avatar} alt="" className="w-12 h-12 rounded-full object-cover mx-auto mb-2" />
      ) : (
        <span className="w-12 h-12 rounded-full bg-gradient-to-tr from-vault to-bazaar mx-auto mb-2 block" />
      )}
      <p className="text-xs font-semibold truncate">{c.username}</p>
    </Link>
  );
}

function ReelTeaser({ reel }: { reel: ReelItem }) {
  return (
    <Link href={`/reels/${reel.id}`} className="shrink-0 w-28 rounded-xl overflow-hidden bg-surface/30 border border-surface">
      <video src={mediaUrl(reel.video) || reel.video} className="w-full aspect-[9/16] object-cover" muted playsInline preload="metadata" />
      <p className="px-1.5 py-1 text-[11px] text-text-secondary truncate">{reel.caption || '…'}</p>
    </Link>
  );
}

export default function DiscoverPage() {
  const { t } = useLocale();
  const [posts, setPosts] = useState<Section<MappedPost>>(INITIAL);
  const [communities, setCommunities] = useState<Section<Community>>(INITIAL);
  const [people, setPeople] = useState<Section<SuggestedCreator>>(INITIAL);
  const [reels, setReels] = useState<Section<ReelItem>>(INITIAL);

  useEffect(() => {
    let cancelled = false;

    fetchFeedPage({ feed: 'discover', limit: 6 }).then((page) => {
      if (cancelled) return;
      if (!page) return setPosts({ loading: false, error: true, items: [] });
      setPosts({ loading: false, error: false, items: page.results.map(mapPost) });
    });

    fetchCommunitiesResult(undefined, 'trending').then(({ communities: list, ok }) => {
      if (cancelled) return;
      setCommunities({ loading: false, error: !ok, items: list.slice(0, 6) });
    });

    const me = getUser()?.id;
    apiFetch(me ? `users/suggestions/?exclude=${me}` : 'users/suggestions/')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: SuggestedCreator[]) => {
        if (cancelled) return;
        setPeople({ loading: false, error: false, items: Array.isArray(list) ? list : [] });
      })
      .catch(() => { if (!cancelled) setPeople({ loading: false, error: true, items: [] }); });

    fetchReelsDiscover().then((data) => {
      if (cancelled) return;
      if (!data) return setReels({ loading: false, error: true, items: [] });
      const items = (data.trending.length ? data.trending : data.fresh).slice(0, 6);
      setReels({ loading: false, error: false, items });
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell contentClassName="flex-1 min-w-0 w-full max-w-3xl mx-auto px-4 pb-16">
      <div className="pt-4 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-text">{t('discover.title')}</h1>
          <p className="text-sm text-text-secondary mt-1">{t('discover.subtitle')}</p>
        </div>

        <Link href="/search" className="flex items-center gap-2 rounded-xl border border-surface bg-surface px-4 py-3 text-sm text-text-secondary hover:bg-surface/60 transition-colors">
          <MagnifyingGlassIcon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          {t('discover.searchCta')}
        </Link>

        <section>
          <SectionHeader icon={<FireIcon className="h-4 w-4 text-bazaar" />} title={t('discover.posts')} seeAllHref="/search" seeAllLabel={t('discover.seeAll')} />
          {posts.loading ? <SectionSkeleton />
            : posts.error ? <ErrorState message={t('discover.loadError')} retryLabel={t('discover.retry')} onRetry={() => window.location.reload()} />
            : posts.items.length === 0 ? <EmptyState icon="✨" title={t('discover.postsEmpty')} />
            : <div className="space-y-2">{posts.items.map((p) => <PostTeaser key={p.id} post={p} />)}</div>}
        </section>

        <section>
          <SectionHeader icon={<UserGroupIcon className="h-4 w-4 text-vault" />} title={t('discover.communities')} seeAllHref="/communities" seeAllLabel={t('discover.communitiesSeeAll')} />
          {communities.loading ? <SectionSkeleton />
            : communities.error ? <ErrorState message={t('discover.loadError')} retryLabel={t('discover.retry')} onRetry={() => window.location.reload()} />
            : communities.items.length === 0 ? <EmptyState icon="🌌" title={t('discover.communitiesEmpty')} />
            : <div className="space-y-2">{communities.items.map((c) => <CommunityTeaser key={c.id} c={c} />)}</div>}
        </section>

        <section>
          <SectionHeader icon={<UsersIcon className="h-4 w-4 text-lab" />} title={t('discover.people')} />
          {people.loading ? <div className="flex gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-28 h-32 rounded-xl skeleton-pulse shrink-0" />)}</div>
            : people.error ? <ErrorState message={t('discover.loadError')} retryLabel={t('discover.retry')} onRetry={() => window.location.reload()} />
            : people.items.length === 0 ? <EmptyState icon="👋" title={t('discover.peopleEmpty')} />
            : <div className="flex gap-3 overflow-x-auto pb-1">{people.items.map((c) => <PersonTeaser key={c.id} c={c} />)}</div>}
        </section>

        <section>
          <SectionHeader icon={<ReelsIcon size={18} active />} title={t('discover.reels')} seeAllHref="/reels/discover" seeAllLabel={t('discover.reelsSeeAll')} />
          {reels.loading ? <div className="flex gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="w-28 aspect-[9/16] rounded-xl skeleton-pulse shrink-0" />)}</div>
            : reels.error ? <ErrorState message={t('discover.loadError')} retryLabel={t('discover.retry')} onRetry={() => window.location.reload()} />
            : reels.items.length === 0 ? <EmptyState icon="🎬" title={t('discover.reelsEmpty')} />
            : <div className="flex gap-3 overflow-x-auto pb-1">{reels.items.map((r) => <ReelTeaser key={r.id} reel={r} />)}</div>}
        </section>
      </div>
    </AppShell>
  );
}
