'use client';

import { useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, apiUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { SparklesIcon } from '@heroicons/react/24/outline';

const BASE = apiUrl('speculative/characters');

const PALETTES = {
  light: {
    cream: '#F3F0FC', card: '#E9E1FA', card2: '#F5F1FE', white: '#FFFFFF',
    brown: '#7C3AED', brownDk: '#5B21B6', text: '#211B3D', text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
  },
  dark: {
    cream: '#14102A', card: '#1E1740', card2: '#251B4D', white: '#2A2154',
    brown: '#C4B5FD', brownDk: '#A78BFA', text: '#F5F3FF', text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
  },
} as const;

const RARITY_COLOR: Record<string, string> = {
  rare: '#4ade80',
  epic: '#818cf8',
  legendary: '#facc15',
};

type Character = {
  id: number;
  name: string;
  description: string;
  rarity: string;
  rarity_display: string;
  image_url: string;
  price: number;
  owned: boolean;
};

export default function CharactersMarketPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [charRes, walletRes] = await Promise.all([
        apiFetch('speculative/characters/'),
        user ? apiFetch('shop/items/wallet/') : Promise.resolve(null),
      ]);
      if (charRes.ok) {
        const data = await charRes.json();
        setCharacters(Array.isArray(data) ? data : data.results || []);
      }
      if (walletRes && walletRes.ok) setBalance((await walletRes.json()).balance ?? null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function summon(character: Character) {
    setBusyId(character.id);
    try {
      const res = await apiFetchJson(`speculative/characters/${character.id}/summon/`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error === 'Insufficient coins.' ? t('characters.insufficientCoins') : data.error || t('characters.summonFailed'));
      } else {
        setToast(t('characters.summonSuccess', { name: character.name }));
        if (typeof data.balance === 'number') setBalance(data.balance);
        void load();
      }
    } finally {
      setBusyId(null);
      window.setTimeout(() => setToast(''), 3000);
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-5xl mx-auto pt-6">
        <div className="flex items-center justify-between mb-6">
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

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : characters.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('characters.empty')}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.map((character) => (
              <div key={character.id} className="rounded-2xl overflow-hidden flex flex-col" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                <div
                  className="h-32 flex items-center justify-center text-5xl"
                  style={{ background: character.image_url ? undefined : `linear-gradient(135deg, ${C.card}, ${C.card2})` }}
                >
                  {!character.image_url && '🧙'}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3 rounded-xl text-sm font-medium text-white" style={{ background: C.brownDk }}>
          {toast}
        </div>
      )}
    </WorldShell>
  );
}
