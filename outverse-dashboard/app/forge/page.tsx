'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import {
  PlusIcon,
  UsersIcon,
  BookOpenIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';

import { apiUrl } from '@/lib/api';

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
    btnShadow: '0 6px 20px rgba(160,86,59,0.3)',
    modalShadow: '0 20px 60px rgba(61,43,34,0.3)',
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    fabShadow: '0 4px 16px rgba(160,86,59,0.5)',
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
    btnShadow: '0 6px 20px rgba(106,0,255,0.25)',
    modalShadow: '0 20px 60px rgba(0,0,0,0.45)',
    progressBg: 'rgba(255,255,255,0.08)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    fabShadow: '0 4px 16px rgba(106,0,255,0.35)',
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
  owner: { username: string; first_name?: string; last_name?: string } | null;
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

function StoryForgeContent() {
  const C = useForgeColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stories, setStories] = useState<Story[]>([]);
  const [tab, setTab] = useState('trending');
  const [genre, setGenre] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);

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

  return (
    <WorldShell colors={C} maxWidth="max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>📖 Story Forge</h1>
            <p className="text-sm" style={{ color: C.text2 }}>Write stories together, one line at a time.</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white shrink-0"
            style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`, boxShadow: C.btnShadow }}
          >
            <PlusIcon className="h-4 w-4" /> Start a Story
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b" style={{ borderColor: C.line }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="px-4 py-2.5 text-sm font-semibold relative" style={{ color: tab === t.key ? C.brown : C.text2 }}>
              {t.label}
              {tab === t.key && <motion.div layoutId="forgeTab" className="absolute bottom-0 left-0 right-0 h-0.5 rounded" style={{ background: C.brown }} />}
            </button>
          ))}
        </div>

        {/* Genres */}
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
          {GENRES.map((g) => (
            <button
              key={g.key}
              onClick={() => setGenre(g.key)}
              className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition"
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

        {/* Grid */}
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
        ) : stories.length === 0 ? (
          <div className="rounded-2xl p-10 text-center mt-6" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}>
            No stories here yet — be the first to start one. ✍️
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} onOpen={() => openStory(s.id)} />
            ))}
          </div>
        )}

      <AnimatePresence>
        {createOpen && <CreateStoryModal onClose={() => setCreateOpen(false)} onCreated={load} />}
        {activeId != null && (
          <ReadStoryModal id={activeId} onClose={closeStory} onContributed={load} />
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

function StoryCard({ story, onOpen }: { story: Story; onOpen: () => void }) {
  const C = useForgeColors();
  const pct = Math.min(100, Math.round((story.segment_count / story.max_segments) * 100));
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="rounded-2xl overflow-hidden flex flex-col text-left"
      style={{ background: C.white, border: `1px solid ${C.line}`, boxShadow: C.shadowSm }}
    >
      <div className="h-36 bg-center bg-cover" style={{ background: story.cover_url ? `url(${story.cover_url}) center/cover` : `linear-gradient(135deg, ${C.card}, ${C.card2})` }} />
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>{genreLabel(story.genre)}</span>
          <span className="px-2.5 py-1 rounded-full text-xs" style={{ background: story.status === 'completed' ? '#e8f3ee' : C.card, color: story.status === 'completed' ? '#2f8f6b' : C.brownDk }}>
            {story.status === 'completed' ? 'Completed' : 'Open'}
          </span>
        </div>
        <h3 className="font-semibold leading-snug" style={{ color: C.text }}>{story.title}</h3>
        <p className="text-sm mt-1 line-clamp-2 flex-1 italic" style={{ color: C.text2 }}>“{story.premise}”</p>

        <div className="mt-3">
          <div className="h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5" style={{ color: C.text2 }}>
            <span>{story.segment_count}/{story.max_segments} parts</span>
            <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> {story.contributors_count}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function ReadStoryModal({ id, onClose, onContributed }: { id: number; onClose: () => void; onContributed: () => void }) {
  const C = useForgeColors();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
        className="w-full max-w-2xl rounded-2xl relative max-h-[90vh] flex flex-col overflow-hidden"
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
            <div className="p-6 pb-4 border-b" style={{ borderColor: C.line }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>{genreLabel(story.genre)}</span>
                <span className="text-xs" style={{ color: C.text2 }}>{story.segment_count}/{story.max_segments} parts</span>
              </div>
              <h2 className="text-xl font-bold" style={{ color: C.text }}>{story.title}</h2>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <p className="italic text-base leading-relaxed" style={{ color: C.brownDk }}>“{story.premise}”</p>
              {story.segments.map((seg) => (
                <div key={seg.id} className="leading-relaxed">
                  <p style={{ color: C.text }}>{seg.content}</p>
                  <span className="text-[11px]" style={{ color: C.text2 }}>
                    — {seg.author ? (seg.author.first_name || seg.author.username) : 'Anonymous'}
                  </span>
                </div>
              ))}
              {full && (
                <div className="rounded-xl p-3 text-center text-sm" style={{ background: C.fundedBg, color: C.fundedText }}>
                  ✨ This story is complete. A mini-tale forged by many hands.
                </div>
              )}
            </div>

            {!full && story.status !== 'completed' && (
              <div className="p-4 border-t" style={{ borderColor: C.line, background: C.card2 }}>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Continue the story…"
                  className="w-full rounded-xl px-3 py-2.5 outline-none resize-none text-sm"
                  style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
                />
                {error && <div className="text-sm mt-1" style={{ color: '#c0392b' }}>{error}</div>}
                <div className="flex justify-end mt-2">
                  <button onClick={contribute} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
                    <PaperAirplaneIcon className="h-4 w-4" /> {saving ? 'Adding…' : 'Add my part'}
                  </button>
                </div>
              </div>
            )}
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

