'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { coachIdea, type IdeaCoachResult } from '@/lib/aiCoachApi';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import WorldShell from '@/components/world/WorldShell';
import {
  BAZAAR_CATEGORIES,
  bazaarCategoryLabel,
  bazaarOwnerName,
  formatIdeaTargetDate,
  type BazaarIdea,
  type BazaarIdeaUser,
} from '@/lib/bazaarTypes';
import {
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  HeartIcon,
  TrashIcon,
  UsersIcon,
  BookmarkIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
  Squares2X2Icon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';

import { useAuthUser } from '@/lib/hooks/useAuthUser';
import PledgeModal from '@/components/bazaar/PledgeModal';
import { toggleIdeaSave } from '@/lib/bazaarApi';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    headerBg: 'rgba(243,240,252,0.85)',
    overlay: 'rgba(33,27,61,0.45)',
    shadowSm: '0 2px 12px rgba(124,58,237,0.08)',
    btnShadow: '0 6px 20px rgba(124,58,237,0.3)',
    modalShadow: '0 20px 60px rgba(33,27,61,0.3)',
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    headerBg: 'rgba(20,16,42,0.9)',
    overlay: 'rgba(10,8,24,0.65)',
    shadowSm: '0 2px 12px rgba(167,139,250,0.14)',
    btnShadow: '0 6px 20px rgba(167,139,250,0.3)',
    modalShadow: '0 20px 60px rgba(0,0,0,0.45)',
    progressBg: 'rgba(255,255,255,0.08)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
  },
};

function useBazaarColors() {
  const { theme } = useTheme();
  return PALETTES[theme];
}

const TABS = [
  { key: 'trending', labelKey: 'bazaar.trending' },
  { key: 'new', labelKey: 'bazaar.new' },
  { key: 'needs_help', labelKey: 'bazaar.needsHelp' },
] as const;

const SORT_OPTIONS = [
  { key: 'newest', labelKey: 'bazaar.sortNewest' },
  { key: 'funded', labelKey: 'bazaar.sortMostFunded' },
  { key: 'supporters', labelKey: 'bazaar.sortMostSupported' },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]['key'];

function BazaarContent() {
  const C = useBazaarColors();
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ideas, setIdeas] = useState<BazaarIdea[]>([]);
  const [featured, setFeatured] = useState<BazaarIdea[]>([]);
  const [tab, setTab] = useState('trending');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingIdea, setEditingIdea] = useState<BazaarIdea | null>(null);
  const [deletingIdea, setDeletingIdea] = useState<BazaarIdea | null>(null);
  const [pledgingIdea, setPledgingIdea] = useState<BazaarIdea | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!actionError) return;
    const handle = window.setTimeout(() => setActionError(''), 3200);
    return () => window.clearTimeout(handle);
  }, [actionError]);

  const load = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const ordering = tab === 'new' ? 'new' : 'trending';
      const tag = searchParams.get('tag');
      const params = new URLSearchParams({
        ordering,
        category,
        page: String(pageNum),
      });
      if (tag) params.set('tag', tag);
      const [iRes, fRes] = await Promise.all([
        apiFetchJson(`ideas/?${params.toString()}`),
        pageNum === 1 ? apiFetchJson('ideas/featured/') : Promise.resolve(null),
      ]);
      if (iRes?.ok) {
        const data = await iRes.json();
        const rows = Array.isArray(data) ? data : data.results || [];
        setIdeas((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(Array.isArray(data) ? false : !!data.next);
        setPage(pageNum);
      } else if (!append) {
        setIdeas([]);
        setLoadError(true);
      }
      if (fRes?.ok) setFeatured(await fRes.json());
    } catch {
      if (!append) {
        setIdeas([]);
        setLoadError(true);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [tab, category, searchParams]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = searchParams.get('idea');
    if (id && !Number.isNaN(parseInt(id, 10))) {
      router.replace(`/bazaar/${id}`);
    }
  }, [searchParams, router]);

  const openIdea = useCallback(
    (idea: BazaarIdea) => {
      router.push(`/bazaar/${idea.id}`);
    },
    [router],
  );

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => {
    let list = tab === 'needs_help' ? ideas.filter((i) => (i.roles_needed?.length ?? 0) > 0) : ideas;
    if (q) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          bazaarCategoryLabel(i.category, locale).toLowerCase().includes(q),
      );
    }
    list = [...list];
    if (sortBy === 'funded') {
      list.sort((a, b) => (b.funding_raised || 0) - (a.funding_raised || 0));
    } else if (sortBy === 'supporters') {
      list.sort((a, b) => (b.supporters || 0) - (a.supporters || 0));
    }
    return list;
  }, [ideas, tab, q, locale, sortBy]);

  const shownFeatured = useMemo(() => {
    if (!q) return featured;
    return featured.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q),
    );
  }, [featured, q]);

  async function handleVote(id: number) {
    try {
      const res = await apiFetchJson(`ideas/${id}/vote/`, { method: 'POST' });
      if (!res.ok) throw new Error('vote failed');
      const data = await res.json();
      setIdeas((list) =>
        list.map((i) => (i.id === id ? { ...i, supporters: data.supporters, is_voted: data.voted } : i)),
      );
      setFeatured((list) =>
        list.map((i) => (i.id === id ? { ...i, supporters: data.supporters, is_voted: data.voted } : i)),
      );
    } catch {
      setActionError(t('bazaar.voteFailed'));
      load();
    }
  }

  async function handleSave(id: number) {
    const result = await toggleIdeaSave(id);
    if (!result) return;
    const patch = { is_saved: result.saved };
    setIdeas((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setFeatured((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function applyPledgeResult(id: number, funding_raised: number) {
    setIdeas((list) => list.map((i) => (i.id === id ? { ...i, funding_raised } : i)));
    setFeatured((list) => list.map((i) => (i.id === id ? { ...i, funding_raised } : i)));
  }

  return (
    <WorldShell colors={C}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="max-w-xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.brown }}>
              {t('bazaar.eyebrow')}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: C.text }}>{t('bazaar.title')}</h1>
            <p className="mt-2 text-sm md:text-base leading-relaxed" style={{ color: C.text2 }}>{t('bazaar.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white shrink-0"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
          >
            <PlusIcon className="h-4 w-4" /> {t('bazaar.createIdea')}
          </button>
        </div>

        {actionError && (
          <div className="mb-4 rounded-xl px-4 py-2.5 text-sm" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
            {actionError}
          </div>
        )}

        <div className="relative max-w-md mb-4 hidden sm:block">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.text2 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('bazaar.search')}
            className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b overflow-x-auto" style={{ borderColor: C.line }}>
          {TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              onClick={() => setTab(tabDef.key)}
              className="px-4 py-2.5 text-sm font-semibold relative"
              style={{ color: tab === tabDef.key ? C.brown : C.text2 }}
            >
              {t(tabDef.labelKey)}
              {tab === tabDef.key && (
                <motion.div layoutId="bazaarTab" className="absolute bottom-0 left-0 right-0 h-0.5 rounded" style={{ background: C.brown }} />
              )}
            </button>
          ))}
        </div>

        {/* Categories */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {BAZAAR_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition"
              style={{
                background: category === c.key ? C.brown : C.white,
                color: category === c.key ? '#fff' : C.text2,
                border: `1px solid ${category === c.key ? C.brown : C.line}`,
              }}
            >
              {bazaarCategoryLabel(c.key, locale)}
            </button>
          ))}
        </div>

        <div className="relative sm:hidden mt-4">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.text2 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('bazaar.search')}
            className="w-full rounded-full pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            aria-label={t('bazaar.sortBy')}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{t(opt.labelKey)}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: C.card2 }}>
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-label={t('bazaar.gridView')}
              aria-pressed={view === 'grid'}
              className="rounded-lg p-1.5"
              style={{ background: view === 'grid' ? C.white : 'transparent', color: view === 'grid' ? C.brown : C.text2 }}
            >
              <Squares2X2Icon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-label={t('bazaar.listView')}
              aria-pressed={view === 'list'}
              className="rounded-lg p-1.5"
              style={{ background: view === 'list' ? C.white : 'transparent', color: view === 'list' ? C.brown : C.text2 }}
            >
              <Bars3Icon className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Ideas grid */}
          <div className="lg:col-span-9">
            {!loading && !q && shownFeatured.length > 0 ? (
              <FeaturedHero idea={shownFeatured[0]} onOpen={() => openIdea(shownFeatured[0])} />
            ) : null}
            {loading ? (
              <div className="text-center py-16" style={{ color: C.text2 }}>{t('bazaar.loading')}</div>
            ) : loadError ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
                <p className="font-semibold mb-2" style={{ color: C.text }}>{t('bazaar.loadError')}</p>
                <button
                  type="button"
                  onClick={() => void load(1, false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: C.brownDk }}
                >
                  {t('bazaar.retry')}
                </button>
              </div>
            ) : shown.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}>
                {q ? t('bazaar.noSearch') : t('bazaar.empty')}
              </div>
            ) : (
              <div className={view === 'grid' ? 'grid sm:grid-cols-2 xl:grid-cols-3 gap-5' : 'flex flex-col gap-4'}>
                {shown.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    view={view}
                    onOpen={() => openIdea(idea)}
                    onVote={() => handleVote(idea.id)}
                    onSave={() => handleSave(idea.id)}
                    onEdit={() => setEditingIdea(idea)}
                    onDelete={() => setDeletingIdea(idea)}
                    onPledge={() => setPledgingIdea(idea)}
                  />
                ))}
              </div>
            )}
            {!loading && hasMore ? (
              <div className="flex justify-center mt-6">
                <button
                  type="button"
                  onClick={() => void load(page + 1, true)}
                  disabled={loadingMore}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: C.brownDk, opacity: loadingMore ? 0.7 : 1 }}
                >
                  {loadingMore ? t('common.loading') : t('feed.loadMoreFeed')}
                </button>
              </div>
            ) : null}
          </div>

          {/* Right sidebar */}
          <aside className="lg:col-span-3 space-y-5 order-first lg:order-last">
            <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              <h3 className="font-semibold mb-3" style={{ color: C.text }}>{t('bazaar.featured')}</h3>
              {shownFeatured.length === 0 ? (
                <p className="text-sm" style={{ color: C.text2 }}>{t('bazaar.noFeatured')}</p>
              ) : (
                <ul className="space-y-3">
                  {shownFeatured.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => openIdea(f)}
                        className="flex items-center gap-3 w-full text-left hover:opacity-80"
                      >
                        <div className="w-10 h-10 rounded-lg shrink-0 bg-center bg-cover" style={{ background: f.cover_url ? `url(${mediaUrl(f.cover_url)})` : C.card }} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: C.text }}>{f.title}</div>
                          <div className="text-xs flex items-center gap-1" style={{ color: C.text2 }}>
                            <HeartSolid className="h-3 w-3" style={{ color: C.brown }} /> {f.supporters} {t('bazaar.supporters')}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.line}` }}>
              <h3 className="font-semibold mb-3" style={{ color: C.text }}>{t('bazaar.categories')}</h3>
              <div className="flex flex-wrap gap-2">
                {BAZAAR_CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: C.card2, color: C.text }}
                  >
                    {bazaarCategoryLabel(c.key, locale)}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <BazaarCreatorFooter onCreate={() => setCreateOpen(true)} />

      <AnimatePresence>
        {createOpen && <CreateIdeaModal onClose={() => setCreateOpen(false)} onCreated={load} />}
        {editingIdea && (
          <EditIdeaModal
            idea={editingIdea}
            onClose={() => setEditingIdea(null)}
            onSaved={() => {
              setEditingIdea(null);
              void load();
            }}
          />
        )}
        {deletingIdea && (
          <DeleteIdeaDialog
            idea={deletingIdea}
            onClose={() => setDeletingIdea(null)}
            onDeleted={() => {
              setDeletingIdea(null);
              void load();
            }}
          />
        )}
        {pledgingIdea && (
          <PledgeModal
            idea={pledgingIdea}
            onClose={() => setPledgingIdea(null)}
            onPledged={(funding_raised) => {
              applyPledgeResult(pledgingIdea.id, funding_raised);
              setPledgingIdea(null);
            }}
          />
        )}
      </AnimatePresence>
    </WorldShell>
  );
}

// ----------------------------- Sub-components -----------------------------

function BazaarCreatorFooter({ onCreate }: { onCreate: () => void }) {
  const C = useBazaarColors();
  const { t } = useLocale();

  return (
    <section
      className="mt-10 rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <div
        className="px-6 py-8 md:px-10 md:py-10"
        style={{ background: `linear-gradient(135deg, ${C.card} 0%, ${C.card2} 55%, ${C.white} 100%)` }}
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.brown }}>
            {t('bazaar.footerEyebrow')}
          </p>
          <h2 className="text-xl md:text-2xl font-bold leading-snug" style={{ color: C.text }}>
            {t('bazaar.footerTitle')}
          </h2>
          <p className="mt-3 text-sm md:text-base leading-relaxed" style={{ color: C.text2 }}>
            {t('bazaar.footerBody')}
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
          >
            <PlusIcon className="h-4 w-4" />
            {t('bazaar.footerCta')}
          </button>
        </div>
      </div>
    </section>
  );
}

function CollaboratorAvatars({
  collaborators,
  max = 3,
}: {
  collaborators?: BazaarIdeaUser[];
  max?: number;
}) {
  const C = useBazaarColors();
  if (!collaborators?.length) return null;
  return (
    <div className="flex items-center gap-1">
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {collaborators.slice(0, max).map((user) => (
          <div
            key={user.id ?? user.username}
            className="w-6 h-6 rounded-full border-2 bg-center bg-cover shrink-0"
            style={{
              borderColor: C.white,
              background: user.avatar ? `url(${mediaUrl(user.avatar)}) center/cover` : C.card,
            }}
            title={user.username}
          />
        ))}
      </div>
      {collaborators.length > max ? (
        <span className="text-xs" style={{ color: C.text2 }}>
          +{collaborators.length - max}
        </span>
      ) : null}
    </div>
  );
}

function FeaturedHero({ idea, onOpen }: { idea: BazaarIdea; onOpen: () => void }) {
  const C = useBazaarColors();
  const { t, locale } = useLocale();
  const dueLabel = formatIdeaTargetDate(idea.target_date, locale);

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="w-full mb-6 rounded-2xl overflow-hidden text-left"
      style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <div className="grid sm:grid-cols-5 gap-0">
        <div
          className="sm:col-span-2 h-44 sm:h-auto min-h-[11rem] bg-center bg-cover"
          style={{
            background: idea.cover_url
              ? `url(${mediaUrl(idea.cover_url)}) center/cover`
              : `linear-gradient(135deg, ${C.brown}, ${C.brownDk})`,
          }}
        />
        <div className="sm:col-span-3 p-5 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.brown }}>
            {t('bazaar.featured')}
          </span>
          <h2 className="text-xl font-bold mt-1" style={{ color: C.text }}>
            {idea.title}
          </h2>
          <p className="text-sm mt-2 line-clamp-2" style={{ color: C.text2 }}>
            {idea.description}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="text-xs font-medium" style={{ color: C.text2 }}>
              {idea.supporters} {t('bazaar.supporters')}
            </span>
            {dueLabel ? (
              <span className="inline-flex items-center gap-1 text-xs" style={{ color: C.brownDk }}>
                <CalendarDaysIcon className="h-4 w-4" />
                {t('bazaar.dueBy').replace('{date}', dueLabel)}
              </span>
            ) : null}
            <CollaboratorAvatars collaborators={idea.collaborators} />
            <span className="ms-auto text-sm font-semibold" style={{ color: C.brown }}>
              {t('bazaar.featuredHeroCta')} →
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function IdeaCard({
  idea,
  view = 'grid',
  onOpen,
  onVote,
  onSave,
  onEdit,
  onDelete,
  onPledge,
}: {
  idea: BazaarIdea;
  view?: 'grid' | 'list';
  onOpen: () => void;
  onVote: () => void;
  onSave: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPledge: () => void;
}) {
  const C = useBazaarColors();
  const { t, locale } = useLocale();
  const ownerName = bazaarOwnerName(idea);
  const me = useAuthUser();
  const canManage = !!(me && idea.owner?.id && me.id === idea.owner.id);
  const pct = idea.funding_goal ? Math.min(100, Math.round((idea.funding_raised / idea.funding_goal) * 100)) : null;
  const dueLabel = formatIdeaTargetDate(idea.target_date, locale);
  const isList = view === 'list';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <button
        type="button"
        onClick={onOpen}
        className={isList ? 'text-left flex flex-row flex-1 min-w-0' : 'text-left flex flex-col flex-1 min-h-0'}
      >
      <div
        className={isList ? 'w-32 sm:w-44 shrink-0 bg-center bg-cover' : 'h-40 bg-center bg-cover w-full'}
        style={{ background: idea.cover_url ? `url(${mediaUrl(idea.cover_url)}) center/cover` : `linear-gradient(135deg, ${C.card}, ${C.card2})` }}
      />
      <div className={isList ? 'p-4 flex flex-col flex-1 min-w-0' : 'p-4 flex flex-col flex-1'}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>
            {bazaarCategoryLabel(idea.category, locale)}
          </span>
          {idea.collab_project_id ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.fundedBg, color: C.fundedText }}>
              <RocketLaunchIcon className="h-3.5 w-3.5" />
              {t('bazaar.collabActive')}
            </span>
          ) : null}
          {idea.status !== 'proposed' && (
            <span className="px-2.5 py-1 rounded-full text-xs" style={{ background: C.fundedBg, color: C.fundedText }}>
              {idea.status === 'in_progress' ? t('bazaar.inProgress') : t('bazaar.completed')}
            </span>
          )}
        </div>
        <h3 className="font-semibold leading-snug" style={{ color: C.text }}>{idea.title}</h3>
        <p className="text-sm mt-1 line-clamp-2 flex-1" style={{ color: C.text2 }}>{idea.description}</p>

        {dueLabel ? (
          <p className="inline-flex items-center gap-1 text-xs mt-2" style={{ color: C.brownDk }}>
            <CalendarDaysIcon className="h-3.5 w-3.5" />
            {t('bazaar.dueBy').replace('{date}', dueLabel)}
          </p>
        ) : null}

        {pct != null && (
          <div className="mt-3">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
            </div>
            <div className="flex items-center justify-between mt-1 gap-2">
              <div className="text-xs" style={{ color: C.text2 }}>
                ${idea.funding_raised.toLocaleString()} {t('bazaar.raised')} · ${idea.funding_goal?.toLocaleString()} {t('bazaar.goal')}
              </div>
              {!idea.is_owner && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPledge();
                  }}
                  className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ background: C.brown }}
                >
                  {t('bazaar.pledgeCta')}
                </button>
              )}
            </div>
          </div>
        )}

        {idea.tags && idea.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {idea.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-md text-xs" style={{ background: C.card2, color: C.text2 }}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {idea.roles_needed?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {idea.roles_needed.slice(0, 3).map((r) => (
              <span key={r} className="px-2 py-1 rounded-md text-xs" style={{ background: C.card2, color: C.text }}>
                {r}
              </span>
            ))}
          </div>
        )}
        </div>
      </button>
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex items-center gap-2 text-xs min-w-0" style={{ color: C.text2 }}>
            <div className="w-6 h-6 rounded-full bg-center bg-cover shrink-0" style={{ background: idea.owner?.avatar ? `url(${mediaUrl(idea.owner.avatar)})` : C.card }} />
            <span className="truncate">{ownerName}</span>
            <CollaboratorAvatars collaborators={idea.collaborators} />
          </div>
          <div className="flex items-center gap-2">
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="inline-flex items-center justify-center rounded-lg p-2"
                  style={{ background: C.card2, color: C.brownDk }}
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="inline-flex items-center justify-center rounded-lg p-2 text-white"
                  style={{ background: C.brownDk }}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              className="inline-flex items-center justify-center rounded-lg p-2"
              style={{ background: C.card2, color: idea.is_saved ? C.brown : C.text2 }}
              aria-label={idea.is_saved ? t('bazaar.unsaveIdea') : t('bazaar.bookmarkIdea')}
            >
              {idea.is_saved ? <BookmarkSolid className="h-4 w-4" /> : <BookmarkIcon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVote();
              }}
              className="flex items-center gap-1 text-sm font-medium"
              style={{ color: C.brown }}
            >
              {idea.is_voted ? <HeartSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
              {idea.supporters}
            </button>
          </div>
        </div>
    </motion.div>
  );
}

function EditIdeaModal({ idea, onClose, onSaved }: { idea: BazaarIdea; onClose: () => void; onSaved: () => void }) {
  const C = useBazaarColors();
  const { t, locale } = useLocale();
  const [title, setTitle] = useState(idea.title);
  const [description, setDescription] = useState(idea.description);
  const [category, setCategory] = useState(idea.category);
  const [roles, setRoles] = useState((idea.roles_needed || []).join(', '));
  const [tags, setTags] = useState((idea.tags || []).join(', '));
  const [targetDate, setTargetDate] = useState(idea.target_date || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const field = { background: C.white, border: `1px solid ${C.line}`, color: C.text } as const;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/`, {
        method: 'PATCH',
        json: {
          title: title.trim(),
          description: description.trim(),
          category,
          roles_needed: roles.split(',').map((r) => r.trim()).filter(Boolean),
          tags: tags.split(',').map((r) => r.trim()).filter(Boolean),
          target_date: targetDate || null,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || (Array.isArray(data?.title) ? data.title[0] : ''));
      }
      onSaved();
    } catch (err) {
      setError((err instanceof Error && err.message) || t('bazaar.updateIdeaFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay, backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <motion.form initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-lg rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto" style={{ background: C.cream, boxShadow: C.modalShadow, border: `1px solid ${C.line}` }}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl flex items-center justify-center" style={{ background: C.card, color: C.text }} aria-label={t('common.close')}>×</button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>{t('bazaar.editIdea')}</h2>
        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldTitle')}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} />
        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldDescription')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none resize-none" style={field} />
        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldCategory')}</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field}>
          {BAZAAR_CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
            <option key={c.key} value={c.key}>{bazaarCategoryLabel(c.key, locale)}</option>
          ))}
        </select>
        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldRolesNeeded')}</label>
        <input value={roles} onChange={(e) => setRoles(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} />
        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.tagsLabel')}</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder={t('bazaar.tagsHint')} />
        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.targetDateLabel')}</label>
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} />
        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}
        <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
          {saving ? t('bazaar.savingIdea') : t('bazaar.saveIdea')}
        </button>
      </motion.form>
    </motion.div>
  );
}

function DeleteIdeaDialog({ idea, onClose, onDeleted }: { idea: BazaarIdea; onClose: () => void; onDeleted: () => void }) {
  const C = useBazaarColors();
  const { t } = useLocale();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || '');
      }
      onDeleted();
    } catch (err) {
      setError((err instanceof Error && err.message) || t('bazaar.deleteIdeaFailed'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-6" style={{ background: C.cream, border: `1px solid ${C.line}`, boxShadow: C.modalShadow }}>
        <h2 className="text-lg font-semibold" style={{ color: C.text }}>{t('bazaar.deleteIdea')}</h2>
        <p className="text-sm mt-2" style={{ color: C.text2 }}>{t('bazaar.confirmDeleteIdea')}</p>
        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>{t('common.cancel')}</button>
          <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: C.brownDk }}>
            {deleting ? t('bazaar.deletingIdea') : t('bazaar.deleteIdea')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CreateIdeaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const C = useBazaarColors();
  const { locale, t } = useLocale();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technology');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [goal, setGoal] = useState('');
  const [roles, setRoles] = useState('');
  const [tags, setTags] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [milestones, setMilestones] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachResult, setCoachResult] = useState<IdeaCoachResult | null>(null);

  function onCoverChange(file: File | null) {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : '');
  }

  async function handleCoach() {
    if (!title.trim() && !description.trim()) return;
    setCoachBusy(true);
    setCoachResult(null);
    const result = await coachIdea({ title: title.trim(), description: description.trim(), lang: locale as 'en' | 'ar' });
    setCoachBusy(false);
    if (result.error) { setError(result.error); return; }
    setCoachResult(result);
    if (!title.trim() && result.title) setTitle(result.title);
    if (result.milestones.length) setMilestones(result.milestones);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError(t('bazaar.requiredFields'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('category', category);
      if (goal) form.append('funding_goal', goal);
      form.append(
        'roles_needed',
        JSON.stringify(
          roles
            ? roles.split(',').map((r) => r.trim()).filter(Boolean)
            : [],
        ),
      );
      form.append(
        'tags',
        JSON.stringify(
          tags
            ? tags.split(',').map((r) => r.trim()).filter(Boolean)
            : [],
        ),
      );
      if (targetDate) form.append('target_date', targetDate);
      if (milestones.length) {
        form.append(
          'milestones',
          JSON.stringify(milestones.map((title) => ({ title }))),
        );
      }
      if (coverFile) form.append('cover_image', coverFile);
      const res = await apiFetch('ideas/', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const fieldErr =
          typeof data.cover_image?.[0] === 'string'
            ? data.cover_image[0]
            : typeof data.detail === 'string'
              ? data.detail
              : null;
        throw new Error(fieldErr || 'create failed');
      }
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error && err.message !== 'create failed'
        ? err.message
        : t('bazaar.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  const field = { background: C.white, border: `1px solid ${C.line}`, color: C.text } as const;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: C.overlay, backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto"
        style={{ background: C.cream, boxShadow: C.modalShadow, border: `1px solid ${C.line}` }}
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl flex items-center justify-center" style={{ background: C.card, color: C.text }} aria-label={t('common.close')}>×</button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>{t('bazaar.createModalTitle')}</h2>

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldTitle')}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder={t('bazaar.titlePlaceholder')} />

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldDescription')}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-2 outline-none resize-none" style={field} placeholder={t('bazaar.descPlaceholder')} />

        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={() => void handleCoach()}
            disabled={coachBusy || (!title.trim() && !description.trim())}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition-all"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}
          >
            {coachBusy ? t('bazaar.coaching') : t('bazaar.ideaCoach')}
          </button>
        </div>

        {coachResult && !coachResult.error && (
          <div className="rounded-xl p-3 mb-3 text-xs space-y-2" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
            {coachResult.title && coachResult.title !== title && (
              <div>
                <span className="font-semibold" style={{ color: C.text }}>{t('bazaar.suggestedTitle')} </span>
                <button type="button" className="underline" style={{ color: C.brown }} onClick={() => setTitle(coachResult.title)}>
                  {coachResult.title}
                </button>
                <span style={{ color: C.text2 }}> {t('bazaar.clickToApply')}</span>
              </div>
            )}
            {coachResult.milestones.length > 0 && (
              <div>
                <p className="font-semibold mb-1" style={{ color: C.text }}>{t('bazaar.milestonesApplied', { n: String(coachResult.milestones.length) })}</p>
                <ul className="list-disc list-inside space-y-0.5" style={{ color: C.text2 }}>
                  {coachResult.milestones.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}
            {coachResult.constellation_questions.length > 0 && (
              <div>
                <p className="font-semibold mb-1" style={{ color: C.text }}>{t('bazaar.questionsToExplore')}</p>
                <ul className="list-disc list-inside space-y-0.5" style={{ color: C.text2 }}>
                  {coachResult.constellation_questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldCategory')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
              {BAZAAR_CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                <option key={c.key} value={c.key}>{bazaarCategoryLabel(c.key, locale)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldFundingGoal')}</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder={t('common.optional')} inputMode="numeric" />
          </div>
        </div>

        <label className="text-sm font-medium mt-3 block" style={{ color: C.text2 }}>
          {t('bazaar.fieldCoverImage')} <span className="font-normal opacity-70">{t('common.optional')}</span>
        </label>
        <div
          className="mt-1 mb-3 rounded-xl overflow-hidden"
          style={{ border: `1px dashed ${C.line}`, background: C.white }}
        >
          {coverPreview ? (
            <div className="relative h-36 bg-center bg-cover" style={{ backgroundImage: `url(${coverPreview})` }}>
              <button
                type="button"
                onClick={() => onCoverChange(null)}
                className="absolute top-2 right-2 rounded-lg px-2 py-1 text-xs font-semibold"
                style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
              >
                {t('bazaar.removeImage')}
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1 h-28 cursor-pointer px-4 text-center">
              <span className="text-sm font-semibold" style={{ color: C.brown }}>
                {t('bazaar.uploadImage')}
              </span>
              <span className="text-xs" style={{ color: C.text2 }}>
                {t('bazaar.imageHint')}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > 5 * 1024 * 1024) {
                    setError(t('bazaar.imageTooLarge'));
                    e.target.value = '';
                    return;
                  }
                  setError('');
                  onCoverChange(file);
                }}
              />
            </label>
          )}
        </div>

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.fieldRolesNeeded')}</label>
        <input value={roles} onChange={(e) => setRoles(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder={t('bazaar.rolesPlaceholder')} />

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.tagsLabel')}</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder={t('bazaar.tagsHint')} />

        <label className="text-sm font-medium" style={{ color: C.text2 }}>{t('bazaar.targetDateLabel')}</label>
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} />

        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}

        <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
          {saving ? t('bazaar.planting') : t('bazaar.plantIdea')}
        </button>
      </motion.form>
    </motion.div>
  );
}

export default function IdeasBazaarPage() {
  const C = useBazaarColors();
  return (
    <Suspense
      fallback={
        <WorldShell colors={C}>
          <div className="py-20 text-center text-sm" style={{ color: C.text2 }}>
            Loading…
          </div>
        </WorldShell>
      }
    >
      <BazaarContent />
    </Suspense>
  );
}
