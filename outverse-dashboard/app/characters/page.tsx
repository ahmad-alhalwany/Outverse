'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, apiUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { SparklesIcon as SparklesIconSolid } from '@heroicons/react/24/solid';

const BASE = apiUrl('speculative/characters');

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

const RARITY_COLOR: Record<string, string> = {
  rare: '#4ade80',
  epic: '#818cf8',
  legendary: '#facc15',
};

const RARITY_ORDER = ['rare', 'epic', 'legendary'];

type Character = {
  id: number;
  name: string;
  description: string;
  rarity: string;
  rarity_display: string;
  image_url: string;
  emoji: string;
  price: number;
  owned: boolean;
  is_ai_generated: boolean;
  is_public: boolean;
};

type ForgeStory = { id: number; title: string; characters: unknown[] };

export default function CharactersMarketPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();

  const [tab, setTab] = useState<'market' | 'mine'>('market');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [mine, setMine] = useState<Character[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
  const [merging, setMerging] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPrompt, setCreatePrompt] = useState('');
  const [creating, setCreating] = useState(false);

  const [mysterySummoning, setMysterySummoning] = useState(false);
  const [reveal, setReveal] = useState<Character | null>(null);

  const [forgePickerFor, setForgePickerFor] = useState<Character | null>(null);
  const [forgeStories, setForgeStories] = useState<ForgeStory[] | null>(null);
  const [sendingToForge, setSendingToForge] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [charRes, mineRes, walletRes] = await Promise.all([
        apiFetch('speculative/characters/'),
        user ? apiFetch('speculative/characters/mine/') : Promise.resolve(null),
        user ? apiFetch('shop/items/wallet/') : Promise.resolve(null),
      ]);
      if (charRes.ok) {
        const data = await charRes.json();
        setCharacters(Array.isArray(data) ? data : data.results || []);
      }
      if (mineRes && mineRes.ok) setMine(await mineRes.json());
      if (walletRes && walletRes.ok) setBalance((await walletRes.json()).balance ?? null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }

  async function summon(character: Character) {
    setBusyId(character.id);
    try {
      const res = await apiFetchJson(`${BASE}/${character.id}/summon/`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error === 'Insufficient coins.' ? t('characters.insufficientCoins') : data.error || t('characters.summonFailed'));
      } else {
        showToast(t('characters.summonSuccess', { name: character.name }));
        if (typeof data.balance === 'number') setBalance(data.balance);
        void load();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function mysterySummon() {
    if (!user) return;
    setMysterySummoning(true);
    try {
      const res = await apiFetchJson(`${BASE}/mystery-summon/`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error === 'Insufficient coins.' ? t('characters.insufficientCoins') : data.error || t('characters.summonFailed'));
      } else {
        setReveal(data);
        if (typeof data.balance === 'number') setBalance(data.balance);
        void load();
      }
    } finally {
      setMysterySummoning(false);
    }
  }

  function toggleMergeSelect(character: Character) {
    setSelectedForMerge((prev) => {
      if (prev.includes(character.id)) return prev.filter((id) => id !== character.id);
      if (prev.length >= 2) return prev;
      return [...prev, character.id];
    });
  }

  async function confirmMerge() {
    if (selectedForMerge.length !== 2) {
      showToast(t('characters.mergeNeedTwo'));
      return;
    }
    setMerging(true);
    try {
      const res = await apiFetchJson(`${BASE}/merge/`, { method: 'POST', json: { character_ids: selectedForMerge } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || t('characters.mergeFailed'));
      } else {
        setReveal(data);
        showToast(t('characters.mergeSuccess', { name: data.name }));
        setSelectedForMerge([]);
        setMergeMode(false);
        void load();
      }
    } finally {
      setMerging(false);
    }
  }

  async function createCustom() {
    const prompt = createPrompt.trim();
    if (!prompt) return;
    setCreating(true);
    try {
      const res = await apiFetchJson(`${BASE}/create-custom/`, { method: 'POST', json: { prompt } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error === 'Insufficient coins.' ? t('characters.insufficientCoins') : data.error || t('characters.createFailed'));
      } else {
        setReveal(data);
        setCreateOpen(false);
        setCreatePrompt('');
        if (typeof data.balance === 'number') setBalance(data.balance);
        void load();
      }
    } finally {
      setCreating(false);
    }
  }

  async function openForgePicker(character: Character) {
    setForgePickerFor(character);
    if (!forgeStories && user) {
      const res = await apiFetch(`forge/stories/?owner=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setForgeStories(Array.isArray(data) ? data : data.results || []);
      } else {
        setForgeStories([]);
      }
    }
  }

  async function sendToForge(storyId: number, storyTitle: string) {
    if (!forgePickerFor) return;
    setSendingToForge(true);
    const character = forgePickerFor;
    try {
      const storyRes = await apiFetch(`forge/stories/${storyId}/`);
      if (!storyRes.ok) throw new Error('story fetch failed');
      const story = await storyRes.json();
      const nextCharacters = [
        ...(Array.isArray(story.characters) ? story.characters : []),
        {
          name: character.name,
          role: character.rarity_display,
          traits: [character.rarity_display],
          voice: '',
          notes: character.description,
          emoji: character.emoji,
          source_character_id: character.id,
        },
      ];
      const patchRes = await apiFetchJson(`forge/stories/${storyId}/`, { method: 'PATCH', json: { characters: nextCharacters } });
      if (!patchRes.ok) throw new Error('patch failed');
      showToast(t('characters.sendToForgeSuccess', { character: character.name, story: storyTitle }));
      setForgePickerFor(null);
    } catch {
      showToast(t('characters.sendToForgeFailed'));
    } finally {
      setSendingToForge(false);
    }
  }

  const list = tab === 'market' ? characters : mine;
  const mergeEligible = selectedForMerge.length === 2 && (() => {
    const a = mine.find((c) => c.id === selectedForMerge[0]);
    const b = mine.find((c) => c.id === selectedForMerge[1]);
    return !!a && !!b && a.rarity === b.rarity && RARITY_ORDER.indexOf(a.rarity) < RARITY_ORDER.length - 1;
  })();

  return (
    <WorldShell colors={C}>
      <div className="max-w-5xl mx-auto pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: C.brown }}>🧙 {t('characters.title')}</h1>
            <p className="text-sm" style={{ color: C.text2 }}>{t('characters.subtitle')}</p>
          </div>
          {balance != null && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold shrink-0" style={{ background: C.card, color: C.brownDk }}>
              <SparklesIcon className="h-4 w-4" />
              {balance.toLocaleString()} {t('common.coins')}
            </div>
          )}
        </div>

        {user && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => void mysterySummon()}
              disabled={mysterySummoning}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white text-sm disabled:opacity-60"
              style={{ background: C.brownDk }}
              title={t('characters.mysterySummonHint')}
            >
              <SparklesIconSolid className="h-4 w-4" />
              {t('characters.mysterySummon')} (120 ✨)
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm"
              style={{ background: C.card2, color: C.brownDk }}
            >
              ✏️ {t('characters.createOwn')}
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {(['market', 'mine'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="px-4 py-2 rounded-full text-sm font-medium"
              style={{
                background: tab === key ? C.brown : C.white,
                color: tab === key ? '#fff' : C.text2,
                border: `1px solid ${tab === key ? C.brown : C.line}`,
              }}
            >
              {key === 'market' ? t('characters.tabMarket') : `${t('characters.tabMine')} (${mine.length})`}
            </button>
          ))}
        </div>

        {tab === 'mine' && user && mine.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-2xl" style={{ background: C.card2 }}>
            <button
              type="button"
              onClick={() => { setMergeMode((v) => !v); setSelectedForMerge([]); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: mergeMode ? C.brownDk : C.white, color: mergeMode ? '#fff' : C.brownDk }}
            >
              🧪 {mergeMode ? t('characters.mergeModeOn') : t('characters.mergeMode')}
            </button>
            {mergeMode && (
              <>
                <span className="text-xs" style={{ color: C.text2 }}>{t('characters.mergeHint')}</span>
                <button
                  type="button"
                  onClick={() => void confirmMerge()}
                  disabled={!mergeEligible || merging}
                  className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white disabled:opacity-40"
                  style={{ background: C.brown }}
                >
                  {merging ? t('characters.mergeFusing') : `${t('characters.mergeButton')} (${selectedForMerge.length}/2)`}
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>
            {tab === 'market' ? t('characters.empty') : t('characters.mineEmpty')}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((character) => {
              const selected = selectedForMerge.includes(character.id);
              const selectable = mergeMode && tab === 'mine';
              return (
                <div
                  key={character.id}
                  onClick={selectable ? () => toggleMergeSelect(character) : undefined}
                  className="rounded-2xl overflow-hidden flex flex-col"
                  style={{
                    background: C.white,
                    border: `1px solid ${selected ? C.brownDk : C.line}`,
                    boxShadow: selected ? `0 0 0 2px ${C.brownDk}` : undefined,
                    cursor: selectable ? 'pointer' : undefined,
                  }}
                >
                  <div
                    className="h-32 flex items-center justify-center text-5xl relative"
                    style={{ background: character.image_url ? undefined : `linear-gradient(135deg, ${C.card}, ${C.card2})` }}
                  >
                    {!character.image_url && character.emoji}
                    {character.is_ai_generated && (
                      <span
                        className="absolute top-2 end-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: C.brownDk, color: '#fff' }}
                      >
                        ✨ {t('characters.aiGenerated')}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <span
                      className="text-xs font-bold uppercase tracking-wide self-start px-2 py-0.5 rounded-full mb-2"
                      style={{ background: `${RARITY_COLOR[character.rarity]}22`, color: RARITY_COLOR[character.rarity] }}
                    >
                      {character.rarity_display}
                    </span>
                    <h3 className="font-semibold" style={{ color: C.text }}>{character.name}</h3>
                    <p className="text-sm mt-1 flex-1 line-clamp-2" style={{ color: C.text2 }}>{character.description}</p>

                    {tab === 'market' ? (
                      <button
                        type="button"
                        onClick={() => void summon(character)}
                        disabled={character.owned || busyId === character.id || !user}
                        className="mt-3 w-full py-2.5 rounded-xl font-semibold text-white text-sm disabled:opacity-60"
                        style={{ background: C.brownDk }}
                      >
                        {character.owned
                          ? t('characters.owned')
                          : busyId === character.id
                            ? t('characters.summoning')
                            : `${t('characters.summonFor')} ${character.price} ✨`}
                      </button>
                    ) : (
                      !mergeMode && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void openForgePicker(character); }}
                          className="mt-3 w-full py-2.5 rounded-xl font-semibold text-sm"
                          style={{ background: C.card2, color: C.brownDk }}
                        >
                          📖 {t('characters.sendToForge')}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3 rounded-xl text-sm font-medium text-white text-center" style={{ background: C.brownDk }}>
          {toast}
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay }} onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: C.cream, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-1" style={{ color: C.text }}>{t('characters.createTitle')}</h2>
            <p className="text-xs mb-3" style={{ color: C.text2 }}>{t('characters.createPrivateNote')}</p>
            <textarea
              value={createPrompt}
              onChange={(e) => setCreatePrompt(e.target.value)}
              placeholder={t('characters.createPromptPlaceholder')}
              rows={3}
              className="w-full rounded-xl px-4 py-3 mb-3 outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            />
            <p className="text-xs font-semibold mb-4" style={{ color: C.brownDk }}>{t('characters.createCost', { price: '150' })}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="flex-1 rounded-xl py-3 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void createCustom()}
                disabled={creating || !createPrompt.trim()}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: C.brownDk }}
              >
                {creating ? t('characters.createCreating') : t('characters.createSubmit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {forgePickerFor && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: C.overlay }} onClick={() => setForgePickerFor(null)}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[70vh] overflow-y-auto" style={{ background: C.cream, border: `1px solid ${C.line}` }} onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: C.text }}>{t('characters.sendToForgeTitle')}</h2>
            {forgeStories === null ? (
              <p className="text-xs" style={{ color: C.text2 }}>{t('common.loading')}</p>
            ) : forgeStories.length === 0 ? (
              <p className="text-xs" style={{ color: C.text2 }}>{t('characters.sendToForgeEmpty')}</p>
            ) : (
              <div className="space-y-1.5">
                {forgeStories.map((story) => (
                  <button
                    key={story.id}
                    type="button"
                    disabled={sendingToForge}
                    onClick={() => void sendToForge(story.id, story.title)}
                    className="w-full text-start px-3 py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
                    style={{ background: C.white, color: C.text, border: `1px solid ${C.line}` }}
                  >
                    {story.title}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setForgePickerFor(null)} className="w-full rounded-xl py-2.5 mt-4 text-sm font-semibold" style={{ background: C.card2, color: C.text }}>
              {t('characters.close')}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {reveal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
            style={{ background: C.overlay }}
            onClick={() => setReveal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-6 text-center"
              style={{ background: C.cream, border: `1px solid ${C.line}` }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300 }}
                className="text-6xl mb-3"
              >
                {reveal.emoji}
              </motion.div>
              <span
                className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: `${RARITY_COLOR[reveal.rarity]}22`, color: RARITY_COLOR[reveal.rarity] }}
              >
                {reveal.rarity_display}
              </span>
              <h3 className="text-xl font-bold mt-2 mb-1" style={{ color: C.text }}>{reveal.name}</h3>
              <p className="text-sm mb-4" style={{ color: C.text2 }}>{reveal.description}</p>
              <button type="button" onClick={() => setReveal(null)} className="w-full rounded-xl py-2.5 text-sm font-semibold text-white" style={{ background: C.brownDk }}>
                {t('characters.close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </WorldShell>
  );
}
