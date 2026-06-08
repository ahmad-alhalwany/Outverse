'use client';

import { useState } from 'react';
import { FlagIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  countsToEmojiMap,
  EMOJI_BY_REACTION_TYPE,
  REACTION_TYPE_BY_EMOJI,
  type ReactionType,
} from '@/lib/reactions';
import type { ReelCommentItem } from '@/lib/reelTypes';
import PostReactions from '../PostReactions';
import { reelAuthorName } from '@/lib/reelTypes';
import { formatRelativeTime } from '@/utils/dateFormatter';
import { useLocale } from '../LocaleProvider';

function CommentBody({ c }: { c: ReelCommentItem }) {
  return (
    <>
      {c.text && <p className="reel-comments-sheet__text">{c.text}</p>}
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
  comment: ReelCommentItem;
  isReply?: boolean;
  onReply?: (c: ReelCommentItem) => void;
  onChanged: () => void;
}

export default function ReelCommentRow({
  reelId,
  comment,
  isReply = false,
  onReply,
  onChanged,
}: ReelCommentRowProps) {
  const { t } = useLocale();
  const me = getUser();
  const isOwner = me?.id === comment.user.id;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [busy, setBusy] = useState(false);

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
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    if (!me) return;
    if (!window.confirm(t('reels.confirmReport'))) return;
    setBusy(true);
    try {
      const snippet = (comment.text || '').slice(0, 200);
      await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'reel_comment',
          content: `reel:${reelId} comment:${comment.id} @${comment.user.username}: ${snippet}`,
          reporter: me.username,
        },
      });
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
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
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t('reels.confirmDelete'))) return;
    setBusy(true);
    try {
      const res = await apiFetch(`reel-comments/${comment.id}/`, { method: 'DELETE' });
      if (res.ok) onChanged();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`reel-comments-sheet__item${isReply ? ' reel-comments-sheet__item--reply' : ''}`}
    >
      <div className="reel-comments-sheet__item-head">
        <strong>@{reelAuthorName(comment.user)}</strong>
        <span className="reel-comments-sheet__time">
          {formatRelativeTime(new Date(comment.created_at))}
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

      <div className="reel-comments-sheet__actions">
        {!isReply && onReply && !editing && (
          <button type="button" className="reel-comments-sheet__reply-btn" onClick={() => onReply(comment)}>
            {t('reels.reply')}
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
            onClick={report}
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
              comment={r}
              isReply
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
