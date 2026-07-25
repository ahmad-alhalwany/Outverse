'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import WorldShell from '@/components/world/WorldShell';
import IdeaDetailView from '@/components/bazaar/IdeaDetailView';
import PledgeModal from '@/components/bazaar/PledgeModal';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson, apiUrl } from '@/lib/api';
import { toggleIdeaSave } from '@/lib/bazaarApi';
import { fetchIdeaConstellation, fetchIdeaCrew } from '@/lib/differentiatorApi';
import type { IdeaConstellation, IdeaCrew } from '@/lib/differentiatorApi';
import type {
  BazaarCollaborationRequest,
  BazaarIdea,
  BazaarIdeaComment,
} from '@/lib/bazaarTypes';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

const BASE = apiUrl('ideas');

const PALETTES = {
  light: { cream: '#F3F0FC', text: '#211B3D', text2: '#79709E', brownDk: '#5B21B6' },
  dark: { cream: '#14102A', text: '#F5F3FF', text2: '#B0A6D9', brownDk: '#A78BFA' },
};

export default function BazaarIdeaPage() {
  const params = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLocale();
  const confirm = useConfirm();
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
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [launchCollabBusy, setLaunchCollabBusy] = useState(false);
  const [error, setError] = useState('');
  const [constellation, setConstellation] = useState<IdeaConstellation | null>(null);
  const [crew, setCrew] = useState<IdeaCrew | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'technology',
    roles_needed: '',
    tags: '',
    target_date: '',
  });

  const me = useAuthUser();
  const ideaRef = useRef<BazaarIdea | null>(null);
  useEffect(() => {
    ideaRef.current = idea;
  }, [idea]);

  useEffect(() => {
    if (!error) return;
    const handle = window.setTimeout(() => setError(''), 3200);
    return () => window.clearTimeout(handle);
  }, [error]);

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
    setVoted(!!data.is_voted);
    setForm({
      title: data.title || '',
      description: data.description || '',
      category: data.category || 'technology',
      roles_needed: Array.isArray(data.roles_needed) ? data.roles_needed.join(', ') : '',
      tags: Array.isArray(data.tags) ? data.tags.join(', ') : '',
      target_date: data.target_date || '',
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
      const currentIdea = ideaData ?? ideaRef.current;
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
    // Intentionally excludes `idea` — reads it via ideaRef instead, so this
    // callback's identity (and therefore `load`'s) stays stable across idea
    // updates. Depending on `idea` directly caused an infinite refetch loop:
    // load() -> setIdea() -> loadApplicants identity changes -> load identity
    // changes -> the mount effect (keyed on [load]) re-fires -> load() again.
    [id, me],
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const ideaData = await loadIdea();
      const [constellationData, crewData] = await Promise.all([
        fetchIdeaConstellation(Number(id)),
        fetchIdeaCrew(Number(id)),
      ]);
      setConstellation(constellationData);
      setCrew(crewData);
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
        prev ? { ...prev, supporters: data.supporters ?? prev.supporters, is_voted: data.voted } : prev,
      );
    } catch {
      setError(t('bazaar.voteFailed'));
      void load();
    }
  }

  async function handleToggleSave() {
    if (!idea) return;
    setError('');
    const result = await toggleIdeaSave(idea.id);
    if (!result) {
      setError(t('bazaar.saveFailed'));
      return;
    }
    setIdea((prev) => (prev ? { ...prev, is_saved: result.saved } : prev));
  }

  const canManage = !!(me && idea?.owner?.id && me.id === idea.owner.id);

  async function handleLaunchCollab() {
    if (!idea) return;
    setLaunchCollabBusy(true);
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/launch-collab/`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setIdea((prev) =>
        prev
          ? {
              ...prev,
              collab_project_id: data.collab_project_id,
              status: data.status ?? prev.status,
            }
          : prev,
      );
      router.push(`/collab?project=${data.collab_project_id}`);
    } catch {
      setError(t('bazaar.launchCollabFailed'));
    } finally {
      setLaunchCollabBusy(false);
    }
  }

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
          target_date: form.target_date || null,
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
    if (!idea || !(await confirm(t('bazaar.confirmDeleteIdea'), { danger: true, confirmLabel: 'Delete' }))) return;
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
      {error && !editOpen ? (
        <p
          className="fixed left-1/2 top-4 z-[1100] -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg"
          style={{ background: '#DC2626' }}
        >
          {error}
        </p>
      ) : null}
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
          voted={!!idea.is_voted || voted}
          saved={!!idea.is_saved}
          onVote={() => void handleVote()}
          onToggleSave={() => void handleToggleSave()}
          onPledge={() => setPledgeOpen(true)}
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
          onApplicantResponded={({ collab_project_id, idea_status }) => {
            setIdea((prev) =>
              prev
                ? {
                    ...prev,
                    collab_project_id: collab_project_id ?? prev.collab_project_id,
                    status: idea_status ?? prev.status,
                    collaborators_count: (prev.collaborators_count ?? 0) + 1,
                  }
                : prev,
            );
            void loadIdea();
          }}
          onLaunchCollab={() => void handleLaunchCollab()}
          launchCollabBusy={launchCollabBusy}
          constellation={constellation}
          crew={crew}
        />
      )}
      {pledgeOpen && idea && (
        <PledgeModal
          idea={idea}
          onClose={() => setPledgeOpen(false)}
          onPledged={(funding_raised) => {
            setIdea((prev) => (prev ? { ...prev, funding_raised } : prev));
            setPledgeOpen(false);
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
              <label className="text-sm font-medium block" style={{ color: C.text2 }}>
                {t('bazaar.targetDateLabel')}
              </label>
              <input
                type="date"
                value={form.target_date}
                onChange={(event) => setForm((prev) => ({ ...prev, target_date: event.target.value }))}
                className="w-full rounded-xl px-3 py-2.5"
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