'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Comments from './Comments';
import PostEngagementBar from './PostEngagementBar';
import ShareCosmicPanel from './ShareCosmicPanel';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import PostMediaGallery from './PostMediaGallery';
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon, BookmarkIcon, LinkIcon, FlagIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import LinkPreview from './LinkPreview';
import RelativeTime from './RelativeTime';
import { getUser } from '@/lib/auth';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { countsToEmojiMap, COSMIC_REACTIONS, REACTION_TYPE_BY_EMOJI, EMOJI_BY_REACTION_TYPE } from '@/lib/reactions';
import type { ReactionType } from '@/lib/reactions';

const DEFAULT_AVATAR = 'https://randomuser.me/api/portraits/lego/1.jpg';

function commentMediaUrl(url?: string | null) {
  if (!url) return DEFAULT_AVATAR;
  return mediaUrl(url) || DEFAULT_AVATAR;
}

function commentUserName(u: { username?: string; first_name?: string; last_name?: string } | null) {
  if (!u) return 'Anonymous';
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  return full || u.username || 'Anonymous';
}

interface PostCardProps {
  variant?: 'default' | 'premium';
  id?: number;
  user: {
    id?: number;
    name: string;
    avatar: string;
  };
  time: string;
  text: string;
  mood?: string;
  tags?: string[];
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  is_saved?: boolean;
  onDeleted?: (id: number) => void;
  onUpdated?: () => void;
  onSavedChange?: (id: number, saved: boolean) => void;
  images?: string[];
  videos?: string[];
  audio?: string;
  description?: string;
  stats: {
    views: number;
    comments: number;
    shares: number;
  };
}

// Define the Comment type explicitly for reuse
type CommentType = {
  id: number;
  user: { id: number; name: string; avatar: string; };
  text: string;
  time: string;
  images?: string[];
  image?: string;
  video?: string;
  audio?: string;
  description?: string;
  gifUrl?: string;
  stickerUrl?: string;
  style?: React.CSSProperties;
  reactionCounts?: Record<string, number>;
  myReaction?: string;
  replies?: CommentType[];
};

function mapComment(c: Record<string, unknown>): CommentType {
  const myType = c.my_reaction as ReactionType | null | undefined;
  const myEmoji = myType ? EMOJI_BY_REACTION_TYPE[myType] : undefined;
  return {
    id: c.id as number,
    user: {
      id: (c.user as { id?: number })?.id ?? 0,
      name: commentUserName(c.user as Parameters<typeof commentUserName>[0]),
      avatar: commentMediaUrl((c.user as { avatar?: string })?.avatar),
    },
    text: (c.text as string) || '',
    time: (c.created_at as string) || '',
    gifUrl: (c.gif_url as string) || undefined,
    stickerUrl: (c.sticker_url as string) || undefined,
    reactionCounts: countsToEmojiMap(c.reaction_counts as Record<string, number>),
    myReaction: myEmoji,
    replies: Array.isArray(c.replies) ? (c.replies as Record<string, unknown>[]).map(mapComment) : [],
  };
}

function PostCard({ variant = 'default', id, user, time, text, mood, tags, reaction_counts, my_reaction, is_saved: isSavedProp = false, images, videos, audio, description, stats, onDeleted, onUpdated, onSavedChange }: PostCardProps) {
  const [showShare, setShowShare] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [displayText, setDisplayText] = useState(text);
  const [editText, setEditText] = useState(text);
  const [busy, setBusy] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<{emoji: string, label: string} | null>(() => {
    if (!my_reaction) return null;
    const found = COSMIC_REACTIONS.find(r => r.type === my_reaction);
    return found ? { emoji: found.emoji, label: found.label } : null;
  });
  const [reactionCounts, setReactionCounts] = useState<{ [emoji: string]: number }>(() => countsToEmojiMap(reaction_counts));
  const [comments, setComments] = useState<CommentType[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; avatar: string }>({ id: 0, name: 'You', avatar: DEFAULT_AVATAR });
  const [saved, setSaved] = useState(isSavedProp);
  const [saveBusy, setSaveBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareCount, setShareCount] = useState(stats.shares);
  const [commentsCount, setCommentsCount] = useState(stats.comments);
  const [viewCount, setViewCount] = useState(stats.views);
  const [reactionBusy, setReactionBusy] = useState(false);
  const viewedRef = useRef(false);
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    setSaved(isSavedProp);
  }, [isSavedProp]);

  useEffect(() => {
    setCommentsCount(stats.comments);
  }, [stats.comments]);

  useEffect(() => {
    setReactionCounts(countsToEmojiMap(reaction_counts));
  }, [reaction_counts]);

  useEffect(() => {
    if (my_reaction) {
      const found = COSMIC_REACTIONS.find((r) => r.type === my_reaction);
      setSelectedReaction(found ? { emoji: found.emoji, label: found.label } : null);
    } else {
      setSelectedReaction(null);
    }
  }, [my_reaction]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiFetch(`comments/?post=${id}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(mapComment) : [];
        setComments(list);
        setCommentsCount(list.length);
      }
    } catch {
      /* keep existing comments on error */
    }
  }, [id]);

  useEffect(() => {
    const me = getUser();
    if (me) {
      setCurrentUser({
        id: me.id,
        name: commentUserName(me),
        avatar: commentMediaUrl(me.avatar),
      });
    }
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (!id || viewedRef.current) return;
    viewedRef.current = true;
    apiFetch(`posts/${id}/increment_views/`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.views != null) setViewCount(data.views);
        else setViewCount((v) => v + 1);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    // Defer word-level motion until the card has been in the viewport a beat;
    // this avoids blocking the initial mount/render of long feeds.
    const handle = requestAnimationFrame(() => setAllowMotion(true));
    return () => cancelAnimationFrame(handle);
  }, []);

  const hasMedia =
    (images?.some((u) => mediaUrl(u)) ?? false) ||
    (videos?.some((u) => mediaUrl(u)) ?? false);

  const handleReaction = async (reactionEmoji: string) => {
    if (!id || reactionBusy) return;
    const type = REACTION_TYPE_BY_EMOJI[reactionEmoji];
    if (!type) return;

    const prevCounts = { ...reactionCounts };
    const prevSelected = selectedReaction;
    const found = COSMIC_REACTIONS.find((r) => r.emoji === reactionEmoji);
    const nextCounts = { ...reactionCounts };

    if (prevSelected?.emoji === reactionEmoji) {
      const n = Math.max(0, (nextCounts[reactionEmoji] || 0) - 1);
      if (n === 0) delete nextCounts[reactionEmoji];
      else nextCounts[reactionEmoji] = n;
      setSelectedReaction(null);
    } else {
      if (prevSelected?.emoji) {
        const old = prevSelected.emoji;
        const n = Math.max(0, (nextCounts[old] || 0) - 1);
        if (n === 0) delete nextCounts[old];
        else nextCounts[old] = n;
      }
      nextCounts[reactionEmoji] = (nextCounts[reactionEmoji] || 0) + 1;
      setSelectedReaction(found ? { emoji: found.emoji, label: found.label } : null);
    }
    setReactionCounts(nextCounts);
    setReactionBusy(true);

    try {
      const res = await apiFetchJson(`posts/${id}/react/`, {
        method: 'POST',
        json: { reaction: type },
      });
      if (res.ok) {
        const data = await res.json();
        setReactionCounts(countsToEmojiMap(data.reaction_counts));
        if (data.my_reaction) {
          const picked = COSMIC_REACTIONS.find((r) => r.type === data.my_reaction);
          setSelectedReaction(picked ? { emoji: picked.emoji, label: picked.label } : null);
        } else {
          setSelectedReaction(null);
        }
      } else {
        setReactionCounts(prevCounts);
        setSelectedReaction(prevSelected);
      }
    } catch {
      setReactionCounts(prevCounts);
      setSelectedReaction(prevSelected);
    } finally {
      setReactionBusy(false);
    }
  };

  const commentPayload = (data: {
    text: string;
    gifUrl?: string;
    stickerUrl?: string;
  }) => ({
    post: id,
    text: data.text?.trim() || '',
    gif_url: data.gifUrl || '',
    sticker_url: data.stickerUrl || '',
  });

  const handleAddComment = async (data: {
    text: string;
    gifUrl?: string;
    stickerUrl?: string;
  }) => {
    if (!id || (!data.text?.trim() && !data.gifUrl && !data.stickerUrl)) return;
    try {
      await apiFetchJson('comments/', { method: 'POST', json: commentPayload(data) });
      await fetchComments();
    } catch {
      /* ignore */
    }
  };

  const handleReply = async (
    parentId: number,
    data: { text: string; gifUrl?: string; stickerUrl?: string },
  ) => {
    if (!id || (!data.text?.trim() && !data.gifUrl && !data.stickerUrl)) return;
    try {
      await apiFetchJson('comments/', {
        method: 'POST',
        json: { ...commentPayload(data), parent: parentId },
      });
      await fetchComments();
    } catch {
      /* ignore */
    }
  };

  const handleCommentReaction = async (commentId: number, reactionEmoji: string) => {
    const type = REACTION_TYPE_BY_EMOJI[reactionEmoji];
    if (!type) return;
    try {
      const res = await apiFetchJson(`comments/${commentId}/react/`, {
        method: 'POST',
        json: { reaction: type },
      });
      if (res.ok) await fetchComments();
    } catch {
      /* ignore */
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      await apiFetchJson(`comments/${commentId}/`, { method: 'DELETE' });
      await fetchComments();
    } catch {
      /* ignore */
    }
  };

  const handleEditComment = async (commentId: number, newText: string) => {
    try {
      await apiFetchJson(`comments/${commentId}/`, {
        method: 'PATCH',
        json: { text: newText },
      });
      await fetchComments();
    } catch {
      /* ignore */
    }
  };

  const recordShare = async () => {
    if (!id) return;
    try {
      const res = await apiFetchJson(`posts/${id}/share/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setShareCount(data.shares_count ?? shareCount + 1);
      }
    } catch {
      /* ignore */
    }
  };

  const isOwner = user.id != null && currentUser.id !== 0 && currentUser.id === user.id;

  const handleDeletePost = async () => {
    if (!id || busy) return;
    if (!window.confirm('Delete this post permanently?')) return;
    setBusy(true);
    try {
      const res = await apiFetchJson(`posts/${id}/`, { method: 'DELETE' });
      if (res.ok) {
        setMenuOpen(false);
        onDeleted?.(id);
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id || busy || !editText.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetchJson(`posts/${id}/`, {
        method: 'PATCH',
        json: { text: editText.trim() },
      });
      if (res.ok) {
        setDisplayText(editText.trim());
        setIsEditing(false);
        onUpdated?.();
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSave = async () => {
    if (!id || saveBusy) return;
    setSaveBusy(true);
    try {
      const res = await apiFetchJson(`posts/${id}/toggle_save/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const next = !!data.saved;
        setSaved(next);
        onSavedChange?.(id, next);
      }
    } catch {
      /* ignore */
    } finally {
      setSaveBusy(false);
    }
  };

  const handleReportPost = async () => {
    if (!id || !getUser()) return;
    if (!window.confirm('Report this post to moderators?')) return;
    setMenuOpen(false);
    try {
      await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'post',
          content: `post:${id} @${user.name}: ${displayText.slice(0, 200)}`,
          reporter: getUser()!.username,
        },
      });
    } catch {
      /* ignore */
    }
  };

  const handleReportComment = async (commentId: number, snippet: string) => {
    if (!id || !getUser()) return;
    if (!window.confirm('Report this comment to moderators?')) return;
    try {
      await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'comment',
          content: `post:${id} comment:${commentId}: ${snippet.slice(0, 200)}`,
          reporter: getUser()!.username,
        },
      });
    } catch {
      /* ignore */
    }
  };

  const handleCopyLink = async () => {
    if (!id || typeof window === 'undefined') return;
    const url = `${window.location.origin}/post/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const openShare = () => {
    setShowShare(true);
  };
  const shareUrl =
    id && typeof window !== 'undefined' ? `${window.location.origin}/post/${id}` : '';

  const words = displayText.split(' ');

  // Lightweight word-level motion config; kept static to avoid re-computation.
  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.03,
      },
    },
  };
  const wordAnim = {
    hidden: { opacity: 0.3, y: 4 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } },
  };

  // استخراج أول رابط من النص
  const urlMatch = displayText.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
  const firstUrl = urlMatch ? urlMatch[0] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`${variant === 'premium' ? 'post-card-premium' : 'card'} p-6 mb-0 hover:shadow-xl transition-shadow duration-300`}
    >
      <div className="flex items-center mb-4">
        {user.id ? (
          <Link href={`/profile/${user.id}`} className="flex items-center group">
            <Image src={user.avatar || DEFAULT_AVATAR} alt={`${user.name} avatar`} width={36} height={36} className="w-9 h-9 rounded-full mr-3 object-cover" unoptimized />
            <div>
              <div className="font-semibold text-text group-hover:underline">{user.name}</div>
              <RelativeTime date={time} className="text-xs text-text-secondary block" />
            </div>
          </Link>
        ) : (
          <div className="flex items-center">
            <Image src={user.avatar || DEFAULT_AVATAR} alt={`${user.name} avatar`} width={36} height={36} className="w-9 h-9 rounded-full mr-3 object-cover" unoptimized />
            <div>
              <div className="font-semibold text-text">{user.name}</div>
              <RelativeTime date={time} className="text-xs text-text-secondary block" />
            </div>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {id && (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1.5 rounded-full text-text-secondary hover:text-lab hover:bg-surface transition"
                title={linkCopied ? 'Copied!' : 'Copy post link'}
                aria-label="Copy post link"
              >
                <LinkIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleToggleSave}
                disabled={saveBusy}
                className="p-1.5 rounded-full text-text-secondary hover:text-vault hover:bg-surface transition disabled:opacity-50"
                title={saved ? 'Remove from saved' : 'Save post'}
                aria-label={saved ? 'Remove from saved' : 'Save post'}
              >
                {saved ? (
                  <BookmarkSolid className="h-5 w-5 text-vault" />
                ) : (
                  <BookmarkIcon className="h-5 w-5" />
                )}
              </button>
            </>
          )}
          {mood && (
            <span className="text-2xl" title="Mood">{mood}</span>
          )}
          {isOwner && id && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                className="p-1 rounded-full text-text-secondary hover:text-text hover:bg-surface transition"
                title="Post options"
              >
                <EllipsisHorizontalIcon className="h-6 w-6" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 w-36 bg-background rounded-lg shadow-xl border border-surface z-20 overflow-hidden">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setEditText(displayText); setIsEditing(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface text-left"
                  >
                    <PencilSquareIcon className="h-4 w-4" /> Edit
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleDeletePost}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                  >
                    <TrashIcon className="h-4 w-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
          {!isOwner && id && getUser() && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                className="p-1 rounded-full text-text-secondary hover:text-text hover:bg-surface transition"
                title="Report post"
              >
                <EllipsisHorizontalIcon className="h-6 w-6" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-9 w-36 bg-background rounded-lg shadow-xl border border-surface z-20 overflow-hidden">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleReportPost}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface text-left"
                  >
                    <FlagIcon className="h-4 w-4" /> Report
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mb-4">
        {isEditing ? (
          <div className="mb-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-surface bg-transparent p-3 text-text focus:outline-none focus:ring-2 focus:ring-bazaar resize-y"
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => { setIsEditing(false); setEditText(displayText); }}
                className="px-3 py-1.5 rounded-full text-sm text-text-secondary hover:bg-surface"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={busy || !editText.trim()}
                className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-tr from-vault to-bazaar text-white disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
        /* Lightweight word-level reveal; disabled on mount to avoid feed jank. */
        <motion.p
          className="text-text mb-2 flex flex-wrap gap-x-1 gap-y-1"
          variants={container}
          initial="hidden"
          animate={allowMotion ? 'visible' : 'hidden'}
        >
          {words.map((word, i) => (
            <motion.span
              key={`${i}-${word}`}
              variants={wordAnim}
              className="inline-block cursor-pointer transition-colors duration-200 hover:text-lab"
            >
              {word}
            </motion.span>
          ))}
        </motion.p>
        )}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="px-2 py-0.5 rounded-full text-xs bg-lab/10 text-lab font-medium hover:bg-lab/20 transition"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
        {firstUrl && <LinkPreview url={firstUrl} />}
        {hasMedia && <PostMediaGallery images={images} videos={videos} />}
        {/* عرض الصوت */}
        {audio && (
          <audio controls className="w-full mt-2">
            <source src={mediaUrl(audio)} />
            Your browser does not support the audio element.
          </audio>
        )}
        {/* عرض description */}
        {description && (
          <div className="text-text-secondary text-sm mt-2 whitespace-pre-line">{description}</div>
        )}
      </div>
      <PostEngagementBar
        onReaction={handleReaction}
        selectedReaction={selectedReaction?.emoji}
        reactionCounts={reactionCounts}
        views={viewCount}
        commentsCount={commentsCount}
        sharesCount={shareCount}
        commentsOpen={commentsOpen}
        onCommentsToggle={() => setCommentsOpen((o) => !o)}
        onShare={openShare}
      />
      <AnimatePresence>
        {showShare && id && shareUrl && (
          <ShareCosmicPanel
            postUrl={shareUrl}
            postTitle={displayText.slice(0, 120)}
            shareCount={shareCount}
            onClose={() => setShowShare(false)}
            onRecordShare={recordShare}
          />
        )}
      </AnimatePresence>
      <Comments
        open={commentsOpen}
        comments={comments}
        onAddComment={handleAddComment}
        onReply={handleReply}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        onReportComment={handleReportComment}
        onCommentReaction={handleCommentReaction}
        user={{ id: currentUser.id, name: currentUser.name }}
        postOwner={{ id: user.id ?? 0, name: user.name }}
      />
    </motion.div>
  );
}

export default memo(PostCard); 