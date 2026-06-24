'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import IdeaDetailView from '@/components/bazaar/IdeaDetailView';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson, apiUrl } from '@/lib/api';
import type {
  BazaarCollaborationRequest,
  BazaarIdea,
  BazaarIdeaComment,
} from '@/lib/bazaarTypes';
import { getUser } from '@/lib/auth';

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
  const [comments, setComments] = useState<BazaarIdeaComment[]>([]);
  const [applicants, setApplicants] = useState<BazaarCollaborationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [voted, setVoted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'technology',
    roles_needed: '',
    tags: '',
  });

  const me = getUser();

  const loadIdea = useCallback(async () => {
    if (!id) return null;
    const res = await fetch(`${BASE}/${id}/`);
    if (res.status === 404) {
      setNotFound(true);
      setIdea(null);
      return null;
    }
    if (!res.ok) {
      setIdea(null);
      return null;
    }
    const data = (await res.json()) as BazaarIdea;
    setIdea(data);
    setForm({
      title: data.title || '',
      description: data.description || '',
      category: data.category || 'technology',
      roles_needed: Array.isArray(data.roles_needed) ? data.roles_needed.join(', ') : '',
      tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
    });
    return data;
  }, [id]);

  const loadComments = useCallback(async () => {
    if (!id) return;
    setCommentsLoading(true);
    try {
      const res = await fetch(`${BASE}/${id}/comments/`);
      if (!res.ok) throw new Error('failed');
      setComments((await res.json()) as BazaarIdeaComment[]);
    } catch {
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [id]);

  const loadApplicants = useCallback(
    async (ideaData?: BazaarIdea | null) => {
      const currentIdea = ideaData ?? idea;
      if (!id || !currentIdea || !me || currentIdea.owner?.id !== me.id) {
        setApplicants([]);
        setApplicantsLoading(false);
        return;
      }
      setApplicantsLoading(true);
      try {
        const res = await apiFetchJson(`ideas/${id}/applicants/`);
        if (!res.ok) throw new Error('failed');
        setApplicants((await res.json()) as BazaarCollaborationRequest[]);
      } catch {
        setApplicants([]);
      } finally {
        setApplicantsLoading(false);
      }
    },
    [id, idea, me],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const ideaData = await loadIdea();
      await Promise.all([loadComments(), loadApplicants(ideaData)]);
    } catch {
      setIdea(null);
    } finally {
      setLoading(false);
    }
  }, [id, loadApplicants, loadComments, loadIdea]);

  useEffect(() => {
    void load();
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
      void load();
    }
  }

  const canManage = !!(me && idea?.owner?.id && me.id === idea.owner.id);

  async function handleSave() {
    if (!idea) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/`, {
        method: 'PATCH',
        json: {
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          roles_needed: form.roles_needed.split(',').map((value) => value.trim()).filter(Boolean),
          tags: form.tags.split(',').map((value) => value.trim()).filter(Boolean),
        },
      });
      if (!res.ok) throw new Error('failed');
      setEditOpen(false);
      await load();
    } catch {
      setError(t('bazaar.updateIdeaFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!idea || !window.confirm(t('bazaar.confirmDeleteIdea'))) return;
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      router.push('/bazaar');
    } catch {
      setError(t('bazaar.deleteIdeaFailed'));
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
        <IdeaDetailView
          idea={idea}
          voted={voted}
          onVote={() => void handleVote()}
          canManage={canManage}
          onEdit={() => setEditOpen(true)}
          onDelete={() => void handleDelete()}
          comments={comments}
          applicants={applicants}
          commentsLoading={commentsLoading}
          applicantsLoading={applicantsLoading}
          onCommentCreated={(comment) => {
            setComments((prev) => [...prev, comment]);
            setIdea((prev) =>
              prev
                ? { ...prev, discussion_count: (prev.discussion_count ?? comments.length) + 1 }
                : prev,
            );
          }}
          onReportSuccess={() => undefined}
          onApplySuccess={() => {
            void loadApplicants();
            setIdea((prev) =>
              prev
                ? {
                    ...prev,
                    collaboration_request_count: (prev.collaboration_request_count ?? 0) + 1,
                  }
                : prev,
            );
          }}
        />
      )}
      {editOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: C.cream }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>
              {t('bazaar.editIdea')}
            </h2>
            <div className="space-y-3">
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full rounded-xl px-3 py-2.5"
              />
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={4}
                className="w-full rounded-xl px-3 py-2.5"
              />
              <input
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-xl px-3 py-2.5"
              />
              <input
                value={form.roles_needed}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, roles_needed: event.target.value }))
                }
                className="w-full rounded-xl px-3 py-2.5"
                placeholder={t('bazaar.tagsHint')}
              />
              <input
                value={form.tags}
                onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                className="w-full rounded-xl px-3 py-2.5"
                placeholder={t('bazaar.tagsHint')}
              />
            </div>
            {error ? <p className="text-sm mt-3 text-red-600">{error}</p> : null}
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex-1 rounded-xl py-3"
                style={{ background: C.cream, color: C.text2, border: `1px solid ${C.text2}` }}
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 rounded-xl py-3 text-white"
                style={{ background: C.brownDk }}
              >
                {saving ? t('bazaar.savingIdea') : t('bazaar.saveIdea')}
              </button>
            </div>
          </div>
        </div>
      )}
    </WorldShell>
  );
}