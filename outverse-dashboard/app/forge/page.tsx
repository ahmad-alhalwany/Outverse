'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch, apiFetchJson, apiUrl } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import {
  PlusIcon,
  UsersIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

import { useAuthUser } from '@/lib/hooks/useAuthUser';

const BASE = apiUrl('forge/stories');

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
    shadowLg: '0 18px 48px rgba(124,58,237,0.14)',
    btnShadow: '0 6px 20px rgba(124,58,237,0.3)',
    modalShadow: '0 20px 60px rgba(33,27,61,0.3)',
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    fabShadow: '0 4px 16px rgba(124,58,237,0.5)',
    hero: 'linear-gradient(135deg, #F8F5FE 0%, #ECE3FB 52%, #DFD0F7 100%)',
    accentSoft: '#DCC9FA',
    accentStrong: '#7C3AED',
    panel: 'rgba(255,255,255,0.82)',
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
    shadowLg: '0 18px 48px rgba(0,0,0,0.28)',
    btnShadow: '0 6px 20px rgba(167,139,250,0.3)',
    modalShadow: '0 20px 60px rgba(0,0,0,0.45)',
    progressBg: 'rgba(255,255,255,0.08)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    fabShadow: '0 4px 16px rgba(167,139,250,0.35)',
    hero: 'linear-gradient(135deg, #191140 0%, #251B4D 52%, #32215F 100%)',
    accentSoft: '#3A2A6B',
    accentStrong: '#C4B5FD',
    panel: 'rgba(30,23,64,0.82)',
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
  { key: 'my', label: 'My Forge' },
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
  const [myKind, setMyKind] = useState<'all' | 'owned' | 'saved' | 'collaborating'>('all');
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [deletingStory, setDeletingStory] = useState<Story | null>(null);
  const [search, setSearch] = useState('');

  const openStory = useCallback(
    (id: number) => {
      router.push(`/forge/${id}`);
    },
    [router],
  );

  useEffect(() => {
    const s = searchParams.get('story');
    if (s) {
      const id = parseInt(s, 10);
      if (!Number.isNaN(id)) {
        router.replace(`/forge/${id}`);
      }
    }
  }, [searchParams, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const path =
        tab === 'my'
          ? `forge/stories/my/?kind=${myKind}`
          : `forge/stories/?ordering=${tab === 'new' ? 'new' : 'trending'}&genre=${genre}&status=${tab === 'completed' ? 'completed' : 'all'}`;
      const res = await apiFetch(path);
      if (res.ok) {
        const data = await res.json();
        setStories(Array.isArray(data) ? data : data.results || []);
      } else {
        setStories([]);
        setLoadError(true);
      }
    } catch {
      setStories([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [tab, genre, myKind]);

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

              {tab === 'my' && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {([
                    ['all', 'All'],
                    ['owned', 'Owned'],
                    ['saved', 'Saved'],
                    ['collaborating', 'Collaborating'],
                  ] as const).map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMyKind(k)}
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        background: myKind === k ? C.brown : C.white,
                        color: myKind === k ? '#fff' : C.text2,
                        border: `1px solid ${C.line}`,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

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
  const me = useAuthUser();
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

function CreateStoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const C = useForgeColors();
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [genre, setGenre] = useState('fantasy');
  const [coverUrl, setCoverUrl] = useState('');
  const [maxSegments, setMaxSegments] = useState('12');
  const [visibility, setVisibility] = useState('public');
  const [requireApproval, setRequireApproval] = useState(false);
  const [tone, setTone] = useState('');
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
          max_segments: parseInt(maxSegments, 10) || 12,
          visibility,
          require_approval: requireApproval || visibility === 'invite_only',
          tone: tone.trim(),
          studio_mode: visibility === 'invite_only' ? 'collab' : 'solo',
        },
      });
      if (!res.ok) throw new Error('create failed');
      const created = await res.json().catch(() => null);
      onCreated();
      onClose();
      if (created?.id) window.location.href = `/forge/${created.id}`;
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
            <input value={maxSegments} onChange={(e) => setMaxSegments(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="12" inputMode="numeric" />
          </div>
        </div>

        <label className="text-sm font-medium mt-3 block" style={{ color: C.text2 }}>Tone (optional)</label>
        <input value={tone} onChange={(e) => setTone(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="Dreamy, absurd, noir…" />

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>Visibility</label>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
              <option value="public">Public</option>
              <option value="invite_only">Invite only</option>
            </select>
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm" style={{ color: C.text2 }}>
            <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} />
            Require approval
          </label>
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

