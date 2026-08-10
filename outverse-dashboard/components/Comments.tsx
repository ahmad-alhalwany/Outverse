'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import useSound from './useSound';
import {
  FaceSmileIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  FlagIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  LanguageIcon,
  PencilSquareIcon,
  TrashIcon,
  MapPinIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import CommentMediaPicker, { type PickerTab } from './comments/CommentMediaPicker';
import PostReactions from './PostReactions';
import RelativeTime from './RelativeTime';
import { useLocale } from './LocaleProvider';
import Link from 'next/link';
import { apiFetch, mediaUrl } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';
import { publicDisplayName } from '@/lib/publicDisplayName';

interface User {
  id: number;
  name: string;
  avatar?: string;
}

interface CommentItem {
  id: number;
  user: { id: number; name: string; avatar: string };
  text: string;
  time: string;
  editedAt?: string;
  gifUrl?: string;
  stickerUrl?: string;
  reactionCounts?: Record<string, number>;
  myReaction?: string;
  isPinned?: boolean;
  pinOrder?: number | null;
  sparkedByAuthor?: boolean;
  isPostAuthor?: boolean;
  resonanceTotal?: number;
  voteScore?: number;
  boostCount?: number;
  dimCount?: number;
  myVote?: 'boost' | 'dim' | null;
  quotedComment?: { id: number; text: string; user: { id: number; name: string } } | null;
  replies?: CommentItem[];
}

interface CommentsProps {
  comments: CommentItem[];
  open: boolean;
  onAddComment: (data: { text: string; gifUrl?: string; stickerUrl?: string }) => Promise<void> | void;
  onReply?: (
    parentId: number,
    data: { text: string; gifUrl?: string; stickerUrl?: string; time: string; quotedCommentId?: number },
  ) => Promise<void> | void;
  onEditComment?: (commentId: number, newText: string) => Promise<void> | void;
  onDeleteComment?: (commentId: number) => Promise<void> | void;
  onReportComment?: (commentId: number, snippet: string) => void;
  onCommentReaction?: (commentId: number, reactionEmoji: string) => void;
  onPinComment?: (commentId: number) => Promise<void> | void;
  onSparkComment?: (commentId: number) => Promise<void> | void;
  onVoteComment?: (commentId: number, vote: 'boost' | 'dim' | null) => Promise<void> | void;
  onTranslateComment?: (commentId: number, lang: string) => Promise<{ text: string } | null>;
  user: User;
  postOwner: User;
  onCommentsCountUpdate?: (count: number) => void;
  sort?: 'old' | 'new' | 'best' | 'controversial';
  onSortChange?: (sort: 'old' | 'new' | 'best' | 'controversial') => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
  replyLocked?: boolean;
}

const MAX_NEST_DEPTH = 6;

export default function Comments({
  comments,
  open,
  onAddComment,
  onReply,
  onEditComment,
  onDeleteComment,
  onReportComment,
  onCommentReaction,
  onPinComment,
  onSparkComment,
  onVoteComment,
  onTranslateComment,
  user,
  postOwner,
  sort = 'old',
  onSortChange,
  hasMore = false,
  onLoadMore,
  replyLocked = false,
}: CommentsProps) {
  const { t, locale } = useLocale();
  const [newComment, setNewComment] = useState('');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggleCollapse = (cid: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  const [pickerTab, setPickerTab] = useState<PickerTab | null>(null);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const playComment = useSound('/sounds/comment.mp3', 0.4);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);
  const [pinBusy, setPinBusy] = useState<number | null>(null);
  const [sparkBusy, setSparkBusy] = useState<number | null>(null);
  const [quoteReply, setQuoteReply] = useState<{ id: number; text: string; userName: string } | null>(null);
  const [voteBusy, setVoteBusy] = useState<number | null>(null);
  const [translations, setTranslations] = useState<Record<number, { text: string; visible: boolean }>>({});
  const [translatingId, setTranslatingId] = useState<number | null>(null);
  const [addingComment, setAddingComment] = useState(false);
  const addingCommentRef = useRef(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<{ id: number; name: string }[]>([]);
  const [canComment, setCanComment] = useState<boolean | null>(null);
  const mentionAbortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanComment(isAuthenticated());
  }, []);

  useEffect(() => {
    if (!showMentionList || mentionQuery.length < 1) {
      mentionAbortRef.current?.abort();
      setMentionUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      mentionAbortRef.current?.abort();
      const controller = new AbortController();
      mentionAbortRef.current = controller;
      try {
        const res = await apiFetch(
          `users/mentions/?q=${encodeURIComponent(mentionQuery)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = await res.json();
          setMentionUsers(
            Array.isArray(data)
              ? data.map((u: { id: number; name?: string; username?: string; first_name?: string; last_name?: string }) => ({
                  id: u.id,
                  name: publicDisplayName(u, u.name || 'User'),
                }))
              : [],
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        setMentionUsers([]);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      mentionAbortRef.current?.abort();
    };
  }, [showMentionList, mentionQuery]);

  const collectReplyIds = (items: CommentItem[]): number[] => {
    const ids: number[] = [];
    for (const c of items) {
      if (c.replies?.length) {
        ids.push(c.id);
        ids.push(...collectReplyIds(c.replies));
      }
    }
    return ids;
  };

  const collapseAll = () => setCollapsed(new Set(collectReplyIds(comments)));
  const expandAll = () => setCollapsed(new Set());

  const startReply = (comment: CommentItem, withQuote = false) => {
    setReplyingTo(comment.id);
    setReplyText('');
    if (withQuote) {
      setQuoteReply({
        id: comment.id,
        text: (comment.text || '').slice(0, 120),
        userName: comment.user.name,
      });
    } else {
      setQuoteReply(null);
    }
  };

  const clearReplyState = () => {
    setReplyingTo(null);
    setReplyText('');
    setQuoteReply(null);
  };

  const handleReply = async (parentId: number) => {
    if (onReply && (replyText.trim() || gifUrl || stickerUrl)) {
      await onReply(parentId, {
        text: replyText,
        gifUrl: gifUrl || undefined,
        stickerUrl: stickerUrl || undefined,
        time: new Date().toISOString(),
        quotedCommentId: quoteReply?.id,
      });
      clearReplyState();
      setGifUrl(null);
      setStickerUrl(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!newComment.trim() && !gifUrl && !stickerUrl) return;
    if (addingCommentRef.current) return;
    addingCommentRef.current = true;
    setAddingComment(true);
    try {
      await onAddComment({
        text: newComment,
        gifUrl: gifUrl || undefined,
        stickerUrl: stickerUrl || undefined,
      });
      playComment();
      setNewComment('');
      setGifUrl(null);
      setStickerUrl(null);
    } finally {
      addingCommentRef.current = false;
      setAddingComment(false);
    }
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

  const handleVote = async (comment: CommentItem, direction: 'boost' | 'dim') => {
    if (!onVoteComment || user.id <= 0) return;
    const nextVote = comment.myVote === direction ? null : direction;
    setVoteBusy(comment.id);
    try {
      await onVoteComment(comment.id, nextVote);
    } finally {
      setVoteBusy(null);
    }
  };

  const handleTranslate = async (comment: CommentItem) => {
    if (!onTranslateComment || !comment.text?.trim()) return;
    const existing = translations[comment.id];
    if (existing?.visible) {
      setTranslations((prev) => ({
        ...prev,
        [comment.id]: { ...existing, visible: false },
      }));
      return;
    }
    if (existing?.text) {
      setTranslations((prev) => ({
        ...prev,
        [comment.id]: { ...existing, visible: true },
      }));
      return;
    }
    setTranslatingId(comment.id);
    try {
      const result = await onTranslateComment(comment.id, locale);
      if (result?.text) {
        setTranslations((prev) => ({
          ...prev,
          [comment.id]: { text: result.text, visible: true },
        }));
      }
    } finally {
      setTranslatingId(null);
    }
  };

  const renderComment = (comment: CommentItem, depth = 0) => {
    const isReply = depth > 0;
    const replyCount = comment.replies?.length ?? 0;
    const isCollapsed = collapsed.has(comment.id);
    const childDepth = Math.min(depth + 1, MAX_NEST_DEPTH);
    const voteScore = comment.voteScore ?? 0;
    const isResonant = (comment.resonanceTotal ?? 0) >= 5 || voteScore >= 4;
    const isHost = !!comment.isPostAuthor;
    const canHostModerate = user.id === postOwner.id && postOwner.id > 0;
    const bubbleClasses = [
      'cosmic-comment',
      comment.isPinned ? 'cosmic-comment--pinned' : '',
      comment.sparkedByAuthor ? 'cosmic-comment--sparked' : '',
      isResonant ? 'cosmic-comment--resonant' : '',
      isReply ? 'mt-2' : '',
    ].filter(Boolean).join(' ');
    return (
    <div key={comment.id} className={bubbleClasses}>
      {onVoteComment && user.id > 0 && (
        <div className="cosmic-comment__votes">
          <button
            type="button"
            className={`cosmic-comment__vote${comment.myVote === 'boost' ? ' cosmic-comment__vote--active' : ''}`}
            title={t('comments.boost')}
            disabled={voteBusy === comment.id}
            onClick={() => handleVote(comment, 'boost')}
          >
            {voteBusy === comment.id ? (
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <ChevronUpIcon className="h-5 w-5" strokeWidth={1.75} />
            )}
          </button>
          <span className={`cosmic-comment__score${voteScore > 0 ? ' cosmic-comment__score--up' : voteScore < 0 ? ' cosmic-comment__score--down' : ''}`}>
            {voteScore}
          </span>
          <button
            type="button"
            className={`cosmic-comment__vote${comment.myVote === 'dim' ? ' cosmic-comment__vote--active-dim' : ''}`}
            title={t('comments.dim')}
            disabled={voteBusy === comment.id}
            onClick={() => handleVote(comment, 'dim')}
          >
            <ChevronDownIcon className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      )}
      <Image src={comment.user.avatar} alt={`${comment.user.name} avatar`} width={isReply ? 28 : 40} height={isReply ? 28 : 40} className="cosmic-comment__avatar" style={{ width: isReply ? '1.75rem' : undefined, height: isReply ? '1.75rem' : undefined }} unoptimized />
      <div className="flex-1 min-w-0">
        <div className="cosmic-comment__bubble">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="cosmic-comment__name">{comment.user.name}</span>
              {isHost && (
                <span className="cosmic-comment__badge cosmic-comment__badge--host">{t('comments.hostBadge')}</span>
              )}
              {comment.isPinned && (
                <span className="cosmic-comment__badge cosmic-comment__badge--pin">
                  {comment.pinOrder
                    ? t('comments.pinnedSlot').replace('{order}', String(comment.pinOrder))
                    : t('comments.pinned')}
                </span>
              )}
              {comment.sparkedByAuthor && (
                <span className="cosmic-comment__badge cosmic-comment__badge--spark">{t('comments.sparked')}</span>
              )}
              {isResonant && (
                <span className="cosmic-comment__badge cosmic-comment__badge--resonance">{t('comments.resonance')}</span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canHostModerate && depth === 0 && onPinComment && (
                <button
                  type="button"
                  onClick={async () => {
                    setPinBusy(comment.id);
                    try {
                      await onPinComment(comment.id);
                    } finally {
                      setPinBusy(null);
                    }
                  }}
                  className="cosmic-comments__tool !w-7 !h-7"
                  title={comment.isPinned ? t('comments.unpin') : t('comments.pin')}
                  disabled={pinBusy === comment.id}
                >
                  {pinBusy === comment.id ? (
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <MapPinIcon className={`h-3.5 w-3.5${comment.isPinned ? ' text-amber-400' : ''}`} strokeWidth={2} />
                  )}
                </button>
              )}
              {canHostModerate && onSparkComment && (
                <button
                  type="button"
                  onClick={async () => {
                    setSparkBusy(comment.id);
                    try {
                      await onSparkComment(comment.id);
                    } finally {
                      setSparkBusy(null);
                    }
                  }}
                  className="cosmic-comments__tool !w-7 !h-7"
                  title={comment.sparkedByAuthor ? t('comments.unspark') : t('comments.spark')}
                  disabled={sparkBusy === comment.id}
                >
                  {sparkBusy === comment.id ? (
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  ) : (
                    <SparklesIcon className={`h-4 w-4${comment.sparkedByAuthor ? ' text-cyan-400' : ''}`} strokeWidth={1.75} />
                  )}
                </button>
              )}
              {user.id === comment.user.id && (
                <button type="button" onClick={() => { setEditingId(comment.id); setEditText(comment.text); }} className="cosmic-comments__tool !w-7 !h-7" title={t('comments.save')}>
                  <PencilSquareIcon className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
              {(user.id === comment.user.id || user.id === postOwner.id) && (
                <button type="button" onClick={() => setShowConfirmDelete(comment.id)} className="cosmic-comments__tool !w-7 !h-7 text-red-400" title={t('comments.delete')}>
                  <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              )}
              {user.id !== comment.user.id && onReportComment && (
                <button
                  type="button"
                  onClick={() => onReportComment(comment.id, comment.text || '')}
                  className="cosmic-comments__tool !w-7 !h-7"
                  title={t('comments.report')}
                >
                  <FlagIcon className="h-5 w-5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>

          {comment.quotedComment && (
            <div className="cosmic-comment__echo-quote">
              <ChatBubbleLeftRightIcon className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
              <div className="min-w-0">
                <span className="cosmic-comment__echo-name">{comment.quotedComment.user.name}</span>
                <p className="cosmic-comment__echo-text">{comment.quotedComment.text}</p>
              </div>
            </div>
          )}

          {editingId === comment.id ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="cosmic-comments__input !rounded-lg flex-1"
                disabled={editingLoading}
              />
              <button type="button" className="cosmic-comments__send !py-2" onClick={async () => {
                if (onEditComment && editText.trim()) {
                  setEditingLoading(true);
                  try {
                    await onEditComment(comment.id, editText);
                    setEditingId(null);
                  } finally {
                    setEditingLoading(false);
                  }
                }
              }} disabled={editingLoading}>
                {editingLoading ? <ArrowPathIcon className="h-4 w-4 animate-spin inline" strokeWidth={2} /> : t('comments.save')}
              </button>
            </div>
            ) : comment.text?.trim() ? (
            <>
            <p className="cosmic-comment__text">
              {(translations[comment.id]?.visible ? translations[comment.id].text : comment.text)
                .split(/(@[\w ]+)/g).map((part, i) =>
                part.startsWith('@') ? <span key={i} className="text-lab font-semibold">{part}</span> : part,
              )}
              {comment.editedAt && (
                <span className="cosmic-comment__edited"> · {t('comments.edited')}</span>
              )}
            </p>
            {onTranslateComment && (
              <button
                type="button"
                className="cosmic-comment__translate"
                onClick={() => handleTranslate(comment)}
                disabled={translatingId === comment.id}
              >
                <LanguageIcon className="h-4 w-4" strokeWidth={1.75} />
                {translatingId === comment.id
                  ? t('comments.translating')
                  : translations[comment.id]?.visible
                    ? t('comments.showOriginal')
                    : t('comments.translate')}
              </button>
            )}
            </>
          ) : null}

          {comment.gifUrl && (
            <Image src={mediaUrl(comment.gifUrl) || comment.gifUrl} alt={`GIF shared by ${comment.user.name}`} width={240} height={240} className="cosmic-comment__gif mt-2" unoptimized />
          )}
          {comment.stickerUrl && (
            <Image src={mediaUrl(comment.stickerUrl) || comment.stickerUrl} alt={`Sticker shared by ${comment.user.name}`} width={160} height={160} className="cosmic-comment__sticker mt-2" unoptimized />
          )}
          {!comment.text?.trim() && !comment.gifUrl && !comment.stickerUrl && (
            <p className="cosmic-comment__text text-text-secondary italic">…</p>
          )}

          {showConfirmDelete === comment.id && (
            <div className="mt-2 p-2 rounded-lg bg-surface/50 text-xs">
              {t('comments.deleteConfirm')}
              <div className="flex gap-2 mt-2">
                <button type="button" className="cosmic-comments__send !py-1 !px-3 !bg-red-600" onClick={async () => {
                  if (onDeleteComment) {
                    setDeletingLoading(comment.id);
                    try {
                      await onDeleteComment(comment.id);
                      setShowConfirmDelete(null);
                    } finally {
                      setDeletingLoading(null);
                    }
                  }
                }} disabled={deletingLoading === comment.id}>{t('comments.delete')}</button>
                <button type="button" className="text-text-secondary" onClick={() => setShowConfirmDelete(null)}>{t('comments.cancel')}</button>
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
            {onReply && (
              <button type="button" className="text-xs font-semibold text-text-secondary hover:text-lab transition" onClick={() => startReply(comment)}>
                {t('feed.reply')}
              </button>
            )}
            {onReply && (
              <button type="button" className="text-xs font-semibold text-text-secondary hover:text-lab transition" onClick={() => startReply(comment, true)}>
                {t('comments.echoQuote')}
              </button>
            )}
            {replyCount > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-text-secondary hover:text-lab transition"
                onClick={() => toggleCollapse(comment.id)}
              >
                {isCollapsed ? `＋ ${replyCount} ${t('feed.replies')}` : `－ ${t('feed.collapse')}`}
              </button>
            )}
          </div>

          <AnimatePresence initial={false}>
            {replyingTo === comment.id && (
              <motion.form
                key={`reply-form-${comment.id}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="mt-2 flex flex-col gap-2"
                onSubmit={(e) => { e.preventDefault(); handleReply(comment.id); }}
              >
                {quoteReply && (
                  <div className="cosmic-comment__echo-preview">
                    <span className="text-xs text-text-secondary">{t('comments.quoting')} {quoteReply.userName}</span>
                    <p className="text-xs truncate opacity-80">{quoteReply.text}</p>
                    <button type="button" className="cosmic-comment__echo-clear" onClick={() => setQuoteReply(null)} aria-label={t('comments.cancel')}>
                      <XMarkIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t('comments.replyPlaceholder')}
                  className="cosmic-comments__input flex-1"
                  autoFocus
                />
                <button type="submit" className="cosmic-comments__send" aria-label={t('feed.reply')}>
                  <PaperAirplaneIcon className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <button type="button" className="text-xs text-text-secondary px-2" onClick={clearReplyState} aria-label={t('comments.cancel')}>
                  <XMarkIcon className="h-4 w-4" strokeWidth={2} />
                </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {replyCount > 0 && !isCollapsed && (
              <motion.div
                key={`replies-${comment.id}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="cosmic-comment__replies"
              >
                {comment.replies!.map((r) => renderComment(r, childDepth))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <RelativeTime date={comment.time} className="cosmic-comment__time block" />
      </div>
    </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="cosmic-comments"
        >
          <div className="cosmic-comments__panel">
            <div className="cosmic-comments__header">
              <div>
                <p className="cosmic-comments__title">{t('feed.comments')}</p>
                <p className="cosmic-comments__subtitle">
                  {comments.length === 0
                    ? t('feed.commentsEmpty')
                    : `${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}`}
                </p>
              </div>
              <div className="cosmic-comments__header-badge">
                <ChatBubbleLeftRightIcon className="h-4 w-4" strokeWidth={1.75} />
                <span>{sort === 'best' ? t('feed.sort_best') : sort === 'new' ? t('feed.sort_new') : sort === 'controversial' ? t('feed.sort_controversial') : t('feed.sort_old')}</span>
              </div>
            </div>
            {replyLocked ? (
              <p className="px-4 pb-3 text-sm text-text-secondary">{t('feed.replyLimited')}</p>
            ) : canComment === false ? (
              <div className="px-4 pb-4">
                <Link
                  href="/login?next=/"
                  className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(124,58,237,0.35)]"
                >
                  Sign in to comment
                </Link>
              </div>
            ) : canComment === null ? null : (
            <form onSubmit={handleSubmit} className="cosmic-comments__form">
              <div className="cosmic-comments__composer" ref={attachRef}>
                {user.avatar ? (
                  <Image
                    src={mediaUrl(user.avatar) || user.avatar}
                    alt=""
                    width={36}
                    height={36}
                    className="cosmic-comments__composer-avatar"
                    unoptimized
                  />
                ) : (
                  <span className="cosmic-comments__composer-avatar cosmic-comments__composer-avatar--fallback" aria-hidden>
                    {(user.name || '?').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="cosmic-comments__toolbar">
                  <button
                    type="button"
                    className={`cosmic-comments__tool${pickerTab === 'emoji' ? ' cosmic-comments__tool--active' : ''}`}
                    onClick={() => setPickerTab((t) => (t === 'emoji' ? null : 'emoji'))}
                    title={t('picker.emoji')}
                  >
                    <FaceSmileIcon className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className={`cosmic-comments__tool${pickerTab === 'gif' ? ' cosmic-comments__tool--active' : ''}`}
                    onClick={() => setPickerTab((t) => (t === 'gif' ? null : 'gif'))}
                    title={t('picker.gif')}
                  >
                    <span className="text-[10px] font-black tracking-tight">GIF</span>
                  </button>
                  <button
                    type="button"
                    className={`cosmic-comments__tool${pickerTab === 'sticker' ? ' cosmic-comments__tool--active' : ''}`}
                    onClick={() => setPickerTab((t) => (t === 'sticker' ? null : 'sticker'))}
                    title={t('picker.sticker')}
                  >
                    <SparklesIcon className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={handleCommentInput}
                  placeholder={t('feed.commentPlaceholder')}
                  className="cosmic-comments__input"
                />
                <button type="submit" className="cosmic-comments__send" disabled={addingComment || (!newComment.trim() && !gifUrl && !stickerUrl)}>
                  {addingComment ? <ArrowPathIcon className="h-4 w-4 animate-spin" strokeWidth={2} /> : <PaperAirplaneIcon className="h-5 w-5" strokeWidth={1.75} />}
                </button>
              </div>
              <CommentMediaPicker
                tab={pickerTab}
                anchorRef={attachRef}
                onTabChange={setPickerTab}
                onEmoji={(native) => setNewComment((c) => c + native)}
                onGif={(url) => {
                  setGifUrl(url);
                  setStickerUrl(null);
                }}
                onSticker={(url) => {
                  setStickerUrl(url);
                  setGifUrl(null);
                }}
              />

              {(gifUrl || stickerUrl) && (
                <div className="cosmic-comments__preview">
                  {gifUrl && (
                    <div className="cosmic-comments__preview-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <Image src={gifUrl} alt="Selected GIF preview" width={240} height={240} className="cosmic-comment__gif" unoptimized />
                      <button type="button" className="cosmic-comments__preview-remove" onClick={() => setGifUrl(null)} aria-label={t('picker.close')}>
                        <XMarkIcon className="h-5 w-5" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                  {stickerUrl && (
                    <div className="cosmic-comments__preview-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <Image src={mediaUrl(stickerUrl) || stickerUrl} alt="Selected sticker preview" width={160} height={160} className="cosmic-comment__sticker" unoptimized />
                      <button type="button" className="cosmic-comments__preview-remove" onClick={() => setStickerUrl(null)} aria-label={t('picker.close')}>
                        <XMarkIcon className="h-5 w-5" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {showMentionList && (
                <div className="cosmic-comments__mentions" role="listbox" aria-label="Mention suggestions">
                  {mentionUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      role="option"
                      className="cosmic-comments__mention"
                      onClick={() => handleMentionSelect(u.name)}
                    >
                      <span className="cosmic-comments__mention-at">@</span>
                      {u.name}
                    </button>
                  ))}
                  {mentionUsers.length === 0 && mentionQuery.length > 0 && (
                    <div className="cosmic-comments__mention-empty">No users found</div>
                  )}
                </div>
              )}
            </form>
            )}

            {comments.length > 0 && onSortChange && (
              <div className="cosmic-comments__sortbar">
                {(['best', 'new', 'old', 'controversial'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`cosmic-comments__sort${sort === key ? ' cosmic-comments__sort--active' : ''}`}
                    onClick={() => onSortChange(key)}
                  >
                    {t(`feed.sort_${key}`)}
                  </button>
                ))}
                <div className="flex-1" />
                <button type="button" className="cosmic-comments__sort" onClick={collapseAll}>
                  {t('comments.collapseAll')}
                </button>
                <button type="button" className="cosmic-comments__sort" onClick={expandAll}>
                  {t('comments.expandAll')}
                </button>
              </div>
            )}

            {comments.length === 0 ? (
              <div className="cosmic-comments__empty">
                <div className="cosmic-comments__empty-icon">✦</div>
                <p>{t('feed.commentsEmpty')}</p>
              </div>
            ) : (
              <div className="cosmic-comments__list mt-3">{comments.map((c) => renderComment(c))}</div>
            )}

            {hasMore && onLoadMore && (
              <button
                type="button"
                onClick={onLoadMore}
                className="cosmic-comments__loadmore"
              >
                {t('feed.loadMoreComments')}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
