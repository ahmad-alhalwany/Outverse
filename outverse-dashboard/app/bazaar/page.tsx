'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { apiFetchJson } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import WorldShell from '@/components/world/WorldShell';
import {
  BAZAAR_CATEGORIES,
  bazaarCategoryLabel,
  bazaarOwnerName,
  type BazaarIdea,
} from '@/lib/bazaarTypes';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  HeartIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';

import { apiUrl, mediaUrl } from '@/lib/api';

const BASE = apiUrl('ideas');

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
  const [createOpen, setCreateOpen] = useState(false);
  const [voted, setVoted] = useState<Record<number, boolean>>({});
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ordering = tab === 'new' ? 'new' : 'trending';
      const [iRes, fRes] = await Promise.all([
        fetch(`${BASE}/?ordering=${ordering}&category=${category}`),
        fetch(`${BASE}/featured/`),
      ]);
      if (iRes.ok) setIdeas(await iRes.json());
      if (fRes.ok) setFeatured(await fRes.json());
    } catch {
      setIdeas([]);
    } finally {
      setLoading(false);
    }
  }, [tab, category]);

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
    return list;
  }, [ideas, tab, q]);

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
      setVoted((v) => ({ ...v, [id]: data.voted }));
      setIdeas((list) =>
        list.map((i) => (i.id === id ? { ...i, supporters: data.supporters } : i)),
      );
      setFeatured((list) =>
        list.map((i) => (i.id === id ? { ...i, supporters: data.supporters } : i)),
      );
      if (data.voted !== undefined) {
        setVoted((prev) => ({ ...prev, [id]: data.voted }));
      }
    } catch {
      load();
    }
  }

  return (
    <WorldShell colors={C}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>{t('bazaar.title')}</h1>
            <p className="text-sm" style={{ color: C.text2 }}>{t('bazaar.subtitle')}</p>
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
        <div className="flex gap-1 mt-4 border-b" style={{ borderColor: C.line }}>
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Ideas grid */}
          <div className="lg:col-span-9">
            {loading ? (
              <div className="text-center py-16" style={{ color: C.text2 }}>{t('bazaar.loading')}</div>
            ) : shown.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}>
                {q ? t('bazaar.noSearch') : t('bazaar.empty')}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {shown.map((idea) => (
                  <IdeaCard
                    key={idea.id}
                    idea={idea}
                    voted={!!voted[idea.id]}
                    onOpen={() => openIdea(idea)}
                    onVote={() => handleVote(idea.id)}
                  />
                ))}
              </div>
            )}
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
                        <div className="w-10 h-10 rounded-lg shrink-0 bg-center bg-cover" style={{ background: f.cover_url ? `url(${f.cover_url})` : C.card }} />
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

      <AnimatePresence>
        {createOpen && <CreateIdeaModal onClose={() => setCreateOpen(false)} onCreated={load} />}
      </AnimatePresence>
    </WorldShell>
  );
}

// ----------------------------- Sub-components -----------------------------

function IdeaCard({
  idea,
  voted,
  onOpen,
  onVote,
}: {
  idea: BazaarIdea;
  voted: boolean;
  onOpen: () => void;
  onVote: () => void;
}) {
  const C = useBazaarColors();
  const { t, locale } = useLocale();
  const ownerName = bazaarOwnerName(idea);
  const pct = idea.funding_goal ? Math.min(100, Math.round((idea.funding_raised / idea.funding_goal) * 100)) : null;

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
        className="text-left flex flex-col flex-1 min-h-0"
      >
      <div
        className="h-40 bg-center bg-cover w-full"
        style={{ background: idea.cover_url ? `url(${idea.cover_url}) center/cover` : `linear-gradient(135deg, ${C.card}, ${C.card2})` }}
      />
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: C.card2, color: C.brown }}>
            {bazaarCategoryLabel(idea.category, locale)}
          </span>
          {idea.status !== 'proposed' && (
            <span className="px-2.5 py-1 rounded-full text-xs" style={{ background: C.fundedBg, color: C.fundedText }}>
              {idea.status === 'in_progress' ? t('bazaar.inProgress') : t('bazaar.completed')}
            </span>
          )}
        </div>
        <h3 className="font-semibold leading-snug" style={{ color: C.text }}>{idea.title}</h3>
        <p className="text-sm mt-1 line-clamp-2 flex-1" style={{ color: C.text2 }}>{idea.description}</p>

        {pct != null && (
          <div className="mt-3">
            <div className="h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
            </div>
            <div className="text-xs mt-1" style={{ color: C.text2 }}>
              ${idea.funding_raised.toLocaleString()} {t('bazaar.raised')} · ${idea.funding_goal?.toLocaleString()} {t('bazaar.goal')}
            </div>
          </div>
        )}

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
          <div className="flex items-center gap-2 text-xs" style={{ color: C.text2 }}>
            <div className="w-6 h-6 rounded-full bg-center bg-cover" style={{ background: idea.owner?.avatar ? `url(${mediaUrl(idea.owner.avatar)})` : C.card }} />
            {ownerName}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVote();
            }}
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: C.brown }}
          >
            {voted ? <HeartSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
            {idea.supporters}
          </button>
        </div>
    </motion.div>
  );
}

function CreateIdeaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const C = useBazaarColors();
  const { locale } = useLocale();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('technology');
  const [coverUrl, setCoverUrl] = useState('');
  const [goal, setGoal] = useState('');
  const [roles, setRoles] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const res = await apiFetchJson('ideas/', {
        method: 'POST',
        json: {
          title: title.trim(),
          description: description.trim(),
          category,
          cover_url: coverUrl.trim(),
          funding_goal: goal ? parseInt(goal, 10) : null,
          roles_needed: roles
            ? roles.split(',').map((r) => r.trim()).filter(Boolean)
            : [],
        },
      });
      if (!res.ok) throw new Error('create failed');
      onCreated();
      onClose();
    } catch {
      setError('Could not create the idea. Check the connection.');
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
        <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>💡 Share a New Idea</h2>

        <label className="text-sm font-medium" style={{ color: C.text2 }}>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder="A name for your idea" />

        <label className="text-sm font-medium" style={{ color: C.text2 }}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none resize-none" style={field} placeholder="What is it about?" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field}>
              {BAZAAR_CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                <option key={c.key} value={c.key}>{bazaarCategoryLabel(c.key, locale)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>Funding goal ($)</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value.replace(/\D/g, ''))} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="optional" inputMode="numeric" />
          </div>
        </div>

        <label className="text-sm font-medium mt-3 block" style={{ color: C.text2 }}>Cover image URL</label>
        <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 mb-3 outline-none" style={field} placeholder="https://…  (optional)" />

        <label className="text-sm font-medium" style={{ color: C.text2 }}>Roles needed (comma separated)</label>
        <input value={roles} onChange={(e) => setRoles(e.target.value)} className="w-full rounded-xl px-3 py-2.5 mt-1 outline-none" style={field} placeholder="Writer, Designer, Developer" />

        {error && <div className="text-sm mt-3" style={{ color: '#c0392b' }}>{error}</div>}

        <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})` }}>
          {saving ? 'Planting…' : 'Plant the idea 🌱'}
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
