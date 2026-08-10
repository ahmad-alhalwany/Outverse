'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaceSmileIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MdGif } from 'react-icons/md';
import { FaRegStickyNote } from 'react-icons/fa';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { ReelCommentItem } from '@/lib/reelTypes';
import { reelAuthorName } from '@/lib/reelTypes';
import { useLocale } from '../LocaleProvider';
import CommentMediaPicker, { type PickerTab } from '../comments/CommentMediaPicker';
import ReelCommentRow from './ReelCommentRow';
import { useReelCommentsWebSocket } from '@/hooks/useReelCommentsWebSocket';

interface ReelCommentsSheetProps {
  reelId: number;
  reelOwnerId?: number;
  open: boolean;
  onClose: () => void;
  onCountChange?: (n: number) => void;
}

function mapComment(c: Record<string, unknown>): ReelCommentItem {
  const u = c.user as ReelCommentItem['user'];
  return {
    id: c.id as number,
    reel: c.reel as number,
    parent: (c.parent as number) || undefined,
    user: u,
    text: (c.text as string) || '',
    gif_url: (c.gif_url as string) || undefined,
    sticker_url: (c.sticker_url as string) || undefined,
    edited_at: (c.edited_at as string) || undefined,
    is_pinned: Boolean(c.is_pinned ?? c.pin_order),
    pin_order: (c.pin_order as number | null) ?? null,
    sparked_by_author: Boolean(c.sparked_by_author),
    is_post_author: Boolean(c.is_post_author),
    vote_score: (c.vote_score as number) ?? 0,
    my_vote: (c.my_vote as 'boost' | 'dim' | null) ?? null,
    quoted_comment: (c.quoted_comment as ReelCommentItem['quoted_comment']) || null,
    created_at: c.created_at as string,
    reaction_counts: (c.reaction_counts as Record<string, number>) || {},
    my_reaction: (c.my_reaction as string) || null,
    replies: Array.isArray(c.replies)
      ? (c.replies as Record<string, unknown>[]).map(mapComment)
      : [],
  };
}

export function countAllComments(list: ReelCommentItem[]): number {
  return list.reduce((n, c) => n + 1 + countAllComments(c.replies || []), 0);
}

export default function ReelCommentsSheet({
  reelId,
  reelOwnerId,
  open,
  onClose,
  onCountChange,
}: ReelCommentsSheetProps) {
  const { t } = useLocale();
  const [comments, setComments] = useState<ReelCommentItem[]>([]);
  const [commentSort, setCommentSort] = useState<'old' | 'new' | 'best' | 'controversial'>('old');
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const [text, setText] = useState('');
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<PickerTab | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReelCommentItem | null>(null);
  const [error, setError] = useState('');
  const attachEl = useRef<HTMLDivElement>(null);

  const load = useCallback(async (reset = true) => {
    try {
      const offset = reset ? 0 : offsetRef.current;
      const res = await apiFetch(
        `reel-comments/?reel=${reelId}&sort=${commentSort}&limit=30&offset=${offset}`,
      );
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : data.results || [];
        const list = rows.map(mapComment);
        setComments((prev) => {
          const merged = reset ? list : [...prev, ...list];
          onCountChange?.(countAllComments(merged));
          return merged;
        });
        offsetRef.current = offset + list.length;
        setHasMore(Array.isArray(data) ? false : !!data.has_more);
        setError('');
      } else {
        setError(t('reels.loadCommentsFailed'));
      }
    } catch {
      setError(t('reels.loadCommentsFailed'));
    }
  }, [reelId, commentSort, onCountChange, t]);

  useEffect(() => {
    if (open) load(true);
  }, [open, commentSort, load]);

  useReelCommentsWebSocket({
    reelId: open ? reelId : null,
    open,
    onUpdate: (payload) => {
      if (payload?.action === 'created' && payload.comment) {
        const created = mapComment(payload.comment);
        setComments((prev) => {
          if (prev.some((c) => c.id === created.id)) return prev;
          const optIdx = prev.findIndex(
            (c) =>
              c.id < 0 &&
              c.user.id === created.user.id &&
              c.text === created.text &&
              (c.gif_url || '') === (created.gif_url || '') &&
              (c.sticker_url || '') === (created.sticker_url || ''),
          );
          if (optIdx >= 0) {
            const next = [...prev];
            next[optIdx] = created;
            onCountChange?.(countAllComments(next));
            return next;
          }
          const merged = [...prev, created];
          onCountChange?.(countAllComments(merged));
          return merged;
        });
        return;
      }
      void load(true);
    },
  });

  const resetComposer = () => {
    setText('');
    setGifUrl(null);
    setStickerUrl(null);
    setReplyingTo(null);
    setPickerTab(null);
  };

  const submit = async () => {
    if (!getUser()) return;
    if (!text.trim() && !gifUrl && !stickerUrl) return;
    const me = getUser();
    const tempId = -Date.now();
    const optimistic = mapComment({
      id: tempId,
      reel: reelId,
      parent: replyingTo?.id ?? null,
      text: text.trim(),
      gif_url: gifUrl || '',
      sticker_url: stickerUrl || '',
      created_at: new Date().toISOString(),
      user: me
        ? {
            id: me.id,
            username: me.username,
            first_name: me.first_name,
            last_name: me.last_name,
            avatar: me.avatar,
          }
        : { id: 0, username: 'you' },
      replies: [],
    });
    setComments((prev) => {
      const merged = [...prev, optimistic];
      onCountChange?.(countAllComments(merged));
      return merged;
    });
    const payload = {
      reel: reelId,
      parent: replyingTo?.id ?? null,
      text: text.trim(),
      gif_url: gifUrl || '',
      sticker_url: stickerUrl || '',
    };
    resetComposer();
    setError('');
    try {
      const res = await apiFetchJson('reel-comments/', { method: 'POST', json: payload });
      if (res.ok) {
        const created = mapComment((await res.json()) as Record<string, unknown>);
        setComments((prev) => {
          const replaced = prev.map((c) => (c.id === tempId ? created : c));
          const seen = new Set<number>();
          const deduped = replaced.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
          });
          onCountChange?.(countAllComments(deduped));
          return deduped;
        });
      } else {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setError(t('reels.commentSendFailed'));
        await load(true);
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setError(t('reels.commentSendFailed'));
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="reel-comments-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="reel-comments-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            <div className="reel-comments-sheet__head">
              <h3>{t('reels.commentsTitle')}</h3>
              <button type="button" onClick={onClose} className="reels-chrome__btn" aria-label={t('common.close')}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {comments.length > 0 && (
              <div className="cosmic-comments__sortbar px-3">
                {(['best', 'new', 'old', 'controversial'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`cosmic-comments__sort${commentSort === key ? ' cosmic-comments__sort--active' : ''}`}
                    onClick={() => setCommentSort(key)}
                  >
                    {t(`feed.sort_${key}`)}
                  </button>
                ))}
              </div>
            )}

            <div className="reel-comments-sheet__list">
              {comments.length === 0 ? (
                <p className="reel-comments-sheet__empty">{t('reels.commentsEmpty')}</p>
              ) : (
                comments.map((c) => (
                  <ReelCommentRow
                    key={c.id}
                    reelId={reelId}
                    reelOwnerId={reelOwnerId}
                    comment={c}
                    onReply={(parent) => {
                      setReplyingTo(parent);
                      setPickerTab(null);
                    }}
                    onChanged={() => load(true)}
                  />
                ))
              )}
              {hasMore && (
                <button type="button" className="cosmic-comments__loadmore" onClick={() => load(false)}>
                  {t('feed.loadMoreComments')}
                </button>
              )}
            </div>

            <div className="reel-comments-sheet__composer" ref={attachEl}>
              {error && <p className="reel-comments-sheet__empty" style={{ color: '#f87171' }}>{error}</p>}
              {replyingTo && (
                <div className="reel-comments-sheet__replying">
                  <span>
                    {t('reels.replyingTo')} @{reelAuthorName(replyingTo.user)}
                  </span>
                  <button type="button" onClick={() => setReplyingTo(null)}>
                    {t('reels.cancelReply')}
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`cosmic-comments__tool${pickerTab === 'emoji' ? ' cosmic-comments__tool--active' : ''}`}
                  onClick={() => setPickerTab((tab) => (tab === 'emoji' ? null : 'emoji'))}
                  title={t('picker.emoji')}
                >
                  <FaceSmileIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className={`cosmic-comments__tool${pickerTab === 'gif' ? ' cosmic-comments__tool--active' : ''}`}
                  onClick={() => setPickerTab((tab) => (tab === 'gif' ? null : 'gif'))}
                  title={t('picker.gif')}
                >
                  <MdGif className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className={`cosmic-comments__tool${pickerTab === 'sticker' ? ' cosmic-comments__tool--active' : ''}`}
                  onClick={() => setPickerTab((tab) => (tab === 'sticker' ? null : 'sticker'))}
                  title={t('picker.sticker')}
                >
                  <FaRegStickyNote className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    replyingTo ? t('reels.replyPlaceholder') : t('reels.commentPlaceholder')
                  }
                  className="reels-create__input flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                />
                <button type="button" className="reels-create__submit !py-2 !px-4" onClick={submit}>
                  {t('reels.send')}
                </button>
              </div>
              <CommentMediaPicker
                tab={pickerTab}
                anchorRef={attachEl}
                onTabChange={setPickerTab}
                onEmoji={(n) => setText((x) => x + n)}
                onGif={(u) => setGifUrl(u)}
                onSticker={(u) => setStickerUrl(u)}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
