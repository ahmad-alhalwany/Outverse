'use client';

import { useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson, apiUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { PlusIcon, BuildingLibraryIcon } from '@heroicons/react/24/outline';

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

type FailedIdea = {
  id: number;
  title: string;
  description: string;
  lesson_learned: string;
  exhibition: string;
  exhibition_display: string;
  cover_url: string;
  user: { username: string; avatar: string | null };
};

export default function MuseumPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [items, setItems] = useState<FailedIdea[]>([]);
  const [exhibition, setExhibition] = useState<(typeof EXHIBITIONS)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lesson, setLesson] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = exhibition !== 'all' ? `?exhibition=${exhibition}` : '';
      const res = await fetch(`${BASE}/${params}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : data.results || []);
      }
    } finally {
      setLoading(false);
    }
  }, [exhibition]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!title.trim()) return;
    const res = await apiFetchJson('speculative/failed-ideas/', {
      method: 'POST',
      json: { title: title.trim(), description: description.trim(), lesson_learned: lesson.trim(), exhibition: exhibition === 'all' ? 'burned_ideas' : exhibition },
    });
    if (res.ok) {
      setSubmitOpen(false);
      setTitle('');
      setDescription('');
      setLesson('');
      void load();
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

        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('museum.empty')}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl p-4 flex flex-col" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-2" style={{ background: C.card2, color: C.brownDk }}>
                  {item.exhibition_display}
                </span>
                <h3 className="font-semibold mb-1" style={{ color: C.text }}>{item.title}</h3>
                <p className="text-sm mb-2 line-clamp-3" style={{ color: C.text2 }}>{item.description}</p>
                {item.lesson_learned && (
                  <p className="text-xs italic mt-auto pt-2" style={{ color: C.brown }}>💡 {item.lesson_learned}</p>
                )}
                <p className="text-xs mt-2" style={{ color: C.text2 }}>@{item.user.username}</p>
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
            <textarea value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder={t('museum.formLesson')} rows={2} className="w-full rounded-xl px-4 py-3 mb-4 outline-none" style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }} />
            <div className="flex gap-3">
              <button type="button" onClick={() => setSubmitOpen(false)} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>{t('common.cancel')}</button>
              <button type="button" onClick={() => void submit()} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white" style={{ background: C.brownDk }}>{t('museum.submit')}</button>
            </div>
          </div>
        </div>
      )}
    </WorldShell>
  );
}
