'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArchiveBoxIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FireIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  UserIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, mediaUrl } from '@/lib/api';

type SearchTab = 'users' | 'posts' | 'ideas' | 'stories' | 'challenges' | 'reels' | 'bottles' | 'shop';
type ViewMode = 'grid' | 'list';

type SearchResults = {
  users: { id: number; username: string; name: string; avatar: string | null }[];
  posts: { id: number; snippet: string; author: string }[];
  reels: { id: number; caption: string; author: string; tags: string[] }[];
  ideas: { id: number; title: string; description: string; owner: string }[];
  stories: { id: number; title: string; description: string; owner: string }[];
  bottles: { id: number; message: string; emotion_type: string; sender: string }[];
  shop: { id: number; name: string; description: string; creator: string; price: number }[];
  challenges: { id: number; title: string; description: string; type: string }[];
};

type ResultCard = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  description: string;
  meta: string;
  tab: SearchTab;
  avatar?: string | null;
};

const EMPTY_RESULTS: SearchResults = {
  users: [],
  posts: [],
  reels: [],
  ideas: [],
  stories: [],
  bottles: [],
  shop: [],
  challenges: [],
};

const PALETTES = {
  light: {
    page: '#F3F0FC',
    card: '#FFFFFF',
    cardSoft: '#F5F1FE',
    border: 'rgba(124, 58, 237, 0.16)',
    text: '#211B3D',
    textMuted: '#79709E',
    accent: '#7C3AED',
    accentSoft: '#EDE4FB',
    accentStrong: '#5B21B6',
    shadow: '0 18px 40px rgba(124, 58, 237, 0.10)',
  },
  dark: {
    page: '#12101F',
    card: '#1B1836',
    cardSoft: '#231F3F',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#F5F3FF',
    textMuted: '#B0A6D9',
    accent: '#C4B5FD',
    accentSoft: '#2D2450',
    accentStrong: '#A78BFA',
    shadow: '0 18px 40px rgba(0, 0, 0, 0.28)',
  },
};

const TAB_META: Record<SearchTab, { labelKey: string; icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>; color: string }> = {
  users: { labelKey: 'search.creators', icon: UserIcon, color: 'from-vault to-bazaar' },
  posts: { labelKey: 'search.posts', icon: DocumentTextIcon, color: 'from-lab to-bazaar' },
  ideas: { labelKey: 'search.ideas', icon: LightBulbIcon, color: 'from-bazaar to-vault' },
  stories: { labelKey: 'search.stories', icon: BookOpenIcon, color: 'from-story to-lab' },
  challenges: { labelKey: 'search.challenges', icon: FireIcon, color: 'from-story to-shop' },
  reels: { labelKey: 'search.signals', icon: PlayIcon, color: 'from-vault to-story' },
  bottles: { labelKey: 'search.vaultTab', icon: ArchiveBoxIcon, color: 'from-vault to-bazaar' },
  shop: { labelKey: 'search.shopTab', icon: ShoppingCartIcon, color: 'from-bazaar to-shop' },
};

const SEARCH_TABS: SearchTab[] = ['users', 'posts', 'ideas', 'stories', 'challenges', 'reels', 'bottles', 'shop'];
const PAGINATED_CATEGORIES: SearchTab[] = SEARCH_TABS;
const INITIAL_CATEGORY_CAP = 5;
const LOAD_MORE_PAGE_SIZE = 12;

function buildCards(results: SearchResults, t: (key: string, vars?: Record<string, string>) => string): ResultCard[] {
  const userCards: ResultCard[] = results.users.map((u) => ({
    id: `users-${u.id}`,
    href: `/profile/${u.id}`,
    title: u.name || `@${u.username}`,
    subtitle: `@${u.username}`,
    description: '',
    meta: '',
    tab: 'users',
    avatar: u.avatar ? mediaUrl(u.avatar) : null,
  }));
  const postCards: ResultCard[] = results.posts.map((p) => ({
    id: `posts-${p.id}`,
    href: `/post/${p.id}`,
    title: p.snippet || t('search.untitledPost'),
    subtitle: `@${p.author}`,
    description: '',
    meta: '',
    tab: 'posts',
  }));
  const ideaCards: ResultCard[] = results.ideas.map((idea) => ({
    id: `ideas-${idea.id}`,
    href: `/bazaar/${idea.id}`,
    title: idea.title,
    subtitle: `by @${idea.owner}`,
    description: idea.description,
    meta: '',
    tab: 'ideas',
  }));
  const storyCards: ResultCard[] = results.stories.map((story) => ({
    id: `stories-${story.id}`,
    href: `/forge?story=${story.id}`,
    title: story.title,
    subtitle: `by @${story.owner}`,
    description: story.description,
    meta: '',
    tab: 'stories',
  }));
  const challengeCards: ResultCard[] = results.challenges.map((ch) => ({
    id: `challenges-${ch.id}`,
    href: `/lab?challenge=${ch.id}`,
    title: ch.title,
    subtitle: ch.type,
    description: ch.description,
    meta: '',
    tab: 'challenges',
  }));
  const reelCards: ResultCard[] = results.reels.map((reel) => ({
    id: `reels-${reel.id}`,
    href: `/reels/${reel.id}`,
    title: reel.caption || t('search.untitledReel'),
    subtitle: `@${reel.author}`,
    description: reel.tags?.length ? reel.tags.map((tag) => `#${tag}`).join(' ') : '',
    meta: '',
    tab: 'reels',
  }));
  const bottleCards: ResultCard[] = results.bottles.map((b) => ({
    id: `bottles-${b.id}`,
    href: '/bottles',
    title: b.message,
    subtitle: `@${b.sender}`,
    description: '',
    meta: b.emotion_type,
    tab: 'bottles',
  }));
  const shopCards: ResultCard[] = results.shop.map((item) => ({
    id: `shop-${item.id}`,
    href: `/shop/${item.id}`,
    title: item.name,
    subtitle: `by @${item.creator}`,
    description: item.description,
    meta: `${item.price} ✨`,
    tab: 'shop',
  }));

  return [...userCards, ...postCards, ...ideaCards, ...storyCards, ...challengeCards, ...reelCards, ...bottleCards, ...shopCards];
}

function ResultCardView({ card, palette, compact }: { card: ResultCard; palette: (typeof PALETTES)['light']; compact: boolean }) {
  const { t } = useLocale();
  const meta = TAB_META[card.tab];
  const Icon = meta.icon;
  return (
    <Link
      href={card.href}
      className={`group overflow-hidden rounded-[24px] border transition-transform duration-200 hover:-translate-y-1 ${
        compact ? 'flex gap-4 p-4 items-center' : 'block p-5'
      }`}
      style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
    >
      {card.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.avatar}
          alt={card.title}
          className={`object-cover rounded-2xl shrink-0 ${compact ? 'h-14 w-14' : 'h-12 w-12 mb-4'}`}
        />
      ) : (
        <span
          className={`bg-gradient-to-tr ${meta.color} text-white flex items-center justify-center rounded-2xl shrink-0 ${
            compact ? 'h-14 w-14' : 'h-12 w-12 mb-4'
          }`}
        >
          <Icon className={compact ? 'h-6 w-6' : 'h-5 w-5'} strokeWidth={1.8} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
            style={{ background: palette.accentSoft, color: palette.accentStrong }}
          >
            {t(meta.labelKey)}
          </span>
          {card.meta && <span className="text-xs shrink-0" style={{ color: palette.textMuted }}>{card.meta}</span>}
        </div>
        <h3 className="mt-2 text-[1.05rem] font-semibold tracking-[-0.02em] truncate" style={{ color: palette.text }}>
          {card.title}
        </h3>
        {card.subtitle && (
          <p className="mt-1 text-sm truncate" style={{ color: palette.textMuted }}>
            {card.subtitle}
          </p>
        )}
        {card.description && !compact && (
          <p className="mt-3 text-sm leading-6 line-clamp-2" style={{ color: palette.textMuted }}>
            {card.description}
          </p>
        )}
      </div>
    </Link>
  );
}

function SearchContent() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const palette = PALETTES[theme];
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('users');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchValue, setSearchValue] = useState(searchParams.get('q')?.trim() ?? '');
  const [moreAvailable, setMoreAvailable] = useState<Partial<Record<SearchTab, boolean>>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const query = searchParams.get('q')?.trim() ?? '';

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setResults(EMPTY_RESULTS);
      setMoreAvailable({});
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    apiFetch(`search/?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('search failed');
        return (await res.json()) as SearchResults;
      })
      .then((data) => {
        if (cancelled) return;
        const merged = { ...EMPTY_RESULTS, ...data };
        setResults(merged);
        const next: Partial<Record<SearchTab, boolean>> = {};
        PAGINATED_CATEGORIES.forEach((tab) => {
          next[tab] = (merged[tab]?.length ?? 0) >= INITIAL_CATEGORY_CAP;
        });
        setMoreAvailable(next);
        // Land on the first tab that actually has results, instead of always "Creators".
        const firstWithResults = SEARCH_TABS.find((tab) => (merged[tab]?.length ?? 0) > 0);
        if (firstWithResults) setActiveTab(firstWithResults);
      })
      .catch(() => {
        if (!cancelled) {
          setResults(EMPTY_RESULTS);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, retryTick]);

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const offset = results[activeTab]?.length ?? 0;
      const res = await apiFetch(
        `search/?q=${encodeURIComponent(query)}&category=${activeTab}&offset=${offset}&limit=${LOAD_MORE_PAGE_SIZE}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { results: unknown[]; count: number; has_more: boolean };
      setResults((prev) => ({
        ...prev,
        [activeTab]: [...(prev[activeTab] as unknown[]), ...data.results],
      }));
      setMoreAvailable((prev) => ({ ...prev, [activeTab]: data.has_more }));
    } finally {
      setLoadingMore(false);
    }
  }

  const cards = useMemo(() => buildCards(results, t), [results, t]);
  const filteredCards = useMemo(() => cards.filter((card) => card.tab === activeTab), [activeTab, cards]);

  const totalResults = useMemo(
    () => SEARCH_TABS.reduce((sum, tab) => sum + (results[tab]?.length ?? 0), 0),
    [results],
  );

  function submitSearch() {
    const nextQuery = searchValue.trim();
    router.push(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : '/search');
  }

  return (
    <AppShell
      className="min-h-screen"
      style={{ background: palette.page, color: palette.text }}
      maxWidth="max-w-[1440px]"
      contentClassName="flex-1 min-w-0 w-full px-4 pb-16 lg:px-6"
    >
      <div className="space-y-8">
        <div className="border-b pb-6 pt-2" style={{ borderColor: palette.border }}>
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em]" style={{ color: palette.text }}>
            {t('search.pageTitle')}
          </h1>
          <p className="mt-2 text-sm" style={{ color: palette.textMuted }}>
            {query
              ? t('search.resultsForQuery', {
                  count:
                    totalResults === 1
                      ? t('search.resultCount', { count: String(totalResults) })
                      : t('search.resultCountPlural', { count: String(totalResults) }),
                  query,
                })
              : t('search.exploreCosmory')}
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitSearch();
          }}
          className="flex items-center gap-3 rounded-2xl border px-5 py-4"
          style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
        >
          <button
            type="submit"
            aria-label={t('search.searchPlaceholder')}
            className="shrink-0"
            style={{ color: palette.textMuted }}
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder={t('search.searchPlaceholder')}
            className="w-full bg-transparent text-base outline-none placeholder:text-current"
            style={{ color: palette.textMuted }}
          />
        </form>

        {query && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {SEARCH_TABS.map((tab) => {
                const meta = TAB_META[tab];
                const Icon = meta.icon;
                const active = activeTab === tab;
                const count = results[tab]?.length ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      background: active ? palette.accentSoft : 'transparent',
                      color: active ? palette.accentStrong : palette.text,
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{t(meta.labelKey)}</span>
                    <span className="text-xs opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 rounded-2xl p-1" style={{ background: palette.cardSoft }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className="rounded-xl p-3 transition-colors"
                style={{ background: viewMode === 'grid' ? palette.accent : 'transparent', color: viewMode === 'grid' ? '#FFFFFF' : palette.textMuted }}
                aria-label={t('search.gridView')}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="rounded-xl p-3 transition-colors"
                style={{ background: viewMode === 'list' ? palette.accent : 'transparent', color: viewMode === 'list' ? '#FFFFFF' : palette.textMuted }}
                aria-label={t('search.listView')}
              >
                <ViewColumnsIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[24px] border p-5"
                style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
              >
                <div className="h-12 w-12 rounded-2xl skeleton-pulse mb-4" />
                <div className="h-4 w-3/4 rounded skeleton-pulse mb-2" />
                <div className="h-3 w-1/2 rounded skeleton-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            className="rounded-[28px] border px-6 py-16 text-center"
            style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
          >
            <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-3" style={{ color: palette.textMuted }} />
            <h2 className="text-xl font-semibold" style={{ color: palette.text }}>
              {t('search.loadError')}
            </h2>
            <button
              type="button"
              onClick={() => setRetryTick((n) => n + 1)}
              className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
              style={{ background: palette.accentSoft, color: palette.accentStrong }}
            >
              {t('search.retry')}
            </button>
          </div>
        ) : !query ? (
          <div
            className="rounded-[28px] border px-6 py-16 text-center"
            style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
          >
            <MagnifyingGlassIcon className="h-8 w-8 mx-auto mb-3" style={{ color: palette.textMuted }} />
            <h2 className="text-xl font-semibold" style={{ color: palette.text }}>
              {t('search.startTyping')}
            </h2>
            <p className="mt-2 text-sm" style={{ color: palette.textMuted }}>
              {t('search.startTypingHint')}
            </p>
          </div>
        ) : totalResults === 0 ? (
          <div
            className="rounded-[28px] border px-6 py-16 text-center"
            style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
          >
            <h2 className="text-xl font-semibold" style={{ color: palette.text }}>
              {t('search.noResults', { query })}
            </h2>
            <p className="mt-3 text-sm" style={{ color: palette.textMuted }}>
              {t('search.noResultsHint')}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchValue('');
                router.push('/search');
              }}
              className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors"
              style={{ background: palette.accentSoft, color: palette.accentStrong }}
            >
              {t('search.clearSearch')}
            </button>
          </div>
        ) : (
          <>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-6 xl:grid-cols-3 md:grid-cols-2' : 'grid grid-cols-1 gap-4'}>
              {filteredCards.map((card) => (
                <ResultCardView key={card.id} card={card} palette={palette} compact={viewMode === 'list'} />
              ))}
            </div>

            {moreAvailable[activeTab] && (
              <div className="flex justify-center pb-4">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-full px-6 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{ background: palette.accentSoft, color: palette.accentStrong }}
                >
                  {loadingMore ? t('search.loadingMore') : t('search.viewMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function SearchFallback() {
  const { t } = useLocale();
  return <div className="min-h-screen flex items-center justify-center">{t('search.loadingMore')}</div>;
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchContent />
    </Suspense>
  );
}
