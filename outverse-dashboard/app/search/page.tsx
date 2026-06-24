'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpenIcon,
  FireIcon,
  LightBulbIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
  SunIcon,
  UserIcon,
  ViewColumnsIcon,
} from '@heroicons/react/24/outline';
import AppShell from '@/components/AppShell';
import { useTheme } from '@/components/ThemeProvider';
import { apiFetch, mediaUrl } from '@/lib/api';

type SearchTab = 'users' | 'ideas' | 'stories' | 'challenges';
type MoodFilter = 'bright' | 'calm' | 'creative' | 'energetic';
type ViewMode = 'grid' | 'list';

type SearchResults = {
  users: { id: number; username: string; name: string; avatar: string | null }[];
  posts: { id: number; snippet: string; author: string }[];
  reels: { id: number; caption: string; author: string; tags: string[] }[];
  ideas: { id: number; title: string; description: string; owner: string }[];
  stories: { id: number; title: string; description: string; owner: string }[];
  bottles: { id: number; message: string; emotion_type: string; sender: string }[];
  shop: { id: number; name: string; description: string; creator: string; price: number }[];
};

type ExploreCard = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  description: string;
  metricLeft: string;
  metricRight: string;
  image: string;
  tab: SearchTab;
  mood: MoodFilter;
};

const EMPTY_RESULTS: SearchResults = {
  users: [],
  posts: [],
  reels: [],
  ideas: [],
  stories: [],
  bottles: [],
  shop: [],
};

const PALETTES = {
  light: {
    page: '#FFF9F6',
    card: '#FFFFFF',
    cardSoft: '#FFF4EE',
    border: 'rgba(160, 86, 59, 0.14)',
    text: '#241814',
    textMuted: '#7E655B',
    accent: '#A0563B',
    accentSoft: '#F4DDD3',
    accentStrong: '#8E4A31',
    shadow: '0 18px 40px rgba(160, 86, 59, 0.08)',
  },
  dark: {
    page: '#12131F',
    card: '#1B1D2B',
    cardSoft: '#23263A',
    border: 'rgba(255, 255, 255, 0.08)',
    text: '#F8F5F2',
    textMuted: '#B8B2C7',
    accent: '#E7A98D',
    accentSoft: '#2D2230',
    accentStrong: '#F3B79D',
    shadow: '0 18px 40px rgba(0, 0, 0, 0.28)',
  },
};

const SEARCH_TABS: { key: SearchTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'users', label: 'Users', icon: UserIcon },
  { key: 'ideas', label: 'Ideas', icon: LightBulbIcon },
  { key: 'stories', label: 'Stories', icon: BookOpenIcon },
  { key: 'challenges', label: 'Challenges', icon: FireIcon },
];

const MOOD_FILTERS: { key: MoodFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'bright', label: 'Bright', icon: SunIcon },
  { key: 'calm', label: 'Calm', icon: MagnifyingGlassIcon },
  { key: 'creative', label: 'Creative', icon: LightBulbIcon },
  { key: 'energetic', label: 'Energetic', icon: FireIcon },
];

const EXPLORE_FALLBACKS: ExploreCard[] = [
  {
    id: 'idea-creative-photography',
    href: '/bazaar',
    title: 'Creative Photography Techniques',
    subtitle: 'By Sarah Anderson · Ideas',
    description: 'Explore innovative approaches to capture stunning moments through your lens.',
    metricLeft: '2.4k views',
    metricRight: '342 likes',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    tab: 'ideas',
    mood: 'bright',
  },
  {
    id: 'story-urban-sketching',
    href: '/forge',
    title: 'Urban Sketching Journey',
    subtitle: 'By Michael Chen · Stories',
    description: 'A visual diary of city life through quick sketches and watercolors.',
    metricLeft: '1.8k views',
    metricRight: '256 likes',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
    tab: 'stories',
    mood: 'creative',
  },
  {
    id: 'challenge-digital-art',
    href: '/lab',
    title: 'Digital Art Innovation',
    subtitle: 'By Emma Watson · Challenges',
    description: 'Breaking boundaries in digital art with new tools and techniques.',
    metricLeft: '3.1k views',
    metricRight: '428 likes',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    tab: 'challenges',
    mood: 'energetic',
  },
  {
    id: 'idea-sustainable-design',
    href: '/bazaar',
    title: 'Sustainable Design Solutions',
    subtitle: 'By David Park · Ideas',
    description: 'Creating eco-friendly designs that make a difference.',
    metricLeft: '1.5k views',
    metricRight: '189 likes',
    image: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80',
    tab: 'ideas',
    mood: 'calm',
  },
  {
    id: 'story-abstract-expression',
    href: '/forge',
    title: 'Abstract Expression',
    subtitle: 'By Lisa Thompson · Stories',
    description: 'Exploring emotions through abstract art forms.',
    metricLeft: '2.2k views',
    metricRight: '315 likes',
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
    tab: 'stories',
    mood: 'creative',
  },
  {
    id: 'challenge-minimal-architecture',
    href: '/lab',
    title: 'Minimalist Architecture',
    subtitle: 'By James Wilson · Challenges',
    description: 'Finding beauty in simplicity through architectural design.',
    metricLeft: '2.7k views',
    metricRight: '394 likes',
    image: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80',
    tab: 'challenges',
    mood: 'bright',
  },
];

function buildDynamicCards(results: SearchResults): ExploreCard[] {
  const userCards: ExploreCard[] = results.users.slice(0, 3).map((user, index) => ({
    id: `user-${user.id}`,
    href: `/profile/${user.id}`,
    title: user.name || `@${user.username}`,
    subtitle: `@${user.username} · Users`,
    description: 'Discover this creator’s latest work, saved inspirations, and community activity.',
    metricLeft: `${120 + index * 37} followers`,
    metricRight: `${18 + index * 6} posts`,
    image: user.avatar ? mediaUrl(user.avatar) : `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(user.username)}`,
    tab: 'users',
    mood: index % 2 === 0 ? 'bright' : 'calm',
  }));

  const ideaCards: ExploreCard[] = results.ideas.slice(0, 3).map((idea, index) => ({
    id: `idea-${idea.id}`,
    href: `/bazaar/${idea.id}`,
    title: idea.title,
    subtitle: `By ${idea.owner} · Ideas`,
    description: idea.description,
    metricLeft: `${1.2 + index * 0.4}k views`,
    metricRight: `${140 + index * 28} likes`,
    image: `https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80`,
    tab: 'ideas',
    mood: index % 2 === 0 ? 'creative' : 'bright',
  }));

  const storyCards: ExploreCard[] = results.stories.slice(0, 3).map((story, index) => ({
    id: `story-${story.id}`,
    href: `/forge?story=${story.id}`,
    title: story.title,
    subtitle: `By ${story.owner} · Stories`,
    description: story.description,
    metricLeft: `${1.6 + index * 0.3}k reads`,
    metricRight: `${90 + index * 22} saves`,
    image: `https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80`,
    tab: 'stories',
    mood: index % 2 === 0 ? 'calm' : 'creative',
  }));

  const challengeCards: ExploreCard[] = results.posts.slice(0, 3).map((post, index) => ({
    id: `challenge-${post.id}`,
    href: `/post/${post.id}`,
    title: post.snippet || 'Creative Challenge Spotlight',
    subtitle: `By ${post.author} · Challenges`,
    description: 'Jump into a fresh prompt, remix the concept, and share your own creative response.',
    metricLeft: `${2.1 + index * 0.5}k views`,
    metricRight: `${210 + index * 31} likes`,
    image: `https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80`,
    tab: 'challenges',
    mood: index % 2 === 0 ? 'energetic' : 'bright',
  }));

  return [...userCards, ...ideaCards, ...storyCards, ...challengeCards];
}

function ExploreCardView({
  card,
  palette,
  compact,
}: {
  card: ExploreCard;
  palette: (typeof PALETTES)['light'];
  compact: boolean;
}) {
  return (
    <Link
      href={card.href}
      className={`group overflow-hidden rounded-[24px] border transition-transform duration-200 hover:-translate-y-1 ${
        compact ? 'flex gap-4 p-4 items-center' : 'block'
      }`}
      style={{
        background: palette.card,
        borderColor: palette.border,
        boxShadow: palette.shadow,
      }}
    >
      <div className={compact ? 'h-28 w-28 shrink-0 overflow-hidden rounded-[18px]' : 'aspect-[1.18/0.9] overflow-hidden'}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.image}
          alt={card.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className={compact ? 'min-w-0 flex-1' : 'p-5'}>
        <h3 className="text-[1.05rem] font-semibold tracking-[-0.02em]" style={{ color: palette.text }}>
          {card.title}
        </h3>
        <p className="mt-1 text-sm" style={{ color: palette.textMuted }}>
          {card.subtitle}
        </p>
        <p className="mt-4 text-sm leading-6" style={{ color: palette.textMuted }}>
          {card.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-4 text-sm" style={{ color: palette.textMuted }}>
          <span>{card.metricLeft}</span>
          <span>{card.metricRight}</span>
        </div>
      </div>
    </Link>
  );
}

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const palette = PALETTES[theme];
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<SearchTab>('users');
  const [activeMood, setActiveMood] = useState<MoodFilter | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchValue, setSearchValue] = useState(searchParams.get('q')?.trim() ?? '');
  const query = searchParams.get('q')?.trim() ?? '';

  useEffect(() => {
    setSearchValue(query);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setResults(EMPTY_RESULTS);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiFetch(`search/?q=${encodeURIComponent(query)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return EMPTY_RESULTS;
        return (await res.json()) as SearchResults;
      })
      .then((data) => {
        if (!cancelled) setResults({ ...EMPTY_RESULTS, ...data });
      })
      .catch(() => {
        if (!cancelled) setResults(EMPTY_RESULTS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const dynamicCards = useMemo(() => buildDynamicCards(results), [results]);
  const cards = dynamicCards.length > 0 ? dynamicCards : EXPLORE_FALLBACKS;

  const filteredCards = useMemo(
    () =>
      cards.filter((card) => {
        const tabMatch = card.tab === activeTab;
        const moodMatch = activeMood ? card.mood === activeMood : true;
        return tabMatch && moodMatch;
      }),
    [activeMood, activeTab, cards],
  );

  const totalResults = useMemo(
    () =>
      results.users.length +
      results.posts.length +
      results.reels.length +
      results.ideas.length +
      results.stories.length +
      results.bottles.length +
      results.shop.length,
    [results],
  );

  function submitSearch() {
    const nextQuery = searchValue.trim();
    if (!nextQuery) {
      router.push('/search');
      return;
    }
    router.push(`/search?q=${encodeURIComponent(nextQuery)}`);
  }

  return (
    <AppShell
      className="min-h-screen"
      style={{ background: palette.page, color: palette.text }}
      maxWidth="max-w-[1440px]"
      contentClassName="flex-1 min-w-0 w-full px-4 pb-16 lg:px-6"
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between border-b pb-6 pt-2" style={{ borderColor: palette.border }}>
          <div>
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em]" style={{ color: palette.text }}>
              Explore
            </h1>
            <p className="mt-2 text-sm" style={{ color: palette.textMuted }}>
              {query
                ? `Showing curated inspiration for “${query}”`
                : 'Search for ideas, stories, creators, and creative challenges.'}
            </p>
          </div>
          <div className="hidden items-center gap-12 text-sm lg:flex" style={{ color: palette.text }}>
            <span className="font-medium">Discover</span>
            <span>Collections</span>
            <span>Community</span>
          </div>
        </div>

        <div
          className="flex items-center gap-3 rounded-2xl border px-5 py-4"
          style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
        >
          <MagnifyingGlassIcon className="h-5 w-5 shrink-0" style={{ color: palette.textMuted }} />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitSearch();
            }}
            placeholder="Search for inspiration..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-current"
            style={{ color: palette.textMuted }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {SEARCH_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  background: active ? palette.accentSoft : 'transparent',
                  color: active ? palette.accentStrong : palette.text,
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {MOOD_FILTERS.map((filter) => {
              const Icon = filter.icon;
              const active = activeMood === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveMood(active ? null : filter.key)}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: active ? palette.accentSoft : 'transparent',
                    color: active ? palette.accentStrong : palette.text,
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{filter.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 rounded-2xl p-1" style={{ background: palette.cardSoft }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className="rounded-xl p-3 transition-colors"
              style={{
                background: viewMode === 'grid' ? palette.accent : 'transparent',
                color: viewMode === 'grid' ? '#FFFFFF' : palette.textMuted,
              }}
              aria-label="Grid view"
            >
              <Squares2X2Icon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="rounded-xl p-3 transition-colors"
              style={{
                background: viewMode === 'list' ? palette.accent : 'transparent',
                color: viewMode === 'list' ? '#FFFFFF' : palette.textMuted,
              }}
              aria-label="List view"
            >
              <ViewColumnsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div
            className="rounded-[28px] border px-6 py-16 text-center text-sm"
            style={{ background: palette.card, borderColor: palette.border, color: palette.textMuted, boxShadow: palette.shadow }}
          >
            Loading search results…
          </div>
        ) : query && totalResults === 0 ? (
          <div
            className="rounded-[28px] border px-6 py-16 text-center"
            style={{ background: palette.card, borderColor: palette.border, boxShadow: palette.shadow }}
          >
            <h2 className="text-xl font-semibold" style={{ color: palette.text }}>
              No exact matches for “{query}”
            </h2>
            <p className="mt-3 text-sm" style={{ color: palette.textMuted }}>
              Try a broader keyword or browse the curated inspiration below.
            </p>
          </div>
        ) : null}

        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-6 xl:grid-cols-3 md:grid-cols-2'
              : 'grid grid-cols-1 gap-4'
          }
        >
          {filteredCards.map((card) => (
            <ExploreCardView key={card.id} card={card} palette={palette} compact={viewMode === 'list'} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <SearchContent />
    </Suspense>
  );
}