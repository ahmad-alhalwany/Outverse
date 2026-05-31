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
<<<<<<< HEAD
import { useLocale } from './LocaleProvider';
import { apiFetch } from '@/lib/api';
=======

interface Comment {
  id: number;
  user: {
    id: number;
    name: string;
    avatar: string;
  };
  text: string;
  time: string;
  gifUrl?: string;
  stickerUrl?: string;
  style?: React.CSSProperties;
  reaction?: string;
  replies?: Comment[];
}
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660

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
<<<<<<< HEAD
  comments: CommentItem[];
  open: boolean;
  onAddComment: (data: { text: string; gifUrl?: string; stickerUrl?: string }) => void;
  onReply?: (parentId: number, data: { text: string; gifUrl?: string; stickerUrl?: string; time: string }) => void;
  onEditComment?: (commentId: number, newText: string) => void;
  onDeleteComment?: (commentId: number) => void;
  onCommentReaction?: (commentId: number, reactionEmoji: string) => void;
=======
  postId: number;
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
  user: User;
  postOwner: User;
  onCommentsCountUpdate?: (count: number) => void;
}

const gifs = [
  'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
];

<<<<<<< HEAD
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
=======
export default function Comments({ postId, user, postOwner, onCommentsCountUpdate }: CommentsProps) {
  const [isOpen, setIsOpen] = useState(false);
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
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
<<<<<<< HEAD
  const [addingComment, setAddingComment] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState<number | null>(null);
=======
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<{ id: number; name: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

<<<<<<< HEAD
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
=======
  // API states
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [addingComment, setAddingComment] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState<number | null>(null);

  // States for Rich Replies
  const [showReplyEmoji, setShowReplyEmoji] = useState(false);
  const [showReplyGif, setShowReplyGif] = useState(false);
  const [showReplyStickers, setShowReplyStickers] = useState(false);
  const [replyGifUrl, setReplyGifUrl] = useState<string | null>(null);
  const [replyStickerUrl, setReplyStickerUrl] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const stickers = [
    '/stickers/sticker1.png',
    '/stickers/sticker2.png',
    '/stickers/sticker3.png',
  ];

  const gifs = [
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  ];

  // Fetch comments from API
  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, postId]);

  // Fetch comments count when component mounts
  useEffect(() => {
    fetchCommentsCount();
  }, [postId]);

  // Update comments count when comments change
  useEffect(() => {
    setCommentsCount(comments.length);
  }, [comments]);

  const fetchCommentsCount = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/comments/?post=${postId}`);
      if (response.ok) {
        const data = await response.json();
        setCommentsCount(data.length);
        if (onCommentsCountUpdate) {
          onCommentsCountUpdate(data.length);
        }
      }
    } catch (error) {
      console.error('Error fetching comments count:', error);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`http://localhost:8000/api/comments/?post=${postId}`);
      if (response.ok) {
        const data = await response.json();
        const mappedComments = data.map((comment: any) => ({
          id: comment.id,
          user: {
            id: comment.user.id,
            name: comment.user.first_name && comment.user.last_name 
              ? `${comment.user.first_name} ${comment.user.last_name}` 
              : comment.user.username,
            avatar: comment.user.avatar || '',
          },
          text: comment.text,
          time: formatRelativeTime(new Date(comment.created_at)),
          gifUrl: comment.gif_url,
          stickerUrl: comment.sticker_url,
          style: comment.custom_style,
          replies: comment.replies?.map((reply: any) => ({
            id: reply.id,
            user: {
              id: reply.user.id,
              name: reply.user.first_name && reply.user.last_name 
                ? `${reply.user.first_name} ${reply.user.last_name}` 
                : reply.user.username,
              avatar: reply.user.avatar || '',
            },
            text: reply.text,
            time: formatRelativeTime(new Date(reply.created_at)),
            gifUrl: reply.gif_url,
            stickerUrl: reply.sticker_url,
          })) || [],
        }));
        setComments(mappedComments);
        setCommentsCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleStickerSelect = (url: string) => {
    setStickerUrl(url);
    setShowStickers(false);
  };

  const handleColorChange = (color: any) => {
    setCustomStyle({ ...customStyle, background: color.hex });
    setShowColor(false);
  };

  const handleEmojiSelect = (emoji: any) => {
    setNewComment(newComment + emoji.native);
    setShowEmoji(false);
  };

  const handleGifSelect = (url: string) => {
    setGifUrl(url);
    setShowGif(false);
  };

  const handleCommentReaction = async (commentId: number, reaction: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/comments/${commentId}/add_reaction/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reaction: reaction,
          user_id: user.id,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update local state based on API response
        setSelectedCommentReactions(prev => {
          if (data.reaction) {
            return { ...prev, [commentId]: data.reaction };
          } else {
            const newState = { ...prev };
            delete newState[commentId];
            return newState;
          }
        });
        
        // Refresh comments to get updated reaction counts
        fetchComments();
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReply = async (parentId: number) => {
    if (replyText.trim() || replyGifUrl || replyStickerUrl) {
      try {
        const response = await fetch('http://localhost:8000/api/comments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post: postId,
            user_id: user.id,
            parent: parentId,
            text: replyText,
            gif_url: replyGifUrl || null,
            sticker_url: replyStickerUrl || null,
          }),
        });
        
        if (response.ok) {
          // Reset all reply states and close the form
          setReplyText('');
          setReplyGifUrl(null);
          setReplyStickerUrl(null);
          setReplyingTo(null);
          setShowReplyEmoji(false);
          setShowReplyGif(false);
          setShowReplyStickers(false);
          // Refresh comments and update count
          fetchComments();
          setCommentsCount(prev => prev + 1);
          if (onCommentsCountUpdate) {
            onCommentsCountUpdate(commentsCount + 1);
          }
        }
      } catch (error) {
        console.error('Error adding reply:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() || gifUrl || stickerUrl) {
      setAddingComment(true);
      try {
        const response = await fetch('http://localhost:8000/api/comments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post: postId,
            user_id: user.id,
            text: newComment,
            gif_url: gifUrl || null,
            sticker_url: stickerUrl || null,
            custom_style: customStyle,
          }),
        });
        
        if (response.ok) {
          playComment();
          setNewComment('');
          setGifUrl(null);
          setStickerUrl(null);
          setCustomStyle({});
          // Refresh comments and update count
          fetchComments();
          setCommentsCount(prev => prev + 1);
          if (onCommentsCountUpdate) {
            onCommentsCountUpdate(commentsCount + 1);
          }
        }
      } catch (error) {
        console.error('Error adding comment:', error);
      } finally {
        setAddingComment(false);
      }
    }
  };

  const handleEdit = (id: number, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const handleSaveEditAction = async (id: number) => {
    if (editText.trim()) {
      setEditingLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/comments/${id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: editText,
          }),
        });
        
        if (response.ok) {
          setEditingId(null);
          setEditText('');
          // Refresh comments
          fetchComments();
        }
      } catch (error) {
        console.error('Error editing comment:', error);
      } finally {
        setEditingLoading(false);
      }
    }
  };

  const handleDeleteAction = async (id: number) => {
    setDeletingLoading(id);
    try {
      const response = await fetch(`http://localhost:8000/api/comments/${id}/`, {
        method: 'DELETE',
      });
      
              if (response.ok) {
          setShowConfirmDelete(null);
          // Refresh comments and update count
          fetchComments();
          setCommentsCount(prev => prev - 1);
          if (onCommentsCountUpdate) {
            onCommentsCountUpdate(commentsCount - 1);
          }
        }
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setDeletingLoading(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePin = (id: number) => {
    setPinnedId(id === pinnedId ? null : id);
  };
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660

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
<<<<<<< HEAD
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
=======
    <div className="mt-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
      >
        <span>💬</span>
        <span className="text-sm">Comments ({commentsCount})</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-4"
          >
            <form onSubmit={handleSubmit} className="flex flex-col space-y-2 relative">
              <div className="flex space-x-2 items-center">
                <motion.input
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
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
<<<<<<< HEAD
              <div className="mt-3">{sortedComments.map((c) => renderComment(c))}</div>
=======
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {sortedComments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.4, type: 'spring', stiffness: 80 }}
                      className={`flex space-x-3 relative ${pinnedId === comment.id ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}
                    >
                      {/* لمسة كونية: نجمة متوهجة عند إضافة تعليق جديد (آخر تعليق مضاف) */}
                      {comment.id === sortedComments[0]?.id && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1.2, opacity: 1 }}
                          transition={{ duration: 0.5, type: 'spring' }}
                          className="absolute -left-5 top-2 text-yellow-300 drop-shadow-glow pointer-events-none"
                        >
                          ✨
                        </motion.span>
                      )}
                      <img
                        src={comment.user.avatar}
                        alt={comment.user.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <motion.div
                          className="rounded-lg p-3 relative"
                          style={comment.style || { background: '#f9fafb' }}
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-black">{comment.user.name}</div>
                            <div className="flex items-center space-x-2">
                              {user && postOwner && user.id === postOwner.id && (
                                <button onClick={() => handlePin(comment.id)} title="Pin" className={`text-lg ${pinnedId === comment.id ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}><FaThumbtack /></button>
                              )}
                              {user && user.id === comment.user.id && (
                                <button onClick={() => handleEdit(comment.id, comment.text)} title="Edit" className="text-gray-400 hover:text-blue-500 ml-2"><FaEdit /></button>
                              )}
                              {user && postOwner && (user.id === comment.user.id || user.id === postOwner.id) && (
                                <button onClick={() => setShowConfirmDelete(comment.id)} title="Delete" className="text-gray-400 hover:text-red-500"><FaTrash /></button>
                              )}
                            </div>
                          </div>
                          {editingId === comment.id ? (
                            <div className="flex space-x-2 mt-2">
                              <input
                                type="text"
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm !text-black"
                                disabled={editingLoading}
                              />
                              <button className="px-2 py-1 bg-lab text-white rounded text-sm flex items-center" onClick={() => handleSaveEditAction(comment.id)} disabled={editingLoading}>
                                {editingLoading ? <FaSpinner className="animate-spin mr-1" /> : null} Save
                              </button>
                              <button className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm" onClick={() => setEditingId(null)} disabled={editingLoading}>Cancel</button>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700">
                              {comment.text.split(/(@[\w ]+)/g).map((part, i) =>
                                part.startsWith('@') ? (
                                  <span key={i} className="text-lab font-semibold">{part}</span>
                                ) : part
                              )}
                            </p>
                          )}
                          {showConfirmDelete === comment.id && (
                            <div className="mt-2 bg-white border p-2 rounded shadow text-xs">
                              Are you sure you want to delete this comment?
                              <div className="flex space-x-2 mt-1">
                                <button className="px-2 py-1 bg-red-500 text-white rounded flex items-center" onClick={() => handleDeleteAction(comment.id)} disabled={deletingLoading === comment.id}>
                                  {deletingLoading === comment.id ? <FaSpinner className="animate-spin mr-1" /> : null} Delete
                                </button>
                                <button className="px-2 py-1 text-gray-500" onClick={() => setShowConfirmDelete(null)} disabled={deletingLoading === comment.id}>Cancel</button>
                              </div>
                            </div>
                          )}
                          <div className="mt-2 flex items-center space-x-4">
                            <div className="relative">
                              <PostReactions 
                                onReaction={(reaction) => handleCommentReaction(comment.id, reaction)}
                                selectedReaction={selectedCommentReactions[comment.id]}
                                reactionCounts={commentReactionCounts[comment.id]}
                              />
                            </div>
                            
                            <button 
                              className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                              onClick={() => setReplyingTo(comment.id)}
                            >
                              <span>Reply</span>
                            </button>
                          </div>

                          {replyingTo === comment.id && (
                            <motion.form 
                              onSubmit={(e) => { e.preventDefault(); handleReply(comment.id); }}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="mt-2 flex flex-col space-y-1 relative"
                            >
                              <div className="flex space-x-2 items-center">
                                <input
                                  ref={replyInputRef}
                                  type="text"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Write a reply..."
                                  className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm !text-black"
                                  autoFocus
                                />
                                <button 
                                  type="submit"
                                  className="px-3 py-1 bg-lab text-white rounded text-sm hover:bg-opacity-90"
                                >
                                  Send
                                </button>
                              </div>
                              <div className="flex space-x-2 items-center pl-1">
                                <button type="button" onClick={() => setShowReplyEmoji(!showReplyEmoji)} className="text-lg p-1 text-gray-500 hover:text-black transition" title="Emoji"><FaRegSmile /></button>
                                <button type="button" onClick={() => setShowReplyGif(!showReplyGif)} className="text-lg p-1 text-gray-500 hover:text-black transition" title="GIF"><MdGif /></button>
                                <button type="button" onClick={() => setShowReplyStickers(!showReplyStickers)} className="text-lg p-1 text-gray-500 hover:text-black transition" title="Sticker">🌟</button>
                                
                                <button 
                                  type="button"
                                  className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                                  onClick={() => { 
                                    setReplyingTo(null); 
                                    setReplyText(''); 
                                    setShowReplyEmoji(false);
                                    setShowReplyGif(false);
                                    setShowReplyStickers(false);
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                              {/* Reply Emoji Picker */}
                              {showReplyEmoji && (
                                <div className="relative z-50 mt-1">
                                  <Picker data={data} onEmojiSelect={handleReplyEmojiSelect} theme="auto" />
                                </div>
                              )}
                              {/* Reply GIF Picker */}
                              {showReplyGif && (
                                <div className="relative z-50 mt-1 bg-white p-2 rounded shadow flex space-x-2">
                                  {gifs.map((url) => (
                                    <img key={url} src={url} alt="gif" className="w-16 h-16 cursor-pointer rounded" onClick={() => handleReplyGifSelect(url)} />
                                  ))}
                                </div>
                              )}
                              {showReplyStickers && (
                                <div className="relative z-50 mt-1 bg-white p-2 rounded shadow flex space-x-2">
                                  {stickers.map((url) => (
                                    <img key={url} src={url} alt="sticker" className="w-10 h-10 cursor-pointer" onClick={() => handleReplyStickerSelect(url)} />
                                  ))}
                                </div>
                              )}
                              {(replyGifUrl || replyStickerUrl) && (
                                  <div className="flex space-x-2 items-center mt-1 pl-1">
                                      {replyGifUrl && <img src={replyGifUrl} alt="gif" className="w-16 h-16 rounded" />}
                                      {replyStickerUrl && <img src={replyStickerUrl} alt="sticker" className="w-10 h-10" />}
                                  </div>
                              )}
                            </motion.form>
                          )}

                          {comment.replies && comment.replies.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-2 ml-4 border-l-2 border-gray-200 pl-2 space-y-2"
                            >
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="text-sm flex items-start space-x-2">
                                  <img
                                    src={reply.user.avatar}
                                    alt={reply.user.name}
                                    className="w-7 h-7 rounded-full mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-black">{reply.user.name}</span>
                                      <div className="flex items-center space-x-2">
                                        {user && user.id === reply.user.id && (
                                          <button onClick={() => handleEdit(reply.id, reply.text)} title="Edit" className="text-gray-400 hover:text-blue-500 ml-2"><FaEdit /></button>
                                        )}
                                        {user && postOwner && (user.id === reply.user.id || user.id === postOwner.id) && (
                                          <button onClick={() => setShowConfirmDelete(reply.id)} title="Delete" className="text-gray-400 hover:text-red-500"><FaTrash /></button>
                                        )}
                                      </div>
                                    </div>

                                    {editingId === reply.id ? (
                                      <div className="flex space-x-2 mt-2">
                                        <input type="text" value={editText} onChange={e => setEditText(e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm !text-black" autoFocus />
                                        <button className="px-2 py-1 bg-lab text-white rounded text-sm flex items-center" onClick={() => handleSaveEditAction(reply.id)} disabled={editingLoading}>
                                          {editingLoading ? <FaSpinner className="animate-spin mr-1" /> : null} Save
                                        </button>
                                        <button className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm" onClick={() => setEditingId(null)} disabled={editingLoading}>Cancel</button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-gray-700 ml-1">{reply.text}</span>
                                        {reply.gifUrl && <img src={reply.gifUrl} alt="gif" className="w-16 h-16 rounded mt-1" />}
                                        {reply.stickerUrl && <img src={reply.stickerUrl} alt="sticker" className="w-8 h-8 ml-2 inline-block" />}
                                      </>
                                    )}

                                    {showConfirmDelete === reply.id && (
                                      <div className="mt-2 bg-white border p-2 rounded shadow text-xs">
                                        Are you sure?
                                        <div className="flex space-x-2 mt-1">
                                          <button className="px-2 py-1 bg-red-500 text-white rounded flex items-center" onClick={() => handleDeleteAction(reply.id)} disabled={deletingLoading === reply.id}>
                                            {deletingLoading === reply.id ? <FaSpinner className="animate-spin mr-1" /> : null} Delete
                                          </button>
                                          <button className="px-2 py-1 text-gray-500" onClick={() => setShowConfirmDelete(null)} disabled={deletingLoading === reply.id}>Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="mt-1">
                                      <PostReactions
                                        onReaction={(reaction) => {
                                          setCommentReactionCounts(prev => {
                                            const newState = { ...prev };
                                            if (!newState[reply.id]) newState[reply.id] = {};
                                            if (selectedCommentReactions[reply.id] === reaction) {
                                              newState[reply.id][reaction] = (newState[reply.id][reaction] || 1) - 1;
                                              if (newState[reply.id][reaction] <= 0) delete newState[reply.id][reaction];
                                            } else {
                                              const oldReaction = selectedCommentReactions[reply.id];
                                              if (oldReaction) {
                                                newState[reply.id][oldReaction] = (newState[reply.id][oldReaction] || 1) - 1;
                                                if (newState[reply.id][oldReaction] <= 0) delete newState[reply.id][oldReaction];
                                              }
                                              newState[reply.id][reaction] = (newState[reply.id][reaction] || 0) + 1;
                                            }
                                            return newState;
                                          });
                                          setSelectedCommentReactions(prev => {
                                            if (prev[reply.id] === reaction) {
                                              const newState = { ...prev };
                                              delete newState[reply.id];
                                              return newState;
                                            }
                                            return { ...prev, [reply.id]: reaction };
                                          });
                                        }}
                                        selectedReaction={selectedCommentReactions[reply.id]}
                                        reactionCounts={commentReactionCounts[reply.id]}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </motion.div>
                        <div className="text-xs text-gray-400 mt-1">{comment.time}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
