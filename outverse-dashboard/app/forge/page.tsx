'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import {
  PlusIcon,
  UsersIcon,
  PencilSquareIcon,
  PaperAirplaneIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ShareIcon,
  ClockIcon,
  BookmarkIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline';

import { apiUrl } from '@/lib/api';
import { getUser } from '@/lib/auth';

const BASE = apiUrl('forge/stories');

const PALETTES = {
  light: {
    cream: '#FBF3EE',
    card: '#F5E4DB',
    card2: '#F9ECE4',
    white: '#FFFFFF',
    brown: '#A0563B',
    brownDk: '#854330',
    text: '#3D2B22',
    text2: '#9A8278',
    line: 'rgba(160,86,59,0.14)',
    headerBg: 'rgba(251,243,238,0.85)',
    overlay: 'rgba(61,43,34,0.45)',
    shadowSm: '0 2px 12px rgba(160,86,59,0.06)',
    shadowLg: '0 18px 48px rgba(160,86,59,0.12)',
    btnShadow: '0 6px 20px rgba(160,86,59,0.3)',
    modalShadow: '0 20px 60px rgba(61,43,34,0.3)',
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    fabShadow: '0 4px 16px rgba(160,86,59,0.5)',
    hero: 'linear-gradient(135deg, #fff7f2 0%, #fde7dc 52%, #f8d8ca 100%)',
    accentSoft: '#F7D7CC',
    accentStrong: '#FF5A43',
    panel: 'rgba(255,255,255,0.82)',
  },
  dark: {
    cream: '#1a1a2e',
    card: '#23234a',
    card2: '#2d1b4a',
    white: '#2a2a45',
    brown: '#c49a6c',
    brownDk: '#a0563b',
    text: '#F5F6FA',
    text2: '#B3B3B3',
    line: 'rgba(106,0,255,0.18)',
    headerBg: 'rgba(26,26,46,0.9)',
    overlay: 'rgba(10,10,34,0.65)',
    shadowSm: '0 2px 12px rgba(106,0,255,0.12)',
    shadowLg: '0 18px 48px rgba(0,0,0,0.28)',
    btnShadow: '0 6px 20px rgba(106,0,255,0.25)',
    modalShadow: '0 20px 60px rgba(0,0,0,0.45)',
    progressBg: 'rgba(255,255,255,0.08)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    fabShadow: '0 4px 16px rgba(106,0,255,0.35)',
    hero: 'linear-gradient(135deg, #1f1738 0%, #2d1b4a 52%, #3a245f 100%)',
    accentSoft: '#3A2A5A',
    accentStrong: '#c49a6c',
    panel: 'rgba(42,42,69,0.82)',
  },
};

function useForgeColors() {
  const { theme } = useTheme();
  return PALETTES[theme];
}

const GENRES = [
  { key: 'all', label: 'All' },
  { key: 'fantasy', label: 'Fantasy' },
  { key: 'scifi', label: 'Sci-Fi' },
  { key: 'mystery', label: 'Mystery' },
  { key: 'romance', label: 'Romance' },
  { key: 'horror', label: 'Horror' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'absurd', label: 'Absurd' },
];

const TABS = [
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' },
  { key: 'completed', label: 'Completed' },
];

type Story = {
  id: number;
  title: string;
  premise: string;
  cover_url: string;
  genre: string;
  genre_display: string;
  status: string;
  max_segments: number;
  is_featured: boolean;
  owner: { id?: number; username: string; first_name?: string; last_name?: string } | null;
  segment_count: number;
  contributors_count: number;
};

type Segment = {
  id: number;
  content: string;
  order: number;
  author: { username: string; first_name?: string; last_name?: string; avatar?: string } | null;
};

type StoryDetail = Story & { segments: Segment[] };

function genreLabel(key: string) {
  return GENRES.find((g) => g.key === key)?.label || key;
}

function displayOwner(owner: Story['owner']) {
  if (!owner) return 'Anonymous';
  const full = `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
  return full || owner.username || 'Anonymous';
}

function StoryForgeContent() {
  const C = useForgeColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stories, setStories] = useState<Story[]>([]);
  const [featured, setFeatured] = useState<Story[]>([]);
  const [tab, setTab] = useState('trending');
  const [genre, setGenre] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [deletingStory, setDeletingStory] = useState<Story | null>(null);
  const [search, setSearch] = useState('');

  const openStory = useCallback(
    (id: number) => {
      setActiveId(id);
      router.replace(`/forge?story=${id}`);
    },
    [router],
  );

  const closeStory = useCallback(() => {
    setActiveId(null);
    if (searchParams.get('story')) router.replace('/forge');
  }, [router, searchParams]);

  useEffect(() => {
    const s = searchParams.get('story');
    if (s) {
      const id = parseInt(s, 10);
      if (!Number.isNaN(id)) setActiveId(id);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const ordering = tab === 'new' ? 'new' : 'trending';
      const status = tab === 'completed' ? 'completed' : 'all';
      const res = await fetch(`${BASE}/?ordering=${ordering}&genre=${genre}&status=${status}`);
      if (res.ok) setStories(await res.json());
      else {
        setStories([]);
        setLoadError(true);
      }
    } catch {
      setStories([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [tab, genre]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`${BASE}/featured/`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setFeatured(Array.isArray(data) ? data : []))
      .catch(() => setFeatured([]));
  }, []);

  const filteredStories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return stories;
    return stories.filter(
      (story) =>
        story.title.toLowerCase().includes(query) ||
        story.premise.toLowerCase().includes(query) ||
        story.genre_display.toLowerCase().includes(query),
    );
  }, [search, stories]);

  const spotlightStory = featured[0] || filteredStories[0] || stories[0] || null;

  return (
    <WorldShell colors={C} maxWidth="max-w-6xl">
      <section
        className="relative overflow-hidden rounded-[28px] border px-5 py-5 md:px-7 md:py-7"
        style={{ background: C.hero, borderColor: C.line, boxShadow: C.shadowLg }}
      >
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl" style={{ background: C.accentSoft, opacity: 0.55 }} />
        <div className="absolute -bottom-20 left-10 h-40 w-40 rounded-full blur-3xl" style={{ background: C.card2, opacity: 0.7 }} />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: C.panel, color: C.brown, border: `1px solid ${C.line}` }}>
                Collaborative writing studio
              </div>
              <h1 className="mt-4 text-3xl font-bold md:text-4xl" style={{ color: C.brown }}>
                Story Forge
              </h1>
              <p className="mt-2 max-w-xl text-sm md:text-base" style={{ color: C.text2 }}>
                Shape living stories with your community, track active chapters, and jump into the next contribution in seconds.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-2xl px-5 py-3 font-semibold text-white shrink-0"
              style={{ background: `linear-gradient(90deg, ${C.accentStrong}, ${C.brownDk})`, boxShadow: C.btnShadow }}
            >
              <PlusIcon className="h-4 w-4" /> Start a Story
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
            <div className="rounded-[24px] border p-4 md:p-5" style={{ background: C.panel, borderColor: C.line, backdropFilter: 'blur(10px)' }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: C.text }}>
                    Active Stories
                  </p>
                  <p className="text-xs mt-1" style={{ color: C.text2 }}>
                    Browse trending worlds and continue the next chapter.
                  </p>
                </div>
                <div className="relative w-full sm:w-72">
                  <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: C.text2 }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search stories..."
                    className="w-full rounded-full py-2.5 pl-9 pr-4 text-sm outline-none"
                    style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
                  />
                </div>
              </div>

              <div className="mt-4 flex gap-1 overflow-x-auto border-b pb-1" style={{ borderColor: C.line }}>
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="relative rounded-full px-4 py-2 text-sm font-semibold"
                    style={{ color: tab === t.key ? C.brown : C.text2, background: tab === t.key ? C.white : 'transparent' }}
                  >
                    {t.label}
                    {tab === t.key && <motion.div layoutId="forgeTab" className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full" style={{ background: C.brown }} />}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {GENRES.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setGenre(g.key)}
                    className="rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition"
                    style={{
                      background: genre === g.key ? C.brown : C.white,
                      color: genre === g.key ? '#fff' : C.text2,
                      border: `1px solid ${genre === g.key ? C.brown : C.line}`,
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {spotlightStory ? (
              <div className="rounded-[24px] border p-4 md:p-5" style={{ background: C.panel, borderColor: C.line, backdropFilter: 'blur(10px)' }}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: C.text2 }}>
                  Spotlight
                </p>
                <button type="button" onClick={() => openStory(spotlightStory.id)} className="mt-3 block w-full text-left">
                  <div
                    className="h-40 rounded-[20px] bg-cover bg-center"
                    style={{
                      background: spotlightStory.cover_url
                        ? `url(${spotlightStory.cover_url}) center/cover`
                        : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                    }}
                  />
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: C.text }}>
                        {spotlightStory.title}
                      </h2>
                      <p className="mt-1 text-sm line-clamp-2" style={{ color: C.text2 }}>
                        {spotlightStory.premise}
                      </p>
                    </div>
                    <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: C.card2, color: C.brown }}>
                      {Math.min(100, Math.round((spotlightStory.segment_count / spotlightStory.max_segments) * 100))}%
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs" style={{ color: C.text2 }}>
                    <span className="inline-flex items-center gap-1.5">
                      <UsersIcon className="h-4 w-4" /> {spotlightStory.contributors_count} active
                    </span>
                    <span>{displayOwner(spotlightStory.owner)}</span>
                  </div>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold" style={{ color: C.text }}>
              Featured this week
            </h2>
            <span className="text-xs font-medium" style={{ color: C.text2 }}>
              Curated collaborative picks
            </span>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {featured.map((s) => (
              <motion.button
                key={s.id}
                type="button"
                onClick={() => openStory(s.id)}
                className="shrink-0 w-[280px] rounded-[24px] overflow-hidden text-left"
                style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
              >
                <div
                  className="h-36 bg-center bg-cover"
                  style={{
                    background: s.cover_url
                      ? `url(${s.cover_url}) center/cover`
                      : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                  }}
                />
                <div className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-base line-clamp-1" style={{ color: C.text }}>
                      {s.title}
                    </p>
                    <span className="text-xs font-semibold" style={{ color: C.brown }}>
                      {Math.min(100, Math.round((s.segment_count / s.max_segments) * 100))}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm line-clamp-2" style={{ color: C.text2 }}>
                    {s.premise}
                  </p>
                  <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round((s.segment_count / s.max_segments) * 100))}%`, background: C.brown }} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs" style={{ color: C.text2 }}>
                    <span>{s.contributors_count} contributors</span>
                    <span>{s.segment_count} parts</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="text-center py-16" style={{ color: C.text2 }}>Loading stories…</div>
      ) : loadError ? (
        <div className="rounded-2xl p-10 text-center mt-6" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
          <p className="font-semibold mb-2" style={{ color: C.text }}>Could not load stories</p>
          <button
            type="button"
            onClick={() => load()}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: C.brownDk }}
          >
            Try again
          </button>
        </div>
      ) : filteredStories.length === 0 ? (
        <div className="rounded-2xl p-10 text-center mt-6" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}>
          No stories match this view yet — try another genre or start one. ✍️
        </div>
      ) : (
        <section className="mt-7">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold" style={{ color: C.text }}>
                Story board
              </h2>
              <p className="text-sm" style={{ color: C.text2 }}>
                Pick a world, review progress, and jump into the next contribution.
              </p>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: C.card2, color: C.brown }}>
              {filteredStories.length} stories
            </span>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredStories.map((s) => (
              <StoryCard
                key={s.id}
                story={s}
                onOpen={() => openStory(s.id)}
                onEdit={() => setEditingStory(s)}
                onDelete={() => setDeletingStory(s)}
              />
            ))}
          </div>
        </section>
      )}

      <AnimatePresence>
        {createOpen && <CreateStoryModal onClose={() => setCreateOpen(false)} onCreated={load} />}
        {activeId != null && (
          <ReadStoryModal id={activeId} onClose={closeStory} onContributed={load} />
        )}
        {editingStory && (
          <EditStoryModal
            story={editingStory}
            onClose={() => setEditingStory(null)}
            onSaved={() => {
              setEditingStory(null);
              void load();
            }}
          />
        )}
        {deletingStory && (
          <DeleteStoryDialog
            story={deletingStory}
            onClose={() => setDeletingStory(null)}
            onDeleted={() => {
              setDeletingStory(null);
              void load();
            }}
          />
        )}
      </AnimatePresence>
    </WorldShell>
  );
}

export default function StoryForgePage() {
  const C = useForgeColors();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: C.cream, color: C.text2 }}>
          Loading…
        </div>
      }
    >
      <StoryForgeContent />
    </Suspense>
  );
}

function StoryCard({
  story,
  onOpen,
  onEdit,
  onDelete,
}: {
  story: Story;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const C = useForgeColors();
  const me = getUser();
  const canManage = !!(me && story.owner?.id && me.id === story.owner.id);
  const pct = Math.min(100, Math.round((story.segment_count / story.max_segments) * 100));
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[24px] overflow-hidden flex flex-col text-left"
      style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <button type="button" onClick={onOpen} className="text-left flex flex-col flex-1">
        <div className="h-40 bg-center bg-cover" style={{ background: story.cover_url ? `url(${story.cover_url}) center/cover` : `linear-gradient(135deg, ${C.card}, ${C.card2})` }} />
        <div className="p-4 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>{genreLabel(story.genre)}</span>
            <span className="px-2.5 py-1 rounded-full text-xs" style={{ background: story.status === 'completed' ? '#e8f3ee' : C.card, color: story.status === 'completed' ? '#2f8f6b' : C.brownDk }}>
              {story.status === 'completed' ? 'Completed' : 'Open'}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug text-lg" style={{ color: C.text }}>{story.title}</h3>
            <span className="shrink-0 text-sm font-semibold" style={{ color: C.brown }}>{pct}%</span>
          </div>
          <p className="text-sm mt-2 line-clamp-3 flex-1" style={{ color: C.text2 }}>{story.premise}</p>

          <div className="mt-4">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
            </div>
            <div className="flex items-center justify-between text-xs mt-2" style={{ color: C.text2 }}>
              <span>{story.segment_count}/{story.max_segments} parts</span>
              <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> {story.contributors_count} active</span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl px-3 py-2.5" style={{ background: C.card2 }}>
            <div className="flex items-center justify-between gap-3 text-xs" style={{ color: C.text2 }}>
              <span>Lead</span>
              <span className="font-medium" style={{ color: C.text }}>{displayOwner(story.owner)}</span>
            </div>
          </div>
        </div>
      </button>
      {canManage ? (
        <div className="flex gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold"
            style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-white"
            style={{ background: C.brownDk }}
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}

function EditStoryModal({ story, onClose, onSaved }: { story: Story; onClose: () => void; onSaved: () => void }) {
  const C = useForgeColors();
  const [title, setTitle] = useState(story.title);
  const [premise, setPremise] = useState(story.premise);
  const [genre, setGenre] = useState(story.genre);
  const [maxSegments, setMaxSegments] = useState(String(story.max_segments));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await apiFetchJson(`forge/stories/${story.id}/`, {
        method: 'PATCH',
        json: {
          title: title.trim(),
          premise: premise.trim(),
          genre,
          max_segments: parseInt(maxSegments, 10) || story.max_segments,
        },
      });
      if (!res.ok) throw new Error('failed');
      onSaved();
    } catch {
      setError('Could not update the story.');
    } finally {
      setSaving(false);
    }
  }

  const field = { background: C.white, border: `1px solid ${C.line}`, color: C.text } as const;

  return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay, backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <motion.form initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} onClick={(e) => e.stopPropagation()} onSubmit={submit} className="w-full max-w-lg rounded-2xl p-6 relative max-h-[90vh] overflow-y-auto" style={{ background: C.cream, boxShadow: C.modalShadow, border: `1px solid ${C.line}` }}>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl flex items-center justify-center" style={{ background: C.card, color: C.text }} aria-label="Close">×</button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>Edit story</h2>
        <label className="text-sm font-medium" style={{ color: C.text2 }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} />
        <label className="text-sm font-medium" style={{ color: C.text2 }}>Description</label>
        <textarea value={premise} onChange={(e) => setPremise(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none resize-none" style={field} />
        <div className="grid grid-cols-2 gap-3">
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
            {GENRES.filter((g) => g.key !== 'all').map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
          <input value={maxSegments} onChange={(e) => setMaxSegments(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} inputMode="numeric" />
        </div>
        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}
        <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </motion.form>
    </motion.div>
  );
}

function DeleteStoryDialog({ story, onClose, onDeleted }: { story: Story; onClose: () => void; onDeleted: () => void }) {
  const C = useForgeColors();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    setDeleting(true);
    setError('');
    try {
      const res = await apiFetch(`forge/stories/${story.id}/`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      onDeleted();
    } catch {
      setError('Could not delete the story.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay }} onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl p-6" style={{ background: C.cream, border: `1px solid ${C.line}`, boxShadow: C.modalShadow }}>
        <h2 className="text-lg font-semibold" style={{ color: C.text }}>Delete story?</h2>
        <p className="text-sm mt-2" style={{ color: C.text2 }}>This will permanently remove “{story.title}”.</p>
        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>{'Cancel'}</button>
          <button type="button" onClick={() => void confirmDelete()} disabled={deleting} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: C.brownDk }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ReadStoryModal({ id, onClose, onContributed }: { id: number; onClose: () => void; onContributed: () => void }) {
  const C = useForgeColors();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [shareState, setShareState] = useState<'idle' | 'done'>('idle');

  const fetchStory = useCallback(async () => {
    setLoading(true);
    setStory(null);
    try {
      const res = await fetch(`${BASE}/${id}/`);
      if (res.ok) setStory(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  async function contribute() {
    if (!text.trim()) {
      setError('Write your part first ✍️');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await apiFetchJson(`forge/stories/${id}/segments/`, {
        method: 'POST',
        json: { content: text.trim() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'failed');
      }
      setText('');
      await fetchStory();
      onContributed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add your part.');
    } finally {
      setSaving(false);
    }
  }

  async function shareStory() {
    const url = typeof window !== 'undefined' ? window.location.href : `/forge?story=${id}`;
    try {
      if (navigator.share && story) {
        await navigator.share({ title: story.title, text: story.premise, url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setShareState('done');
      window.setTimeout(() => setShareState('idle'), 2200);
    } catch {
      setShareState('idle');
    }
  }

  const full = story && story.segment_count >= story.max_segments;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: C.overlay, backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl rounded-[28px] relative max-h-[92vh] flex flex-col overflow-hidden"
        style={{ background: C.cream, boxShadow: C.modalShadow, border: `1px solid ${C.line}` }}
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl flex items-center justify-center z-10" style={{ background: C.card, color: C.text }} aria-label="Close">×</button>

        {loading ? (
          <div className="p-16 text-center" style={{ color: C.text2 }}>Loading story…</div>
        ) : !story ? (
          <div className="p-12 text-center">
            <p className="font-semibold mb-3" style={{ color: C.text }}>Story not found</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: C.brownDk }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.7fr)_320px]">
              <div className="min-h-0 overflow-y-auto">
                <div
                  className="h-52 bg-cover bg-center"
                  style={{
                    background: story.cover_url
                      ? `url(${story.cover_url}) center/cover`
                      : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
                  }}
                />
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-5" style={{ borderColor: C.line }}>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>{genreLabel(story.genre)}</span>
                        <span className="text-xs" style={{ color: C.text2 }}>{story.segment_count}/{story.max_segments} parts</span>
                      </div>
                      <h2 className="text-2xl font-bold" style={{ color: C.text }}>{story.title}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: C.text2 }}>{story.premise}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void shareStory()}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
                      style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
                    >
                      <ShareIcon className="h-4 w-4" />
                      {shareState === 'done' ? 'Link copied' : 'Share'}
                    </button>
                  </div>

                  <div className="mt-5 rounded-[24px] p-5" style={{ background: C.card2 }}>
                    {story.segments.length > 0 ? (
                      <>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-bold" style={{ color: C.text }}>
                              {story.title}
                            </h3>
                            <p className="text-sm" style={{ color: C.text2 }}>
                              Chapter {story.segment_count}: Community continuation
                            </p>
                          </div>
                          <ClockIcon className="h-5 w-5" style={{ color: C.brownDk }} />
                        </div>
                        <div className="space-y-4">
                          {story.segments.map((seg, index) => (
                            <div key={seg.id} className={index === story.segments.length - 1 ? 'rounded-2xl bg-white/60 p-4' : ''}>
                              <p className="text-base leading-8" style={{ color: C.text }}>{seg.content}</p>
                              <span className="mt-2 inline-block text-xs" style={{ color: C.text2 }}>
                                — {seg.author ? (seg.author.first_name || seg.author.username) : 'Anonymous'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: C.text2 }}>
                        No contributions yet. Start the first paragraph below.
                      </p>
                    )}
                  </div>

                  {full && (
                    <div className="mt-4 rounded-xl p-3 text-center text-sm" style={{ background: C.fundedBg, color: C.fundedText }}>
                      ✨ This story is complete. A mini-tale forged by many hands.
                    </div>
                  )}

                  {!full && story.status !== 'completed' && (
                    <div className="mt-5 rounded-[24px] border p-4 md:p-5" style={{ borderColor: C.line, background: C.white }}>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button type="button" className="rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: C.line, color: C.text }}>B</button>
                        <button type="button" className="rounded-xl border px-3 py-2 text-sm italic" style={{ borderColor: C.line, color: C.text }}>I</button>
                        <button type="button" className="rounded-xl border px-3 py-2 text-sm underline" style={{ borderColor: C.line, color: C.text }}>U</button>
                      </div>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={5}
                        maxLength={500}
                        placeholder="Continue the story..."
                        className="w-full rounded-2xl px-4 py-3 outline-none resize-none text-sm"
                        style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.text }}
                      />
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm" style={{ color: C.text2 }}>
                          {text.length}/500 characters
                        </span>
                        <button onClick={contribute} disabled={saving} className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.accentStrong}, ${C.brownDk})` }}>
                          <PaperAirplaneIcon className="h-4 w-4" /> {saving ? 'Adding…' : 'Submit Contribution'}
                        </button>
                      </div>
                      {error && <div className="text-sm mt-2" style={{ color: '#c0392b' }}>{error}</div>}
                    </div>
                  )}
                </div>
              </div>

              <aside className="border-t lg:border-l lg:border-t-0 p-5 space-y-4 overflow-y-auto" style={{ borderColor: C.line, background: C.white }}>
                <div className="rounded-[24px] border p-4" style={{ borderColor: C.line, background: C.cream }}>
                  <h3 className="text-lg font-bold" style={{ color: C.text }}>Active Contributors</h3>
                  <div className="mt-4 space-y-3">
                    {story.segments.slice(-4).map((seg) => (
                      <div key={seg.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold" style={{ color: C.text }}>
                            {seg.author ? (seg.author.first_name || seg.author.username) : 'Anonymous'}
                          </p>
                          <p className="text-xs" style={{ color: C.text2 }}>
                            Contributor
                          </p>
                        </div>
                        <UsersIcon className="h-4 w-4 shrink-0" style={{ color: C.brown }} />
                      </div>
                    ))}
                    {story.segments.length === 0 ? (
                      <p className="text-sm" style={{ color: C.text2 }}>
                        Contributors will appear here as the story grows.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border p-4" style={{ borderColor: C.line, background: C.cream }}>
                  <h3 className="text-lg font-bold" style={{ color: C.text }}>Recent Activity</h3>
                  <div className="mt-4 space-y-3">
                    {story.segments.slice(-3).reverse().map((seg) => (
                      <div key={seg.id}>
                        <p className="text-sm font-semibold" style={{ color: C.text }}>
                          {seg.author ? (seg.author.first_name || seg.author.username) : 'Anonymous'}
                        </p>
                        <p className="text-sm" style={{ color: C.text2 }}>
                          added part {seg.order + 1}
                        </p>
                      </div>
                    ))}
                    {story.segments.length === 0 ? (
                      <p className="text-sm" style={{ color: C.text2 }}>
                        No activity yet.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[24px] border p-4" style={{ borderColor: C.line, background: C.cream }}>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                      <PencilSquareIcon className="h-4 w-4" /> Write
                    </button>
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                      <BookmarkIcon className="h-4 w-4" /> Save
                    </button>
                    <button type="button" onClick={() => void shareStory()} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: C.card2, color: C.brownDk }}>
                      <ArrowUpTrayIcon className="h-4 w-4" /> Publish
                    </button>
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function CreateStoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const C = useForgeColors();
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState('fantasy');
  const [coverUrl, setCoverUrl] = useState('');
  const [maxSegments, setMaxSegments] = useState('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !premise.trim()) {
      setError('Title and opening line are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await apiFetchJson('forge/stories/', {
        method: 'POST',
        json: {
          title: title.trim(),
          premise: premise.trim(),
          genre,
          cover_url: coverUrl.trim(),
          max_segments: parseInt(maxSegments, 10) || 10,
        },
      });
      if (!res.ok) throw new Error('create failed');
      onCreated();
      onClose();
    } catch {
      setError('Could not start the story. Check the connection.');
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
        <button type="button" onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl flex items-center justify-center" style={{ background: C.card, color: C.text }} aria-label="Close">×</button>
        <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>📖 Start a New Story</h2>

        <label className="text-sm font-medium" style={{ color: C.text2 }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder="Give your story a name" />

        <label className="text-sm font-medium" style={{ color: C.text2 }}>Opening line</label>
        <textarea value={premise} onChange={(e) => setPremise(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none resize-none" style={field} placeholder="The first sentence others will continue…" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>Genre</label>
            <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
              {GENRES.filter((g) => g.key !== 'all').map((g) => (
                <option key={g.key} value={g.key}>{g.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>Max parts</label>
            <input value={maxSegments} onChange={(e) => setMaxSegments(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="10" inputMode="numeric" />
          </div>
        </div>

        <label className="text-sm font-medium mt-3 block" style={{ color: C.text2 }}>Cover image URL</label>
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="https://…  (optional)" />

        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}

        <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
          {saving ? 'Forging…' : 'Forge the story 📖'}
        </button>
      </motion.form>
    </motion.div>
  );
}

