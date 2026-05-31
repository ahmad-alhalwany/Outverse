'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import IdeaDetailView from '@/components/bazaar/IdeaDetailView';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson } from '@/lib/api';
import { apiUrl } from '@/lib/api';
import type { BazaarIdea } from '@/lib/bazaarTypes';

const BASE = apiUrl('ideas');

const PALETTES = {
  light: { cream: '#FBF3EE', text: '#3D2B22', text2: '#9A8278', brownDk: '#854330' },
  dark: { cream: '#1a1a2e', text: '#F5F6FA', text2: '#B3B3B3', brownDk: '#a0563b' },
};

export default function BazaarIdeaPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLocale();
  const C = PALETTES[theme];
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [idea, setIdea] = useState<BazaarIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [voted, setVoted] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`${BASE}/${id}/`);
      if (res.ok) {
        setIdea(await res.json());
      } else if (res.status === 404) {
        setNotFound(true);
        setIdea(null);
      } else {
        setIdea(null);
      }
    } catch {
      setIdea(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleVote() {
    if (!idea) return;
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/vote/`, { method: 'POST' });
      if (!res.ok) throw new Error('vote failed');
      const data = await res.json();
      setVoted(!!data.voted);
      setIdea((prev) =>
        prev ? { ...prev, supporters: data.supporters ?? prev.supporters } : prev,
      );
    } catch {
      load();
    }
  }

  return (
    <WorldShell colors={PALETTES[theme]}>
      {loading ? (
        <p className="text-center py-16 text-sm" style={{ color: C.text2 }}>
          {t('bazaar.loading')}
        </p>
      ) : notFound || !idea ? (
        <div className="text-center py-16">
          <p className="mb-4" style={{ color: C.text2 }}>
            {t('bazaar.ideaNotFound')}
          </p>
          <button
            type="button"
            onClick={() => router.push('/bazaar')}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: C.brownDk }}
          >
            {t('bazaar.backToBazaar')}
          </button>
        </div>
      ) : (
        <IdeaDetailView idea={idea} voted={voted} onVote={() => void handleVote()} />
      )}
    </WorldShell>
  );
}
