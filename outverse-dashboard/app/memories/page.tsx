'use client';

import { useCallback, useEffect, useState } from 'react';
import WorldShell from '@/components/world/WorldShell';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, apiUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import RelativeTime from '@/components/RelativeTime';
import { BanknotesIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const BASE = apiUrl('speculative/future-memories');

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

type Memory = { id: number; text: string; tag: string; is_public: boolean; user: { username: string }; created_at: string };

export default function FutureMemoriesPage() {
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const user = useAuthUser();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${BASE}/`);
      if (res.ok) {
        const data = await res.json();
        setMemories(Array.isArray(data) ? data : data.results || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deposit() {
    if (!text.trim()) return;
    const res = await apiFetchJson('speculative/future-memories/', {
      method: 'POST',
      json: { text: text.trim(), tag: tag.trim(), is_public: isPublic },
    });
    if (res.ok) {
      setText('');
      setTag('');
      void load();
    }
  }

  return (
    <WorldShell colors={C}>
      <div className="max-w-3xl mx-auto pt-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: C.brown }}>🏦 {t('memories.title')}</h1>
        <p className="text-sm mb-6" style={{ color: C.text2 }}>{t('memories.subtitle')}</p>

        {user && (
          <div className="rounded-2xl p-5 mb-6" style={{ background: C.white, border: `1px solid ${C.line}` }}>
            <p className="text-sm font-semibold mb-2" style={{ color: C.text }}>{t('memories.depositTitle')}</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('memories.depositPlaceholder')}
              rows={3}
              className="w-full rounded-xl px-4 py-3 mb-3 outline-none"
              style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}
            />
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder={t('memories.tagPlaceholder')}
                className="rounded-xl px-3 py-2 text-sm outline-none flex-1 min-w-[140px]"
                style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text }}
              />
              <label className="flex items-center gap-2 text-sm" style={{ color: C.text2 }}>
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                {t('memories.makePublic')}
              </label>
            </div>
            <button type="button" onClick={() => void deposit()} className="px-4 py-2.5 rounded-xl font-semibold text-white text-sm" style={{ background: C.brownDk }}>
              <BanknotesIcon className="h-4 w-4 inline-block mr-1.5 -mt-0.5" />
              {t('memories.deposit')}
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center" style={{ color: C.text2 }}>{t('common.loading')}</div>
        ) : memories.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: C.card2, color: C.text2 }}>{t('memories.empty')}</div>
        ) : (
          <div className="space-y-3">
            {memories.map((memory) => (
              <div key={memory.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.line}` }}>
                <p className="text-sm" style={{ color: C.text }}>{memory.text}</p>
                <div className="flex items-center justify-between mt-3 text-xs" style={{ color: C.text2 }}>
                  <span>
                    @{memory.user.username}
                    {memory.tag && <span className="ml-2 px-2 py-0.5 rounded-full" style={{ background: C.card2 }}>#{memory.tag}</span>}
                    {!memory.is_public && <LockClosedIcon className="h-3 w-3 inline-block ml-2 -mt-0.5" />}
                  </span>
                  <RelativeTime date={memory.created_at} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WorldShell>
  );
}
