'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon,
  HeartIcon,
  PencilSquareIcon,
  TrashIcon,
  UsersIcon,
  FlagIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import { useTheme } from '@/components/ThemeProvider';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetchJson, mediaUrl } from '@/lib/api';
import {
  bazaarCategoryLabel,
  bazaarOwnerName,
  type BazaarCollaborationRequest,
  type BazaarIdea,
  type BazaarIdeaComment,
} from '@/lib/bazaarTypes';
import { getUser } from '@/lib/auth';

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
    progressBg: 'rgba(0,0,0,0.06)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    btnShadow: '0 6px 20px rgba(160,86,59,0.3)',
    overlay: 'rgba(61,43,34,0.45)',
    toastBg: '#2f8f6b',
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
    progressBg: 'rgba(255,255,255,0.08)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    btnShadow: '0 6px 20px rgba(106,0,255,0.25)',
    overlay: 'rgba(10,10,34,0.65)',
    toastBg: '#4ade80',
  },
};

type Props = {
  idea: BazaarIdea;
  voted: boolean;
  onVote: () => void;
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
};

function formatDate(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString();
}

function displayName(user: BazaarIdea['owner']) {
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username || 'Anonymous';
}

export default function IdeaDetailView({
  idea,
  voted,
  onVote,
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
}: Props) {
  const { theme } = useTheme();
  const { t, locale } = useLocale();
  const C = PALETTES[theme];
  const pct = idea.funding_goal
    ? Math.min(100, Math.round((idea.funding_raised / idea.funding_goal) * 100))
    : null;
  const ownerName = bazaarOwnerName(idea);
  const me = getUser();
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

  async function submitComment() {
    if (!comment.trim()) {
      setCommentError('Write a comment first.');
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
      onCommentCreated(data);
      setComment('');
    } catch {
      setCommentError('Could not post your comment.');
    } finally {
      setCommenting(false);
    }
  }

  async function submitApplication() {
    if (!applyRole.trim()) {
      setApplyError('Choose a role first.');
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
      setToast('Application sent to the idea owner.');
      setTimeout(() => setToast(''), 2500);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'Could not send application.');
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
          content: `${idea.title}\n\n${idea.description}`,
        },
      });
      if (!res.ok) throw new Error('failed');
      onReportSuccess();
      setToast('Idea reported successfully.');
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
          <h1 className="text-2xl font-bold mt-3" style={{ color: C.text }}>
            {idea.title}
          </h1>
          <p
            className="text-sm mt-3 leading-relaxed whitespace-pre-wrap"
            style={{ color: C.text2 }}
          >
            {idea.description}
          </p>
          {pct != null && (
            <div className="mt-4">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: C.progressBg }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: C.brown }} />
              </div>
              <p className="text-xs mt-1" style={{ color: C.text2 }}>
                ${idea.funding_raised.toLocaleString()} {t('bazaar.raised')} · $
                {idea.funding_goal?.toLocaleString()} {t('bazaar.goal')}
              </p>
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
            <div className="flex gap-2 mt-4">
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
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={onVote}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white"
              style={{
                background: `linear-gradient(90deg, ${C.brown}, ${C.brownDk})`,
                boxShadow: C.btnShadow,
              }}
            >
              {voted ? <HeartSolid className="h-5 w-5" /> : <HeartIcon className="h-5 w-5" />}
              {voted ? t('bazaar.supported') : t('bazaar.supportIdea')}
            </button>
            {idea.roles_needed?.length > 0 && !canManage ? (
              <button
                type="button"
                onClick={() => setApplyOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
              >
                <UsersIcon className="h-5 w-5" />
                Apply to Collaborate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void reportIdea()}
                disabled={reporting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold"
                style={{ background: C.card2, color: C.brownDk, border: `1px solid ${C.line}` }}
              >
                <FlagIcon className="h-5 w-5" />
                {reporting ? 'Reporting…' : 'Report idea'}
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
              {reporting ? 'Reporting…' : 'Report idea'}
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
              Collaboration applicants
            </h2>
            <span className="text-xs" style={{ color: C.text2 }}>
              {idea.collaboration_request_count ?? applicants.length} total
            </span>
          </div>
          {applicantsLoading ? (
            <p className="text-sm" style={{ color: C.text2 }}>
              Loading applicants…
            </p>
          ) : applicants.length === 0 ? (
            <div className="rounded-xl p-4 text-sm" style={{ background: C.card2, color: C.text2 }}>
              No collaboration requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {applicants.map((applicant) => (
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
                          {displayName(applicant.user)}
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
                        {formatDate(applicant.created_at)}
                      </p>
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
            Discussion
          </h2>
          <span className="text-xs" style={{ color: C.text2 }}>
            {comments.length} comments
          </span>
        </div>
        <div className="rounded-xl p-4 mb-4" style={{ background: C.card2 }}>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            placeholder="Share your thoughts about this idea…"
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
              {commenting ? 'Posting…' : me ? 'Post comment' : 'Sign in to comment'}
            </button>
          </div>
        </div>
        {commentsLoading ? (
          <p className="text-sm" style={{ color: C.text2 }}>
            Loading comments…
          </p>
        ) : comments.length === 0 ? (
          <div className="rounded-xl p-4 text-sm" style={{ background: C.card2, color: C.text2 }}>
            No comments yet. Start the discussion.
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((item) => (
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
                        {displayName(item.user)}
                      </span>
                      <span className="text-xs" style={{ color: C.text2 }}>
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: C.text2 }}>
                      {item.content}
                    </p>
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
              Apply to Collaborate
            </h2>
            <label className="text-sm font-medium" style={{ color: C.text2 }}>
              Role
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
              Message
            </label>
            <textarea
              value={applyMessage}
              onChange={(event) => setApplyMessage(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl px-3 py-2.5 outline-none resize-none"
              style={{ background: C.white, border: `1px solid ${C.line}`, color: C.text }}
              placeholder="Tell the owner why you’re a good fit."
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
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitApplication()}
                disabled={applying}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: C.brownDk }}
              >
                {applying ? 'Sending…' : 'Send application'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}