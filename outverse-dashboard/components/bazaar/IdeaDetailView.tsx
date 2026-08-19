'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeftIcon,
  BookmarkIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  FlagIcon,
  RocketLaunchIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid, BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson, mediaUrl } from '@/lib/api';
import {
  bazaarCategoryLabel,
  bazaarOwnerName,
  formatIdeaTargetDate,
  type BazaarCollaborationRequest,
  type BazaarIdea,
  type BazaarIdeaComment,
  type IdeaMilestone,
} from '@/lib/bazaarTypes';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import IdeaConstellationSection from '@/components/bazaar/IdeaConstellationSection';
import IdeaCrewPanel from '@/components/bazaar/IdeaCrewPanel';
import type { IdeaConstellation, IdeaCrew } from '@/lib/differentiatorApi';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    btnShadow: '0 6px 20px rgba(124,58,237,0.3)',
    overlay: 'rgba(33,27,61,0.45)',
    toastBg: '#2f8f6b',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    progressBg: 'rgba(255,255,255,0.08)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    btnShadow: '0 6px 20px rgba(167,139,250,0.3)',
    overlay: 'rgba(10,8,24,0.65)',
    toastBg: '#4ade80',
  },
};

type Props = {
  idea: BazaarIdea;
  voted: boolean;
  saved: boolean;
  onVote: () => void;
  onToggleSave: () => void;
  onPledge: () => void;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  comments: BazaarIdeaComment[];
  applicants: BazaarCollaborationRequest[];
  commentsLoading: boolean;
  applicantsLoading: boolean;
  onCommentCreated: (comment: BazaarIdeaComment) => void;
  onReportSuccess: () => void;
  onApplySuccess: () => void;
  onApplicantResponded?: (result: { collab_project_id?: number; idea_status?: string }) => void;
  onLaunchCollab?: () => void;
  launchCollabBusy?: boolean;
  constellation?: IdeaConstellation | null;
  crew?: IdeaCrew | null;
};

function formatDate(value: string | undefined, justNow: string) {
  if (!value) return justNow;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return justNow;
  return date.toLocaleString();
}

function displayName(user: BazaarIdea['owner'], anonymous: string) {
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username || anonymous;
}

export default function IdeaDetailView({
  idea,
  voted,
  saved,
  onVote,
  onToggleSave,
  onPledge,
  canManage,
  onEdit,
  onDelete,
  comments,
  applicants,
  commentsLoading,
  applicantsLoading,
  onCommentCreated,
  onReportSuccess,
  onApplySuccess,
  onApplicantResponded,
  onLaunchCollab,
  launchCollabBusy = false,
  constellation,
  crew,
}: Props) {
  const { theme } = useTheme();
  const { t, locale } = useLocale();
  const C = PALETTES[theme];
  const pct = idea.funding_goal
    ? Math.min(100, Math.round((idea.funding_raised / idea.funding_goal) * 100))
    : null;
  const ownerName = bazaarOwnerName(idea);
  const me = useAuthUser();
  const confirm = useConfirm();
  const dueLabel = formatIdeaTargetDate(idea.target_date, locale);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyRole, setApplyRole] = useState(idea.roles_needed?.[0] || '');
  const [applyMessage, setApplyMessage] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState('');
  const [reporting, setReporting] = useState(false);
  const [localComments, setLocalComments] = useState(comments);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [applicantsLocal, setApplicantsLocal] = useState(applicants);
  const [milestonesLocal, setMilestonesLocal] = useState<IdeaMilestone[]>(idea.milestones || []);
  const [newMilestone, setNewMilestone] = useState('');
  const [milestonesSaving, setMilestonesSaving] = useState(false);

  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  useEffect(() => {
    setApplicantsLocal(applicants);
  }, [applicants]);

  useEffect(() => {
    setMilestonesLocal(idea.milestones || []);
  }, [idea.milestones]);

  async function submitComment() {
    if (!comment.trim()) {
      setCommentError(t('bazaar.writeCommentFirst'));
      return;
    }
    setCommentError('');
    setCommenting(true);
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/comments/`, {
        method: 'POST',
        json: { content: comment.trim() },
      });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as BazaarIdeaComment;
      setLocalComments((current) => [data, ...current]);
      onCommentCreated(data);
      setComment('');
    } catch {
      setCommentError(t('bazaar.postCommentFailed'));
    } finally {
      setCommenting(false);
    }
  }

  async function updateComment(commentId: number) {
    if (!editCommentText.trim()) return;
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/comments/${commentId}/`, {
        method: 'PATCH',
        json: { content: editCommentText.trim() },
      });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as BazaarIdeaComment;
      setLocalComments((current) => current.map((c) => (c.id === commentId ? data : c)));
      setEditingCommentId(null);
      setEditCommentText('');
    } catch {
      setToast(t('bazaar.updateCommentFailed'));
      setTimeout(() => setToast(''), 2500);
    }
  }

  async function removeComment(commentId: number) {
    if (!(await confirm(t('bazaar.confirmDeleteComment'), { danger: true, confirmLabel: t('common.delete') }))) return;
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/comments/${commentId}/`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      setLocalComments((current) => current.filter((c) => c.id !== commentId));
    } catch {
      setToast(t('bazaar.deleteCommentFailed'));
      setTimeout(() => setToast(''), 2500);
    }
  }

  async function respondApplicant(applicantId: number, action: 'accept' | 'reject') {
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/applicants/${applicantId}/respond/`, {
        method: 'POST',
        json: { action },
      });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as BazaarCollaborationRequest;
      onApplySuccess();
      setApplicantsLocal((current) => current.map((a) => (a.id === applicantId ? data : a)));
      if (data.collab_project_id || data.idea_status) {
        onApplicantResponded?.({
          collab_project_id: data.collab_project_id,
          idea_status: data.idea_status,
        });
      }
    } catch {
      setToast(t('bazaar.respondApplicantFailed'));
      setTimeout(() => setToast(''), 2500);
    }
  }

  async function persistMilestones(next: IdeaMilestone[]) {
    setMilestonesSaving(true);
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/`, {
        method: 'PATCH',
        json: { milestones: next },
      });
      if (!res.ok) throw new Error('failed');
      const data = (await res.json()) as BazaarIdea;
      setMilestonesLocal(data.milestones || next);
    } catch {
      setToast(t('bazaar.updateMilestonesFailed'));
      setTimeout(() => setToast(''), 2500);
    } finally {
      setMilestonesSaving(false);
    }
  }

  async function toggleMilestone(milestoneId: string) {
    const next = milestonesLocal.map((item) =>
      item.id === milestoneId ? { ...item, done: !item.done } : item,
    );
    setMilestonesLocal(next);
    await persistMilestones(next);
  }

  async function addMilestone() {
    const title = newMilestone.trim();
    if (!title) return;
    const next = [
      ...milestonesLocal,
      { id: `m-${Date.now()}`, title, done: false, due_date: null },
    ];
    setNewMilestone('');
    setMilestonesLocal(next);
    await persistMilestones(next);
  }

  async function submitApplication() {
    if (!applyRole.trim()) {
      setApplyError(t('bazaar.chooseRoleFirst'));
      return;
    }
    setApplyError('');
    setApplying(true);
    try {
      const res = await apiFetchJson(`ideas/${idea.id}/apply/`, {
        method: 'POST',
        json: { role: applyRole.trim(), message: applyMessage.trim() },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'failed');
      }
      setApplyOpen(false);
      setApplyMessage('');
      onApplySuccess();
      setToast(t('bazaar.applicationSent'));
      setTimeout(() => setToast(''), 2500);
    } catch (error) {
      setApplyError(error instanceof Error && error.message !== 'failed' ? error.message : t('bazaar.applicationFailed'));
    } finally {
      setApplying(false);
    }
  }

  async function reportIdea() {
    setReporting(true);
    try {
      const res = await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'idea',
          object_id: idea.id,
          content: `${idea.title}\n\n${idea.description}`,
        },
      });
      if (!res.ok) throw new Error('failed');
      onReportSuccess();
      setToast(t('bazaar.reportSuccess'));
      setTimeout(() => setToast(''), 2500);
    } catch {
      setToast(t('bazaar.reportFailed'));
      setTimeout(() => setToast(''), 2500);
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/bazaar"
        className="inline-flex items-center gap-2 text-sm font-medium mb-4 hover:opacity-80"
        style={{ color: C.text2 }}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t('bazaar.backToBazaar')}
      </Link>

      {toast ? (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm font-semibold text-white"
          style={{ background: C.toastBg }}
        >
          {toast}
        </div>
      ) : null}

      <article
        className="rounded-2xl overflow-hidden"
        style={{ background: C.white, border: `1px solid ${C.line}` }}
      >
        <div
          className="h-48 sm:h-56 bg-cover bg-center"
          style={{
            background: idea.cover_url
              ? `url(${idea.cover_url}) center/cover`
              : `linear-gradient(135deg, ${C.card}, ${C.card2})`,
          }}
        />
        <div className="p-5 sm:p-6">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: C.card2, color: C.brown }}
          >
            {bazaarCategoryLabel(idea.category, locale)}
          </span>
          {idea.status !== 'proposed' && (
            <span
              className="ms-2 px-2.5 py-1 rounded-full text-xs"
              style={{ background: C.fundedBg, color: C.fundedText }}
            >
              {idea.status === 'in_progress'
                ? t('bazaar.inProgress')
                : t('bazaar.completed')}
            </span>
          )}
          {idea.collab_project_id ? (
            <span
              className="ms-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: C.fundedBg, color: C.fundedText }}
            >
              <RocketLaunchIcon className="h-3.5 w-3.5" />
              {t('bazaar.collabActive')}
            </span>
          ) : null}
          <h1 className="text-2xl font-bold mt-3" style={{ color: C.text }}>
            {idea.title}
          </h1>
          <p
            className="text-sm mt-3 leading-relaxed whitespace-pre-wrap"
            style={{ color: C.text2 }}
          >
            {idea.description}
          </p>
          {dueLabel ? (
            <p className="inline-flex items-center gap-1.5 text-sm mt-3" style={{ color: C.brownDk }}>
              <CalendarDaysIcon className="h-4 w-4" />
              {t('bazaar.dueBy').replace('{date}', dueLabel)}
            </p>
          ) : null}
          {idea.tags && idea.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {idea.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: C.card2, color: C.brownDk }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {idea.silent_unlocked ? (
            <div className="mt-4 rounded-xl px-4 py-3 text-sm font-medium" style={{ background: C.fundedBg, color: C.fundedText }}>
              {t('bazaar.silentUnlocked')}
            </div>
          ) : null}
          {pct != null && (
            <div className="mt-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
              </div>
              <div className="flex items-center justify-between mt-1 gap-3">
                <p className="text-xs" style={{ color: C.text2 }}>
                  ${idea.funding_raised.toLocaleString()} {t('bazaar.raised')} · $
                  {idea.funding_goal?.toLocaleString()} {t('bazaar.goal')}
                </p>
                <button
                  type="button"
                  onClick={onPledge}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                  style={{ background: C.brown }}
                >
                  {t('bazaar.pledgeCta')}
                </button>
              </div>
            </div>
          )}
          {idea.roles_needed?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {idea.roles_needed.map((role) => (
                <span
                  key={role}
                  className="px-2 py-1 rounded-md text-xs"
                  style={{ background: C.card2, color: C.text }}
                >
                  {role}
                </span>
              ))}
            </div>
          )}
          {constellation ? <IdeaConstellationSection data={constellation} /> : null}
          {crew ? <IdeaCrewPanel crew={crew} /> : null}
          {(milestonesLocal.length > 0 || canManage) && (
            <section className="mt-5 rounded-xl p-4" style={{ background: C.card2, border: `1px solid ${C.line}` }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: C.text }}>
                {t('bazaar.milestones')}
              </h2>
              {milestonesLocal.length === 0 ? (
                <p className="text-xs" style={{ color: C.text2 }}>
                  {t('bazaar.addMilestone')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {milestonesLocal.map((milestone) => (
                    <li key={milestone.id} className="flex items-start gap-2 text-sm">
                      {canManage ? (
                        <input
                          type="checkbox"
                          checked={milestone.done}
                          disabled={milestonesSaving}
                          onChange={() => void toggleMilestone(milestone.id)}
                          className="mt-1"
                        />
                      ) : (
                        <span style={{ color: milestone.done ? C.fundedText : C.text2 }}>
                          {milestone.done ? '✓' : '○'}
                        </span>
                      )}
                      <span
                        style={{
                          color: milestone.done ? C.text2 : C.text,
                          textDecoration: milestone.done ? 'line-through' : 'none',
                        }}
                      >
                        {milestone.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {canManage ? (
                <div className="flex gap-2 mt-3">
                  <input
                    value={newMilestone}
                    onChange={(event) => setNewMilestone(event.target.value)}
                    placeholder={t('bazaar.milestoneTitle')}
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
                  />
                  <button
                    type="button"
                    onClick={() => void addMilestone()}
                    disabled={milestonesSaving || !newMilestone.trim()}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ background: C.brownDk }}
                  >
                    {t('bazaar.addMilestone')}
                  </button>
                </div>
              ) : null}
            </section>
          )}
          <div
            className="flex items-center justify-between mt-5 pt-4 border-t"
            style={{ borderColor: C.line }}
          >
            {idea.owner?.id ? (
              <Link
                href={`/profile/${idea.owner.id}`}
                className="text-sm font-medium hover:underline"
                style={{ color: C.brown }}
              >
                {ownerName}
              </Link>
            ) : (
              <span className="text-sm" style={{ color: C.text2 }}>
                {ownerName}
              </span>
            )}
            <div className="flex items-center gap-4 text-xs" style={{ color: C.text2 }}>
              <span className="flex items-center gap-1">
                <UsersIcon className="h-4 w-4" />
                {idea.collaborators_count} {t('bazaar.collaborators')}
              </span>
              <span className="flex items-center gap-1">
                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                {idea.discussion_count ?? comments.length}
              </span>
            </div>
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2 mt-4">
              {idea.collab_project_id ? (
                <Link
                  href={`/collab?project=${idea.collab_project_id}`}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-white min-w-[10rem]"
                  style={{ background: C.brownDk }}
                >
                  <RocketLaunchIcon className="h-4 w-4" />
                  {t('bazaar.openCollabHub')}
                </Link>
              ) : onLaunchCollab ? (
                <button
                  type="button"
                  onClick={onLaunchCollab}
                  disabled={launchCollabBusy}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-white min-w-[10rem] disabled:opacity-60"
                  style={{ background: C.brownDk }}
                >
                  <RocketLaunchIcon className="h-4 w-4" />
                  {launchCollabBusy ? t('bazaar.launchingCollab') : t('bazaar.launchCollabHub')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
              >
                <PencilSquareIcon className="h-4 w-4" />
                {t('bazaar.editIdea')}
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-white"
                style={{ background: C.brownDk }}
              >
                <TrashIcon className="h-4 w-4" />
                {t('bazaar.deleteIdea')}
              </button>
            </div>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={onVote}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white sm:col-span-1"
              style={{
                background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`,
                boxShadow: C.btnShadow,
              }}
            >
              {voted ? <HeartSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
              {voted ? t('bazaar.supported') : t('bazaar.supportIdea')}
            </button>
            <button
              type="button"
              onClick={onToggleSave}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
              style={{
                background: saved ? C.fundedBg : C.card2,
                color: saved ? C.fundedText : C.brownDk,
                border: `1px solid ${C.line}`,
              }}
            >
              {saved ? <BookmarkSolid className="h-5 w-5" /> : <BookmarkIcon className="h-5 w-5" />}
              {saved ? t('bazaar.savedIdea') : t('bazaar.bookmarkIdea')}
            </button>
            {idea.roles_needed?.length > 0 && !canManage ? (
              <button
                type="button"
                onClick={() => setApplyOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold sm:col-span-1"
                style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
              >
                <UsersIcon className="h-5 w-5" />
                {t('bazaar.applyToCollaborate')}
              </button>
            ) : (
              <button
                type="button"
                onClick={onPledge}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold sm:col-span-1"
                style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
              >
                {t('bazaar.pledge')}
              </button>
            )}
          </div>
          {!canManage && idea.roles_needed?.length > 0 ? (
            <button
              type="button"
              onClick={() => void reportIdea()}
              disabled={reporting}
              className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
              style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
            >
              <FlagIcon className="h-5 w-5" />
              {reporting ? t('bazaar.reporting') : t('bazaar.reportIdea')}
            </button>
          ) : null}
          <p className="text-center text-xs mt-2" style={{ color: C.text2 }}>
            {idea.supporters} {t('bazaar.supporters')}
          </p>
        </div>
      </article>

      {canManage ? (
        <section
          className="mt-6 rounded-2xl p-5"
          style={{ background: C.white, border: `1px solid ${C.line}` }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold" style={{ color: C.text }}>
              {t('bazaar.applicantsTitle')}
            </h2>
            <span className="text-xs" style={{ color: C.text2 }}>
              {t('bazaar.applicantsTotal', { n: String(idea.collaboration_request_count ?? applicantsLocal.length) })}
            </span>
          </div>
          {applicantsLoading ? (
            <p className="text-sm" style={{ color: C.text2 }}>
              {t('bazaar.loadingApplicants')}
            </p>
          ) : applicantsLocal.length === 0 ? (
            <div className="rounded-xl p-4 text-sm" style={{ background: C.card2, color: C.text2 }}>
              {t('bazaar.noApplicants')}
            </div>
          ) : (
            <div className="space-y-3">
              {applicantsLocal.map((applicant) => (
                <div
                  key={applicant.id}
                  className="rounded-xl p-4"
                  style={{ background: C.card2, border: `1px solid ${C.line}` }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-full bg-center bg-cover shrink-0"
                      style={{
                        background: applicant.user.avatar
                          ? `url(${mediaUrl(applicant.user.avatar)}) center/cover`
                          : `linear-gradient(135deg, ${C.card}, ${C.white})`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm" style={{ color: C.text }}>
                          {displayName(applicant.user, t('bazaar.anonymousOwner'))}
                        </span>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: C.white, color: C.brownDk }}>
                          {applicant.role}
                        </span>
                        <span className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: C.fundedBg, color: C.fundedText }}>
                          {applicant.status}
                        </span>
                      </div>
                      {applicant.message ? (
                        <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: C.text2 }}>
                          {applicant.message}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs" style={{ color: C.text2 }}>
                        {formatDate(applicant.created_at, t('bazaar.justNow'))}
                      </p>
                      {canManage && applicant.status === 'pending' ? (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => void respondApplicant(applicant.id, 'accept')}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                            style={{ background: C.brownDk }}
                          >
                            {t('bazaar.accept')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void respondApplicant(applicant.id, 'reject')}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                            style={{ background: C.card2, color: C.text }}
                          >
                            {t('bazaar.reject')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section
        className="mt-6 rounded-2xl p-5"
        style={{ background: C.white, border: `1px solid ${C.line}` }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold" style={{ color: C.text }}>
            {t('bazaar.discussionTitle')}
          </h2>
          <span className="text-xs" style={{ color: C.text2 }}>
            {t('bazaar.commentsCount', { n: String(localComments.length) })}
          </span>
        </div>
        <div className="rounded-xl p-4 mb-4" style={{ background: C.card2 }}>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder={t('bazaar.commentPlaceholder')}
            className="w-full rounded-xl px-3 py-2.5 outline-none resize-none text-sm"
            style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
          />
          {commentError ? (
            <p className="mt-2 text-sm" style={{ color: '#c0392b' }}>
              {commentError}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => void submitComment()}
              disabled={commenting || !me}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: C.brownDk }}
            >
              {commenting ? t('bazaar.postingComment') : me ? t('bazaar.postComment') : t('bazaar.signInToComment')}
            </button>
          </div>
        </div>
        {commentsLoading ? (
          <p className="text-sm" style={{ color: C.text2 }}>
            {t('common.loading')}
          </p>
        ) : localComments.length === 0 ? (
          <div className="rounded-xl p-4 text-sm" style={{ background: C.card2, color: C.text2 }}>
            {t('bazaar.noCommentsYet')}
          </div>
        ) : (
          <div className="space-y-3">
            {localComments.map((item) => (
              <div
                key={item.id}
                className="rounded-xl p-4"
                style={{ background: C.card2, border: `1px solid ${C.line}` }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="h-10 w-10 rounded-full bg-center bg-cover shrink-0"
                    style={{
                      background: item.user.avatar
                        ? `url(${mediaUrl(item.user.avatar)}) center/cover`
                        : `linear-gradient(135deg, ${C.card}, ${C.white})`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm" style={{ color: C.text }}>
                        {displayName(item.user, t('bazaar.anonymousOwner'))}
                      </span>
                      <span className="text-xs" style={{ color: C.text2 }}>
                        {formatDate(item.created_at, t('bazaar.justNow'))}
                      </span>
                      {me?.id === item.user.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(item.id);
                              setEditCommentText(item.content);
                            }}
                            className="text-xs font-semibold"
                            style={{ color: C.brown }}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeComment(item.id)}
                            className="text-xs font-semibold"
                            style={{ color: '#c0392b' }}
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      ) : null}
                    </div>
                    {editingCommentId === item.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                          rows={3}
                          className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                          style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => void updateComment(item.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: C.brownDk }}>{t('common.save')}</button>
                          <button type="button" onClick={() => setEditingCommentId(null)} className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: C.white, color: C.text }}>{t('common.cancel')}</button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: C.text2 }}>
                        {item.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {applyOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
          style={{ background: C.overlay }}
          onClick={() => setApplyOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-6"
            style={{ background: C.cream, border: `1px solid ${C.line}` }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4" style={{ color: C.text }}>
              {t('bazaar.applyToCollaborate')}
            </h2>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>
              {t('bazaar.fieldRole')}
            </label>
            <select
              value={applyRole}
              onChange={(event) => setApplyRole(event.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 outline-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
            >
              {idea.roles_needed.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-sm font-medium" style={{ color: C.text2 }}>
              {t('bazaar.fieldMessage')}
            </label>
            <textarea
              value={applyMessage}
              onChange={(event) => setApplyMessage(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl px-3 py-2.5 outline-none resize-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
              placeholder={t('bazaar.applyMessagePlaceholder')}
            />
            {applyError ? (
              <p className="mt-3 text-sm" style={{ color: '#c0392b' }}>
                {applyError}
              </p>
            ) : null}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setApplyOpen(false)}
                className="flex-1 rounded-xl py-3 text-sm font-semibold"
                style={{ background: C.card2, color: C.text }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void submitApplication()}
                disabled={applying}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: C.brownDk }}
              >
                {applying ? t('bazaar.sendingApplication') : t('bazaar.sendApplication')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}