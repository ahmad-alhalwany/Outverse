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

interface ReelCommentsSheetProps {
  reelId: number;
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
  open,
  onClose,
  onCountChange,
}: ReelCommentsSheetProps) {
  const { t } = useLocale();
  const [comments, setComments] = useState<ReelCommentItem[]>([]);
  const [text, setText] = useState('');
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<PickerTab | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReelCommentItem | null>(null);
  const attachEl = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`reel-comments/?reel=${reelId}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(mapComment) : [];
        setComments(list);
        onCountChange?.(countAllComments(list));
      }
    } catch {
      /* ignore */
    }
  }, [reelId, onCountChange]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

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
    try {
      await apiFetchJson('reel-comments/', {
        method: 'POST',
        json: {
          reel: reelId,
          parent: replyingTo?.id ?? null,
          text: text.trim(),
          gif_url: gifUrl || '',
          sticker_url: stickerUrl || '',
        },
      });
      resetComposer();
      await load();
    } catch {
      /* ignore */
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
              <button type="button" onClick={onClose} className="reels-chrome__btn">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="reel-comments-sheet__list">
              {comments.length === 0 ? (
                <p className="reel-comments-sheet__empty">{t('reels.commentsEmpty')}</p>
              ) : (
                comments.map((c) => (
                  <ReelCommentRow
                    key={c.id}
                    reelId={reelId}
                    comment={c}
                    onReply={(parent) => {
                      setReplyingTo(parent);
                      setPickerTab(null);
                    }}
                    onChanged={load}
                  />
                ))
              )}
            </div>

            <div className="reel-comments-sheet__composer" ref={attachEl}>
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
