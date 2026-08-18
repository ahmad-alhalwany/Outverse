'use client';

import { useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, apiUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { PlusIcon, BuildingLibraryIcon, HeartIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

const BASE = apiUrl('speculative/failed-ideas');

const PALETTES = {
  light: {
    cream: '#F3F0FC', card: '#E9E1FA', card2: '#F5F1FE', white: '#FFFFFF',
    brown: '#7C3AED', brownDk: '#5B21B6', text: '#211B3D', text2: '#79709E',
    line: 'rgba(124,58,237,0.16)', overlay: 'rgba(33,27,61,0.45)',
  },
  dark: {
    cream: '#14102A', card: '#1E1740', card2: '#251B4D', white: '#2A2154',
    brown: '#C4B5FD', brownDk: '#A78BFA', text: '#F5F3FF', text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)', overlay: 'rgba(10,8,24,0.65)',
  },
} as const;

const EXHIBITIONS = ['all', 'burned_ideas', 'collapsed_challenges', 'beautiful_disasters'] as const;
const EXHIBITION_LABEL_KEY: Record<(typeof EXHIBITIONS)[number], string> = {
  all: 'museum.exhibitionAll',
  burned_ideas: 'museum.exhibitionBurnedIdeas',
  collapsed_challenges: 'museum.exhibitionCollapsedChallenges',
  beautiful_disasters: 'museum.exhibitionBeautifulDisasters',
};

const SORTS = ['new', 'top'] as const;
const SORT_LABEL_KEY: Record<(typeof SORTS)[number], string> = {
  new: 'museum.sortNewest',
  top: 'museum.sortTop',
};

type FailedIdea = {
  id: number;
  title: string;
  description: string;
  lesson_learned: string;
  exhibition: string;
  exhibition_display: string;
  cover_url: string;
  user: { username: string; avatar: string | null };
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
};

type FailedIdeaComment = {
  id: number;
  content: string;
  created_at: string;
  user: { username: string; avatar: string | null };
};

export default function MuseumPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [items, setItems] = useState<FailedIdea[]>([]);
  const [exhibition, setExhibition] = useState<(typeof EXHIBITIONS)[number]>('all');
  const [sort, setSort] = useState<(typeof SORTS)[number]>('new');
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lesson, setLesson] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const [active, setActive] = useState<FailedIdea | null>(null);
  const [comments, setComments] = useState<FailedIdeaComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (exhibition !== 'all') params.set('exhibition', exhibition);
      if (sort === 'top') params.set('ordering', 'top');
      const qs = params.toString();
      const res = await apiFetch(`${BASE}/${qs ? `?${qs}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.results || []);
      }
    } finally {
      setLoading(false);
    }
  }, [exhibition, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!title.trim()) return;
    const res = await apiFetchJson('speculative/failed-ideas/', {
      method: 'POST',
      json: {
        title: title.trim(),
        description: description.trim(),
        lesson_learned: lesson.trim(),
        cover_url: coverUrl.trim(),
        exhibition: exhibition === 'all' ? 'burned_ideas' : exhibition,
      },
    });
    if (res.ok) {
      setSubmitOpen(false);
      setTitle('');
      setDescription('');
      setLesson('');
      setCoverUrl('');
      void load();
    }
  }

  async function openDetail(item: FailedIdea) {
    setActive(item);
    setComments([]);
    setCommentText('');
    setCommentsLoading(true);
    const res = await apiFetch(`${BASE}/${item.id}/comments/`);
    if (res.ok) setComments(await res.json());
    setCommentsLoading(false);
  }

  async function toggleLike(item: FailedIdea, e?: React.MouseEvent) {
    e?.stopPropagation();
    if (!user) return;
    const apply = (it: FailedIdea): FailedIdea =>
      it.id === item.id ? { ...it, is_liked: !it.is_liked, likes_count: it.likes_count + (it.is_liked ? -1 : 1) } : it;
    setItems((prev) => prev.map(apply));
    setActive((prev) => (prev && prev.id === item.id ? apply(prev) : prev));
    const res = await apiFetchJson(`${BASE}/${item.id}/like/`, { method: 'POST' });
    if (res.ok) {
      const data = (await res.json()) as { liked: boolean; likes_count: number };
      const sync = (it: FailedIdea): FailedIdea =>
        it.id === item.id ? { ...it, is_liked: data.liked, likes_count: data.likes_count } : it;
      setItems((prev) => prev.map(sync));
      setActive((prev) => (prev && prev.id === item.id ? sync(prev) : prev));
    }
  }

  async function postComment() {
    if (!active || !commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    const res = await apiFetchJson(`${BASE}/${active.id}/comments/`, {
      method: 'POST',
      json: { content: text },
    });
    if (res.ok) {
      const comment = (await res.json()) as FailedIdeaComment;
      setComments((prev) => [...prev, comment]);
      const bump = (it: FailedIdea): FailedIdea => (it.id === active.id ? { ...it, comments_count: it.comments_count + 1 } : it);
      setItems((prev) => prev.map(bump));
      setActive((prev) => (prev ? bump(prev) : prev));
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-5xl mx-auto pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" style={{ color: C.brown }}>
              <BuildingLibraryIcon className="h-7 w-7" />
              {t('museum.title')}
            </h1>
            <p className="text-sm" style={{ color: C.text2 }}>{t('museum.subtitle')}</p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setSubmitOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white shrink-0"
              style={{ background: C.brownDk }}
            >
              <PlusIcon className="h-4 w-4" />
              {t('museum.submit')}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {EXHIBITIONS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setExhibition(key)}
                className="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap"
                style={{
                  background: exhibition === key ? C.brown : C.white,
                  color: exhibition === key ? '#fff' : C.text2,
                  border: `1px solid ${exhibition === key ? C.brown : C.line}`,
                }}
              >
                {t(EXHIBITION_LABEL_KEY[key])}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {SORTS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap"
                style={{
                  background: sort === key ? C.brown : C.white,
                  color: sort === key ? '#fff' : C.text2,
                  border: `1px solid ${sort === key ? C.brown : C.line}`,
                }}
              >
                {t(SORT_LABEL_KEY[key])}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('museum.empty')}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => void openDetail(item)}
                className="rounded-2xl overflow-hidden flex flex-col cursor-pointer transition hover:-translate-y-1"
                style={{ background: C.white, border: `1px solid ${C.line}` }}
              >
                {item.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.cover_url} alt="" className="w-full h-32 object-cover" />
                )}
                <div className="p-4 flex flex-col flex-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-2" style={{ background: C.card2, color: C.brownDk }}>
                    {item.exhibition_display}
                  </span>
                  <h3 className="font-semibold mb-1" style={{ color: C.text }}>{item.title}</h3>
                  <p className="text-sm mb-2 line-clamp-3" style={{ color: C.text2 }}>{item.description}</p>
                  {item.lesson_learned && (
                    <p className="text-xs italic mt-auto pt-2" style={{ color: C.brown }}>💡 {item.lesson_learned}</p>
                  )}
                  <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}>
                    <p className="text-xs" style={{ color: C.text2 }}>@{item.user.username}</p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={(e) => void toggleLike(item, e)}
                        className="flex items-center gap-1 text-xs"
                        style={{ color: item.is_liked ? '#DC2626' : C.text2 }}
                      >
                        {item.is_liked ? <HeartIconSolid className="h-4 w-4" /> : <HeartIcon className="h-4 w-4" />}
                        {item.likes_count}
                      </button>
                      <span className="flex items-center gap-1 text-xs" style={{ color: C.text2 }}>
                        <ChatBubbleLeftIcon className="h-4 w-4" />
                        {item.comments_count}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {submitOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay }} onClick={() => setSubmitOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.cream, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>{t('museum.submit')}</h2>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('museum.formTitle')} className="w-full rounded-xl px-4 py-3 mb-3 outline-none" style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }} />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('museum.formDescription')} rows={3} className="w-full rounded-xl px-4 py-3 mb-3 outline-none" style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }} />
            <textarea value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder={t('museum.formLesson')} rows={2} className="w-full rounded-xl px-4 py-3 mb-3 outline-none" style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }} />
            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder={t('museum.formCoverUrl')} className="w-full rounded-xl px-4 py-3 mb-4 outline-none" style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }} />
            <div className="flex gap-3">
              <button type="button" onClick={() => setSubmitOpen(false)} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>{t('common.cancel')}</button>
              <button type="button" onClick={() => void submit()} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: C.brownDk }}>{t('museum.submit')}</button>
            </div>
          </div>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay }} onClick={() => setActive(null)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6" style={{ background: C.cream, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
            {active.cover_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.cover_url} alt="" className="w-full h-40 object-cover rounded-xl mb-3" />
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start" style={{ background: C.card2, color: C.brownDk }}>
              {active.exhibition_display}
            </span>
            <h2 className="text-lg font-bold mt-2 mb-1" style={{ color: C.text }}>{active.title}</h2>
            <p className="text-sm mb-2" style={{ color: C.text2 }}>{active.description}</p>
            {active.lesson_learned && (
              <p className="text-sm italic mb-2" style={{ color: C.brown }}>💡 {active.lesson_learned}</p>
            )}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs" style={{ color: C.text2 }}>@{active.user.username}</p>
              <button
                type="button"
                onClick={() => void toggleLike(active)}
                disabled={!user}
                className="flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50"
                style={{ color: active.is_liked ? '#DC2626' : C.text2 }}
              >
                {active.is_liked ? <HeartIconSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
                {active.likes_count} {t('museum.like')}
              </button>
            </div>

            <hr style={{ borderColor: C.line }} className="mb-3" />

            <h3 className="text-sm font-semibold mb-2" style={{ color: C.text }}>
              {t('museum.comments')} ({active.comments_count})
            </h3>
            <div className="space-y-2 mb-3 max-h-52 overflow-y-auto">
              {commentsLoading ? (
                <p className="text-xs" style={{ color: C.text2 }}>{t('common.loading')}</p>
              ) : comments.length === 0 ? (
                <p className="text-xs" style={{ color: C.text2 }}>{t('museum.noComments')}</p>
              ) : (
                comments.map((c) => (
                  <p key={c.id} className="text-xs" style={{ color: C.text }}>
                    <span className="font-semibold" style={{ color: C.brownDk }}>@{c.user.username}</span> {c.content}
                  </p>
                ))
              )}
            </div>

            {user ? (
              <form onSubmit={(e) => { e.preventDefault(); void postComment(); }} className="flex gap-2 mb-4">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('museum.commentPlaceholder')}
                  className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
                />
                <button type="submit" className="px-4 rounded-xl text-sm font-semibold text-white" style={{ background: C.brownDk }}>
                  {t('museum.post')}
                </button>
              </form>
            ) : (
              <p className="text-xs mb-4" style={{ color: C.text2 }}>{t('museum.signInToInteract')}</p>
            )}

            <button type="button" onClick={() => setActive(null)} className="w-full rounded-xl py-2.5 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </WorldShell>
  );
}
