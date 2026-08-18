'use client';

import { useState } from 'react';
import { FlagIcon, MapPinIcon, PencilSquareIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { MapPinIcon as MapPinSolid } from '@heroicons/react/24/solid';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import {
  countsToEmojiMap,
  EMOJI_BY_REACTION_TYPE,
  REACTION_TYPE_BY_EMOJI,
  type ReactionType,
} from '@/lib/reactions';
import type { ReelCommentItem } from '@/lib/reelTypes';
import PostReactions from '../PostReactions';
import { reelAuthorName } from '@/lib/reelTypes';
import RelativeTime from '@/components/RelativeTime';
import MentionText from '@/components/MentionText';
import { useLocale } from '../LocaleProvider';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import ReportDialog, { type ReportReason } from '@/components/ReportDialog';

function CommentBody({ c }: { c: ReelCommentItem }) {
  return (
    <>
      {c.text && <MentionText text={c.text} className="reel-comments-sheet__text" />}
      {c.gif_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(c.gif_url) || c.gif_url}
          alt=""
          className="reel-comments-sheet__media reel-comments-sheet__media--gif"
        />
      )}
      {c.sticker_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(c.sticker_url) || c.sticker_url}
          alt=""
          className="reel-comments-sheet__media reel-comments-sheet__media--sticker"
        />
      )}
    </>
  );
}

export interface ReelCommentRowProps {
  reelId: number;
  reelOwnerId?: number;
  comment: ReelCommentItem;
  isReply?: boolean;
  onReply?: (c: ReelCommentItem) => void;
  onChanged: () => void;
}

export default function ReelCommentRow({
  reelId,
  reelOwnerId,
  comment,
  isReply = false,
  onReply,
  onChanged,
}: ReelCommentRowProps) {
  const { t } = useLocale();
  const me = useAuthUser();
  const confirm = useConfirm();
  const isOwner = me?.id === comment.user.id;
  const canPin = !isReply && !!me && me.id === reelOwnerId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  const flashError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError((cur) => (cur === msg ? '' : cur)), 3000);
  };

  const saveEdit = async () => {
    if (!editText.trim() && !comment.gif_url && !comment.sticker_url) return;
    setBusy(true);
    try {
      const res = await apiFetchJson(`reel-comments/${comment.id}/`, {
        method: 'PATCH',
        json: { text: editText.trim() },
      });
      if (res.ok) {
        setEditing(false);
        onChanged();
      } else {
        flashError(t('reels.actionFailed'));
      }
    } catch {
      flashError(t('reels.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async (reason: ReportReason, details: string) => {
    if (!me) return false;
    const snippet = (comment.text || '').slice(0, 200);
    try {
      const res = await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'reel_comment',
          object_id: comment.id,
          content: `reel:${reelId} comment:${comment.id} @${comment.user.username}: ${snippet}`,
          reason,
          details,
          reporter: me.username,
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const react = async (emoji: string) => {
    const type = REACTION_TYPE_BY_EMOJI[emoji];
    if (!type || !me) return;
    setBusy(true);
    try {
      const res = await apiFetchJson(`reel-comments/${comment.id}/react/`, {
        method: 'POST',
        json: { reaction: type },
      });
      if (res.ok) onChanged();
      else flashError(t('reels.actionFailed'));
    } catch {
      flashError(t('reels.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm(t('reels.confirmDelete'), { danger: true, confirmLabel: t('common.delete') }))) return;
    setBusy(true);
    try {
      const res = await apiFetch(`reel-comments/${comment.id}/`, { method: 'DELETE' });
      if (res.ok) onChanged();
      else flashError(t('reels.actionFailed'));
    } catch {
      flashError(t('reels.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const togglePin = async () => {
    setBusy(true);
    try {
      const res = await apiFetchJson(`reel-comments/${comment.id}/pin/`, { method: 'POST' });
      if (res.ok) onChanged();
      else flashError(t('reels.actionFailed'));
    } catch {
      flashError(t('reels.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const toggleSpark = async () => {
    setBusy(true);
    try {
      const res = await apiFetchJson(`reel-comments/${comment.id}/spark/`, { method: 'POST' });
      if (res.ok) onChanged();
      else flashError(t('reels.actionFailed'));
    } catch {
      flashError(t('reels.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  const vote = async (direction: 'boost' | 'dim') => {
    if (!me) return;
    setBusy(true);
    try {
      const next = comment.my_vote === direction ? null : direction;
      const res = await apiFetchJson(`reel-comments/${comment.id}/vote/`, {
        method: 'POST',
        json: { vote: next },
      });
      if (res.ok) onChanged();
      else flashError(t('reels.actionFailed'));
    } catch {
      flashError(t('reels.actionFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`reel-comments-sheet__item flex items-start gap-2${isReply ? ' reel-comments-sheet__item--reply' : ''}${comment.sparked_by_author ? ' reel-comments-sheet__item--sparked' : ''}`}
    >
      {me && (
        <div className="cosmic-comment__votes">
          <button type="button" className={`cosmic-comment__vote${comment.my_vote === 'boost' ? ' cosmic-comment__vote--active' : ''}`} onClick={() => vote('boost')} disabled={busy}>
            <ChevronUpIcon className="h-4 w-4" />
          </button>
          <span className={`cosmic-comment__score${(comment.vote_score ?? 0) > 0 ? ' cosmic-comment__score--up' : (comment.vote_score ?? 0) < 0 ? ' cosmic-comment__score--down' : ''}`}>
            {comment.vote_score ?? 0}
          </span>
          <button type="button" className={`cosmic-comment__vote${comment.my_vote === 'dim' ? ' cosmic-comment__vote--active-dim' : ''}`} onClick={() => vote('dim')} disabled={busy}>
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex-1 min-w-0">
      <div className="reel-comments-sheet__item-head">
        <span className="reel-comments-sheet__item-head-left">
          <strong>@{reelAuthorName(comment.user)}</strong>
          {comment.is_pinned && (
            <span className="reel-comments-sheet__pinned-badge">
              <MapPinSolid className="h-3 w-3" /> {comment.pin_order ? `#${comment.pin_order}` : t('reels.pinned')}
            </span>
          )}
          {comment.sparked_by_author && (
            <span className="reel-comments-sheet__pinned-badge text-cyan-400">
              <SparklesIcon className="h-3 w-3" /> {t('comments.sparked')}
            </span>
          )}
        </span>
        <span className="reel-comments-sheet__time">
          <RelativeTime date={comment.created_at} className="reel-comment__time block" />
        </span>
      </div>

      {editing ? (
        <div className="reel-comments-sheet__edit">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="reels-create__input"
            disabled={busy}
          />
          <div className="reel-comments-sheet__edit-actions">
            <button type="button" className="reel-comments-sheet__reply-btn" onClick={saveEdit} disabled={busy}>
              {t('reels.saveEdit')}
            </button>
            <button
              type="button"
              className="reel-comments-sheet__reply-btn opacity-60"
              onClick={() => {
                setEditing(false);
                setEditText(comment.text);
              }}
            >
              {t('reels.cancelReply')}
            </button>
          </div>
        </div>
      ) : (
        <CommentBody c={comment} />
      )}

      <div className="reel-comments-sheet__meta">
        {!editing && (
          <PostReactions
            compact
            onReaction={react}
            selectedReaction={
              comment.my_reaction
                ? EMOJI_BY_REACTION_TYPE[comment.my_reaction as ReactionType]
                : undefined
            }
            reactionCounts={countsToEmojiMap(comment.reaction_counts)}
          />
        )}
      </div>

      {actionError && (
        <p className="reel-comments-sheet__time" style={{ color: '#f87171' }}>{actionError}</p>
      )}

      <div className="reel-comments-sheet__actions">
        {onReply && !editing && (
          <button type="button" className="reel-comments-sheet__reply-btn" onClick={() => onReply(comment)}>
            {t('reels.reply')}
          </button>
        )}
        {canPin && !editing && (
          <button
            type="button"
            className="reel-comments-sheet__action-icon"
            onClick={togglePin}
            title={comment.is_pinned ? t('reels.unpinComment') : t('reels.pinComment')}
            disabled={busy}
          >
            {comment.is_pinned ? (
              <MapPinSolid className="h-4 w-4" />
            ) : (
              <MapPinIcon className="h-4 w-4" />
            )}
          </button>
        )}
        {canPin && !editing && (
          <button
            type="button"
            className="reel-comments-sheet__action-icon"
            onClick={toggleSpark}
            title={comment.sparked_by_author ? t('comments.unspark') : t('comments.spark')}
            disabled={busy}
          >
            <SparklesIcon className={`h-4 w-4${comment.sparked_by_author ? ' text-cyan-400' : ''}`} />
          </button>
        )}
        {isOwner && !editing && (
          <>
            <button
              type="button"
              className="reel-comments-sheet__action-icon"
              onClick={() => setEditing(true)}
              title={t('reels.editComment')}
              disabled={busy}
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="reel-comments-sheet__action-icon reel-comments-sheet__action-icon--danger"
              onClick={remove}
              title={t('reels.deleteComment')}
              disabled={busy}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </>
        )}
        {!isOwner && !editing && (
          <button
            type="button"
            className="reel-comments-sheet__action-icon"
            onClick={() => setReportOpen(true)}
            title={t('reels.reportComment')}
            disabled={busy}
          >
            <FlagIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="reel-comments-sheet__replies">
          {comment.replies.map((r) => (
            <ReelCommentRow
              key={r.id}
              reelId={reelId}
              reelOwnerId={reelOwnerId}
              comment={r}
              isReply
              onReply={onReply}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
      </div>
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t('social.reportWhyComment')}
        onSubmit={submitReport}
      />
    </div>
  );
}
