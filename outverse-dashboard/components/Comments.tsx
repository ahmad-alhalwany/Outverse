'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import useSound from './useSound';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import {
  FaceSmileIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import { FaEdit, FaTrash, FaThumbtack, FaSpinner } from 'react-icons/fa';
import { MdGif } from 'react-icons/md';
import PostReactions from './PostReactions';
import { formatRelativeTime } from '../utils/dateFormatter';
import { useLocale } from './LocaleProvider';
import { apiFetch } from '@/lib/api';

interface User {
  id: number;
  name: string;
}

interface CommentItem {
  id: number;
  user: { id: number; name: string; avatar: string };
  text: string;
  time: string;
  gifUrl?: string;
  stickerUrl?: string;
  reactionCounts?: Record<string, number>;
  myReaction?: string;
  replies?: CommentItem[];
}

interface CommentsProps {
  comments: CommentItem[];
  open: boolean;
  onAddComment: (data: { text: string; gifUrl?: string; stickerUrl?: string }) => void;
  onReply?: (parentId: number, data: { text: string; gifUrl?: string; stickerUrl?: string; time: string }) => void;
  onEditComment?: (commentId: number, newText: string) => void;
  onDeleteComment?: (commentId: number) => void;
  onCommentReaction?: (commentId: number, reactionEmoji: string) => void;
  user: User;
  postOwner: User;
  onCommentsCountUpdate?: (count: number) => void;
}

const gifs = [
  'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
];

const stickers = ['/stickers/sticker1.png', '/stickers/sticker2.png', '/stickers/sticker3.png'];

export default function Comments({
  comments,
  open,
  onAddComment,
  onReply,
  onEditComment,
  onDeleteComment,
  onCommentReaction,
  user,
  postOwner,
}: CommentsProps) {
  const { t } = useLocale();
  const [newComment, setNewComment] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [showGif, setShowGif] = useState(false);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const playComment = useSound('/sounds/comment.mp3', 0.4);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [addingComment, setAddingComment] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<{ id: number; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showMentionList || mentionQuery.length < 1) {
      setMentionUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `users/mentions/?q=${encodeURIComponent(mentionQuery)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setMentionUsers(
            Array.isArray(data)
              ? data.map((u: { id: number; name?: string; username?: string }) => ({
                  id: u.id,
                  name: u.name || u.username || 'User',
                }))
              : [],
          );
        }
      } catch {
        setMentionUsers([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [showMentionList, mentionQuery]);

  const sortedComments = [...comments];
  if (pinnedId) {
    const idx = sortedComments.findIndex((c) => c.id === pinnedId);
    if (idx > -1) {
      const [pinned] = sortedComments.splice(idx, 1);
      sortedComments.unshift(pinned);
    }
  }

  const handleReply = (parentId: number) => {
    if (replyText.trim() && onReply) {
      onReply(parentId, { text: replyText, time: formatRelativeTime(new Date()) });
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !gifUrl && !stickerUrl) return;
    setAddingComment(true);
    onAddComment({
      text: newComment,
      gifUrl: gifUrl || undefined,
      stickerUrl: stickerUrl || undefined,
    });
    playComment();
    setTimeout(() => {
      setAddingComment(false);
      setNewComment('');
      setGifUrl(null);
      setStickerUrl(null);
    }, 400);
  };

  const handleCommentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    const cursor = e.target.selectionStart || 0;
    const match = value.slice(0, cursor).match(/@([\w ]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentionList(true);
    } else {
      setShowMentionList(false);
      setMentionQuery('');
    }
  };

  const handleMentionSelect = (name: string) => {
    const cursor = inputRef.current?.selectionStart || 0;
    const before = newComment.slice(0, cursor).replace(/@([\w ]*)$/, `@${name} `);
    setNewComment(before + newComment.slice(cursor));
    setShowMentionList(false);
    inputRef.current?.focus();
  };

  const renderComment = (comment: CommentItem, isReply = false) => (
    <div
      key={comment.id}
      className={`cosmic-comment${pinnedId === comment.id ? ' cosmic-comment--pinned' : ''}${isReply ? ' mt-2' : ''}`}
    >
      <img src={comment.user.avatar} alt="" className="cosmic-comment__avatar" style={{ width: isReply ? '1.75rem' : undefined, height: isReply ? '1.75rem' : undefined }} />
      <div className="flex-1 min-w-0">
        <div className="cosmic-comment__bubble">
          <div className="flex items-start justify-between gap-2">
            <span className="cosmic-comment__name">{comment.user.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              {user.id === postOwner.id && postOwner.id > 0 && (
                <button type="button" onClick={() => setPinnedId(pinnedId === comment.id ? null : comment.id)} className="cosmic-comments__tool !w-7 !h-7" title="Pin">
                  <FaThumbtack className={pinnedId === comment.id ? 'text-amber-400' : ''} size={12} />
                </button>
              )}
              {user.id === comment.user.id && (
                <button type="button" onClick={() => { setEditingId(comment.id); setEditText(comment.text); }} className="cosmic-comments__tool !w-7 !h-7" title="Edit">
                  <FaEdit size={12} />
                </button>
              )}
              {(user.id === comment.user.id || user.id === postOwner.id) && (
                <button type="button" onClick={() => setShowConfirmDelete(comment.id)} className="cosmic-comments__tool !w-7 !h-7 text-red-400" title="Delete">
                  <FaTrash size={12} />
                </button>
              )}
            </div>
          </div>

          {editingId === comment.id ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="cosmic-comments__input !rounded-lg flex-1"
                disabled={editingLoading}
              />
              <button type="button" className="cosmic-comments__send !py-2" onClick={() => {
                if (onEditComment && editText.trim()) {
                  setEditingLoading(true);
                  onEditComment(comment.id, editText);
                  setTimeout(() => { setEditingLoading(false); setEditingId(null); }, 400);
                }
              }} disabled={editingLoading}>
                {editingLoading ? <FaSpinner className="animate-spin" /> : 'Save'}
              </button>
            </div>
          ) : (
            <p className="cosmic-comment__text">
              {comment.text.split(/(@[\w ]+)/g).map((part, i) =>
                part.startsWith('@') ? <span key={i} className="text-lab font-semibold">{part}</span> : part,
              )}
            </p>
          )}

          {comment.gifUrl && <img src={comment.gifUrl} alt="" className="w-20 h-20 rounded-lg mt-2" />}
          {comment.stickerUrl && <img src={comment.stickerUrl} alt="" className="w-12 h-12 mt-2" />}

          {showConfirmDelete === comment.id && (
            <div className="mt-2 p-2 rounded-lg bg-surface/50 text-xs">
              Delete this comment?
              <div className="flex gap-2 mt-2">
                <button type="button" className="cosmic-comments__send !py-1 !px-3 !bg-red-600" onClick={() => {
                  if (onDeleteComment) {
                    setDeletingLoading(comment.id);
                    onDeleteComment(comment.id);
                    setTimeout(() => { setDeletingLoading(null); setShowConfirmDelete(null); }, 400);
                  }
                }} disabled={deletingLoading === comment.id}>Delete</button>
                <button type="button" className="text-text-secondary" onClick={() => setShowConfirmDelete(null)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="cosmic-comment__meta">
            <PostReactions
              compact
              onReaction={(r) => onCommentReaction?.(comment.id, r)}
              selectedReaction={comment.myReaction}
              reactionCounts={comment.reactionCounts}
            />
            {!isReply && onReply && (
              <button type="button" className="text-xs font-semibold text-text-secondary hover:text-lab transition" onClick={() => setReplyingTo(comment.id)}>
                {t('feed.reply')}
              </button>
            )}
          </div>

          {replyingTo === comment.id && (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); handleReply(comment.id); }}>
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply in the thread…"
                className="cosmic-comments__input flex-1"
                autoFocus
              />
              <button type="submit" className="cosmic-comments__send">↵</button>
              <button type="button" className="text-xs text-text-secondary px-2" onClick={() => { setReplyingTo(null); setReplyText(''); }}>✕</button>
            </form>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="cosmic-comment__replies">
              {comment.replies.map((r) => renderComment(r, true))}
            </div>
          )}
        </div>
        <div className="cosmic-comment__time">{comment.time}</div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="cosmic-comments overflow-hidden"
        >
          <div className="cosmic-comments__panel">
            <form onSubmit={handleSubmit} className="relative">
              <div className="cosmic-comments__composer">
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={handleCommentInput}
                  placeholder={t('feed.commentPlaceholder')}
                  className="cosmic-comments__input"
                />
                <button type="submit" className="cosmic-comments__send" disabled={addingComment || (!newComment.trim() && !gifUrl && !stickerUrl)}>
                  {addingComment ? <FaSpinner className="animate-spin h-4 w-4" /> : <PaperAirplaneIcon className="h-4 w-4" />}
                </button>
              </div>
              <div className="cosmic-comments__toolbar">
                <button type="button" className="cosmic-comments__tool" onClick={() => setShowEmoji(!showEmoji)} title="Emoji">
                  <FaceSmileIcon className="h-5 w-5" />
                </button>
                <button type="button" className="cosmic-comments__tool" onClick={() => setShowGif(!showGif)} title="GIF">
                  <MdGif className="h-5 w-5" />
                </button>
                <button type="button" className="cosmic-comments__tool" onClick={() => setShowStickers(!showStickers)} title="Sticker">🌟</button>
              </div>
              {showEmoji && (
                <div className="absolute z-50 bottom-full left-0 mb-2">
                  <Picker data={data} onEmojiSelect={(e: { native: string }) => { setNewComment((c) => c + e.native); setShowEmoji(false); }} theme="auto" />
                </div>
              )}
              {showGif && (
                <div className="absolute z-50 top-full left-0 mt-1 flex gap-2 p-2 rounded-xl bg-background border border-surface shadow-lg">
                  {gifs.map((url) => (
                    <img key={url} src={url} alt="" className="w-14 h-14 rounded-lg cursor-pointer" onClick={() => { setGifUrl(url); setShowGif(false); }} />
                  ))}
                </div>
              )}
              {showStickers && (
                <div className="absolute z-50 top-full left-16 mt-1 flex gap-2 p-2 rounded-xl bg-background border border-surface shadow-lg">
                  {stickers.map((url) => (
                    <img key={url} src={url} alt="" className="w-10 h-10 cursor-pointer" onClick={() => { setStickerUrl(url); setShowStickers(false); }} />
                  ))}
                </div>
              )}
              {(gifUrl || stickerUrl) && (
                <div className="flex gap-2 mt-2 px-1">
                  {gifUrl && <img src={gifUrl} alt="" className="w-16 h-16 rounded-lg" />}
                  {stickerUrl && <img src={stickerUrl} alt="" className="w-10 h-10" />}
                </div>
              )}
              {showMentionList && (
                <div className="absolute z-50 top-full left-0 mt-1 w-48 rounded-lg bg-background border border-surface shadow-lg p-1">
                  {mentionUsers.map((u) => (
                    <button key={u.id} type="button" className="w-full text-left px-2 py-1.5 text-sm hover:bg-lab/10 rounded" onClick={() => handleMentionSelect(u.name)}>
                      @{u.name}
                    </button>
                  ))}
                  {mentionUsers.length === 0 && mentionQuery.length > 0 && (
                    <div className="px-2 py-1 text-text-secondary text-sm">No users found</div>
                  )}
                </div>
              )}
            </form>

            {sortedComments.length === 0 ? (
              <p className="cosmic-comments__empty">{t('feed.commentsEmpty')}</p>
            ) : (
              <div className="mt-3">{sortedComments.map((c) => renderComment(c))}</div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
