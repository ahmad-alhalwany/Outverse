'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Comments from './Comments';
import PostEngagementBar from './PostEngagementBar';
import ReactionBurst from './ReactionBurst';
import ShareCosmicPanel from './ShareCosmicPanel';
import QuotedPost from './QuotedPost';
import QuotedReel from './QuotedReel';
import QuoteComposer from './QuoteComposer';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Link from 'next/link';
import PostMediaGallery from './PostMediaGallery';
import { EllipsisHorizontalIcon, PencilSquareIcon, TrashIcon, BookmarkIcon, LinkIcon, FlagIcon, ArrowUpOnSquareIcon, ArrowPathRoundedSquareIcon, QueueListIcon, LockClosedIcon, NoSymbolIcon, ChevronUpIcon, ChevronDownIcon, GiftIcon, RocketLaunchIcon, GlobeAltIcon, EyeSlashIcon, UserPlusIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid, CheckBadgeIcon, MapPinIcon as MapPinSolid } from '@heroicons/react/24/solid';
import LinkPreview from './LinkPreview';
import RelativeTime from './RelativeTime';
import { getUser } from '@/lib/auth';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import { usePostCommentsWebSocket } from '@/hooks/usePostCommentsWebSocket';
import { countsToEmojiMap, COSMIC_REACTIONS, REACTION_TYPE_BY_EMOJI, EMOJI_BY_REACTION_TYPE, hapticReaction } from '@/lib/reactions';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import type { ReactionType } from '@/lib/reactions';
import { sharePostToStory } from '@/lib/storyUtils';
import { recordContentShare } from '@/lib/shareApi';
import { postShareUrl, type ShareChannel } from '@/lib/shareUtils';
import { repostPost, fetchThread, fetchPostEdits, pinProfilePost } from '@/lib/postsApi';
import { sendFeedFeedback } from '@/lib/socialApi';
import { sendTip } from '@/lib/tipApi';
import { trackEngagement } from '@/lib/engagementTracker';
import { usePostEngagementTracker } from '@/hooks/usePostEngagementTracker';
import SaveToCollectionMenu from './SaveToCollectionMenu';
import { useLocale } from './LocaleProvider';

const DEFAULT_AVATAR = 'https://randomuser.me/api/portraits/lego/1.jpg';
const COMMENT_LIMIT = 10;

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
  post_type?: 'normal' | 'poll' | 'question';
  poll_options?: { id: number; text: string; order: number; vote_count?: number }[];
  poll_results?: Record<string, number>;
  my_poll_vote?: number | null;
  question_answers_count?: number;
  my_question_answered?: boolean;
  user: {
    id?: number;
    name: string;
    avatar: string;
    verified?: boolean;
    is_following?: boolean;
  };
  time: string;
  text: string;
  mood?: string;
  tags?: string[];
  flair?: string;
  location_name?: string;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  top_reactors?: { id: number; name: string; username?: string; type?: string }[];
  is_saved?: boolean;
  onDeleted?: (id: number) => void;
  onUpdated?: () => void;
  onSavedChange?: (id: number, saved: boolean) => void;
  images?: string[];
  imageAlts?: string[];
  videos?: string[];
  audio?: string;
  description?: string;
  edited_at?: string | null;
  reposts_count?: number;
  my_repost?: number | null;
  repost_of?: EmbeddedPost | null;
  shared_reel?: { id?: number; caption?: string; username?: string; video_url?: string | null } | null;
  thread_count?: number;
  visibility?: 'public' | 'followers';
  reply_control?: 'everyone' | 'followers' | 'nobody';
  vote_score?: number;
  my_vote?: 'boost' | 'dim' | null;
  is_boost_active?: boolean;
  is_profile_pinned?: boolean;
  is_community_pinned?: boolean;
  is_spoiler?: boolean;
  community?: { id?: number; slug?: string; name?: string } | null;
  stats: {
    views: number;
    comments: number;
    shares: number;
  };
}

type EmbeddedPost = {
  id?: number;
  user?: { id?: number; name?: string; avatar?: string };
  text?: string;
  time?: string;
  images?: string[];
};

// Define the Comment type explicitly for reuse
type CommentType = {
  id: number;
  user: { id: number; name: string; avatar: string; };
  text: string;
  time: string;
  editedAt?: string;
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
  replies?: CommentType[];
};

function mapQuotedComment(raw: unknown) {
  if (!raw || typeof raw !== 'object') return undefined;
  const q = raw as Record<string, unknown>;
  const qu = q.user as Parameters<typeof commentUserName>[0] | null;
  return {
    id: q.id as number,
    text: (q.text as string) || '',
    user: {
      id: (qu as { id?: number })?.id ?? 0,
      name: commentUserName(qu),
    },
  };
}

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
    editedAt: (c.edited_at as string) || undefined,
    gifUrl: (c.gif_url as string) || undefined,
    stickerUrl: (c.sticker_url as string) || undefined,
    reactionCounts: countsToEmojiMap(c.reaction_counts as Record<string, number>),
    myReaction: myEmoji,
    isPinned: !!(c.is_pinned ?? c.pin_order),
    pinOrder: (c.pin_order as number | null) ?? null,
    sparkedByAuthor: !!c.sparked_by_author,
    isPostAuthor: !!c.is_post_author,
    resonanceTotal: (c.resonance_total as number) ?? 0,
    voteScore: (c.vote_score as number) ?? 0,
    boostCount: (c.boost_count as number) ?? 0,
    dimCount: (c.dim_count as number) ?? 0,
    myVote: (c.my_vote as 'boost' | 'dim' | null) ?? null,
    quotedComment: mapQuotedComment(c.quoted_comment),
    replies: Array.isArray(c.replies) ? (c.replies as Record<string, unknown>[]).map(mapComment) : [],
  };
}

function PostCard({ variant = 'default', id, post_type = 'normal', poll_options = [], poll_results = {}, my_poll_vote = null, question_answers_count = 0, my_question_answered = false, user, time, text, mood, tags, flair, location_name, reaction_counts, my_reaction, top_reactors = [], is_saved: isSavedProp = false, images, imageAlts = [], videos, audio, description, edited_at = null, reposts_count = 0, my_repost = null, repost_of = null, shared_reel = null, thread_count = 0, visibility = 'public', reply_control = 'everyone', vote_score = 0, my_vote = null, is_boost_active = false, is_profile_pinned = false, is_community_pinned = false, is_spoiler = false, community = null, stats, onDeleted, onUpdated, onSavedChange }: PostCardProps) {
  const { t } = useLocale();
  const [showShare, setShowShare] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const confirm = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [displayText, setDisplayText] = useState(text);
  const [editText, setEditText] = useState(text);
  const [textExpanded, setTextExpanded] = useState(false);
  const [followingAuthor, setFollowingAuthor] = useState(!!user.is_following);
  const [followBusy, setFollowBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<{emoji: string, label: string} | null>(() => {
    if (!my_reaction) return null;
    const found = COSMIC_REACTIONS.find(r => r.type === my_reaction);
    return found ? { emoji: found.emoji, label: found.label } : null;
  });
  const [reactionCounts, setReactionCounts] = useState<{ [emoji: string]: number }>(() => countsToEmojiMap(reaction_counts));
  const [comments, setComments] = useState<CommentType[]>([]);
  const [commentSort, setCommentSort] = useState<'old' | 'new' | 'best' | 'controversial'>('old');
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const commentsOffsetRef = useRef(0);
  const [currentUser, setCurrentUser] = useState<{ id: number; name: string; avatar: string }>({ id: 0, name: 'You', avatar: DEFAULT_AVATAR });
  const [saved, setSaved] = useState(isSavedProp);
  const [voteScore, setVoteScore] = useState(vote_score);
  const [myVote, setMyVote] = useState(my_vote);
  const [voteBusy, setVoteBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(50);
  const [tipBusy, setTipBusy] = useState(false);
  const [tipStatus, setTipStatus] = useState('');
  const [boostActive, setBoostActive] = useState(is_boost_active);
  const [boostBusy, setBoostBusy] = useState(false);
  const [boostError, setBoostError] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharingToStory, setSharingToStory] = useState(false);
  const [sharedToStory, setSharedToStory] = useState(false);
  const [feedHidden, setFeedHidden] = useState(false);
  const [shareCount, setShareCount] = useState(stats.shares);
  const [commentsCount, setCommentsCount] = useState(stats.comments);
  const [viewCount, setViewCount] = useState(stats.views);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [mediaBurst, setMediaBurst] = useState<{
    emoji: string;
    x: number;
    y: number;
    key: number;
  } | null>(null);
  const [pollVote, setPollVote] = useState<number | null>(my_poll_vote ?? null);
  const [pollCounts, setPollCounts] = useState<Record<string, number>>(poll_results || {});
  const [answerText, setAnswerText] = useState('');
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answered, setAnswered] = useState(!!my_question_answered);
  const [answersCount, setAnswersCount] = useState(question_answers_count);
  const [repostCount, setRepostCount] = useState(reposts_count);
  const [reposted, setReposted] = useState(my_repost != null);
  const [repostBusy, setRepostBusy] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [profilePinned, setProfilePinned] = useState(!!is_profile_pinned);
  const [pinBusy, setPinBusy] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadPosts, setThreadPosts] = useState<EmbeddedPost[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [editedAt, setEditedAt] = useState<string | null>(edited_at);
  const [editHistoryOpen, setEditHistoryOpen] = useState(false);
  const [editHistory, setEditHistory] = useState<{ id: number; previous_text: string; edited_at: string }[]>([]);
  const [editHistoryLoading, setEditHistoryLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setFollowingAuthor(!!user.is_following);
  }, [user.is_following, user.id]);

  const flashActionError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError((cur) => (cur === msg ? '' : cur)), 3000);
  };

  const onPostVisible = useCallback(() => {
    if (!id) return;
    apiFetch(`posts/${id}/increment_views/`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.views != null) setViewCount(data.views);
        else setViewCount((v) => v + 1);
      })
      .catch(() => {});
  }, [id]);

  const engagementRef = usePostEngagementTracker(id, user.id, onPostVisible);

  const isPureRepost = !!(repost_of && repost_of.id && !(displayText || '').trim());

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
    setVoteScore(vote_score);
    setMyVote(my_vote);
  }, [vote_score, my_vote]);

  useEffect(() => {
    setBoostActive(is_boost_active);
  }, [is_boost_active]);

  useEffect(() => {
    if (my_reaction) {
      const found = COSMIC_REACTIONS.find((r) => r.type === my_reaction);
      setSelectedReaction(found ? { emoji: found.emoji, label: found.label } : null);
    } else {
      setSelectedReaction(null);
    }
  }, [my_reaction]);

  useEffect(() => {
    setEditedAt(edited_at ?? null);
  }, [edited_at]);

  const toggleEditHistory = async () => {
    if (!id) return;
    if (editHistoryOpen) {
      setEditHistoryOpen(false);
      return;
    }
    setEditHistoryOpen(true);
    if (editHistory.length === 0) {
      setEditHistoryLoading(true);
      try {
        setEditHistory(await fetchPostEdits(id));
      } finally {
        setEditHistoryLoading(false);
      }
    }
  };

  const renderTimestamp = () => (
    <div className="flex items-center gap-2 flex-wrap">
      <RelativeTime date={time} className="text-xs text-text-secondary" />
      {editedAt && (
        <button
          type="button"
          onClick={toggleEditHistory}
          className="post-edited-badge"
          title={t('feed.viewEditHistory')}
        >
          {t('feed.edited')}
        </button>
      )}
    </div>
  );

  const fetchComments = useCallback(async (reset = true) => {
    if (!id) return;
    const offset = reset ? 0 : commentsOffsetRef.current;
    try {
      const res = await apiFetch(
        `comments/?post=${id}&sort=${commentSort}&limit=${COMMENT_LIMIT}&offset=${offset}`,
      );
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.results || []);
        const list = (rawList as Record<string, unknown>[]).map(mapComment);
        setComments((prev) => (reset ? list : [...prev, ...list]));
        commentsOffsetRef.current = offset + list.length;
        if (!Array.isArray(data)) {
          setCommentsHasMore(!!data.has_more);
          if (reset) setCommentsCount(data.count ?? list.length);
        } else {
          setCommentsHasMore(false);
          if (reset) setCommentsCount(list.length);
        }
      }
    } catch {
      /* keep existing comments on error */
      if (!reset) flashActionError('Could not load more comments.');
    }
  }, [id, commentSort]);

  const loadMoreComments = useCallback(() => fetchComments(false), [fetchComments]);

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

  usePostCommentsWebSocket({
    postId: id ?? null,
    open: commentsOpen,
    onUpdate: (payload) => {
      if (payload?.action === 'created' && payload.comment) {
        const created = mapComment(payload.comment);
        setComments((prev) => {
          if (prev.some((c) => c.id === created.id)) return prev;
          return [...prev, created];
        });
        setCommentsCount((c) => c + 1);
        return;
      }
      void fetchComments(true);
    },
  });

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
          if (user.id) {
            trackEngagement({
              content_type: 'post',
              content_id: id,
              author_id: user.id,
              event_type: 'like',
            });
          }
        } else {
          setSelectedReaction(null);
        }
      } else {
        setReactionCounts(prevCounts);
        setSelectedReaction(prevSelected);
        flashActionError('Could not react to this post.');
      }
    } catch {
      setReactionCounts(prevCounts);
      setSelectedReaction(prevSelected);
      flashActionError('Could not react to this post.');
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
    const me = getUser();
    const tempId = -Date.now();
    const optimistic = mapComment({
      id: tempId,
      text: data.text?.trim() || '',
      gif_url: data.gifUrl || '',
      sticker_url: data.stickerUrl || '',
      created_at: new Date().toISOString(),
      user: me
        ? { id: me.id, username: me.username, first_name: me.first_name, last_name: me.last_name, avatar: me.avatar }
        : { id: 0, username: 'you' },
      replies: [],
    });
    setComments((prev) => [...prev, optimistic]);
    setCommentsCount((c) => c + 1);
    try {
      const res = await apiFetchJson('comments/', { method: 'POST', json: commentPayload(data) });
      if (res.ok) {
        const created = mapComment((await res.json()) as Record<string, unknown>);
        setComments((prev) => prev.map((c) => (c.id === tempId ? created : c)));
        if (user.id) {
          trackEngagement({
            content_type: 'post',
            content_id: id,
            author_id: user.id,
            event_type: 'comment',
          });
        }
      } else {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setCommentsCount((c) => Math.max(0, c - 1));
        flashActionError('Could not post your comment.');
      }
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setCommentsCount((c) => Math.max(0, c - 1));
      flashActionError('Could not post your comment.');
    }
  };

  const handleReply = async (
    parentId: number,
    data: { text: string; gifUrl?: string; stickerUrl?: string; quotedCommentId?: number },
  ) => {
    if (!id || (!data.text?.trim() && !data.gifUrl && !data.stickerUrl)) return;
    try {
      const payload: Record<string, unknown> = { ...commentPayload(data), parent: parentId };
      if (data.quotedCommentId) payload.quoted_comment = data.quotedCommentId;
      const res = await apiFetchJson('comments/', { method: 'POST', json: payload });
      if (!res.ok) throw new Error('failed');
      await fetchComments();
    } catch {
      flashActionError('Could not post your reply.');
    }
  };

  const handlePinComment = async (commentId: number) => {
    try {
      const res = await apiFetchJson(`comments/${commentId}/pin/`, { method: 'POST', json: {} });
      if (res.ok) await fetchComments();
      else flashActionError('Could not pin this comment.');
    } catch {
      flashActionError('Could not pin this comment.');
    }
  };

  const handleSparkComment = async (commentId: number) => {
    try {
      const res = await apiFetchJson(`comments/${commentId}/spark/`, { method: 'POST', json: {} });
      if (res.ok) await fetchComments();
      else flashActionError('Could not spark this comment.');
    } catch {
      flashActionError('Could not spark this comment.');
    }
  };

  const handleVotePost = async (direction: 'boost' | 'dim') => {
    if (!id || voteBusy) return;
    const nextVote = myVote === direction ? null : direction;
    setVoteBusy(true);
    const prevScore = voteScore;
    const prevVote = myVote;
    // Optimistic update
    let delta = 0;
    if (prevVote === 'boost') delta -= 1;
    if (prevVote === 'dim') delta += 1;
    if (nextVote === 'boost') delta += 1;
    if (nextVote === 'dim') delta -= 1;
    setVoteScore(prevScore + delta);
    setMyVote(nextVote);
    try {
      const res = await apiFetchJson(`posts/${id}/vote/`, {
        method: 'POST',
        json: { vote: nextVote },
      });
      if (res.ok) {
        const data = await res.json();
        setVoteScore(data.vote_score);
        setMyVote(data.my_vote);
      } else {
        setVoteScore(prevScore);
        setMyVote(prevVote);
        flashActionError('Could not register your vote.');
      }
    } catch {
      setVoteScore(prevScore);
      setMyVote(prevVote);
      flashActionError('Could not register your vote.');
    } finally {
      setVoteBusy(false);
    }
  };

  const handleSendTip = async () => {
    if (!id || !user.id || tipBusy || tipAmount <= 0) return;
    setTipBusy(true);
    setTipStatus('');
    try {
      const res = await sendTip(user.id, tipAmount, { postId: id });
      if (res.ok) {
        setTipStatus(t('tip.sent', { amount: String(tipAmount) }));
        setTimeout(() => {
          setTipOpen(false);
          setTipStatus('');
        }, 1500);
      } else {
        setTipStatus(res.error);
      }
    } catch {
      setTipStatus(t('tip.error'));
    } finally {
      setTipBusy(false);
    }
  };

  const handleVoteComment = async (commentId: number, vote: 'boost' | 'dim' | null) => {
    try {
      const res = await apiFetchJson(`comments/${commentId}/vote/`, {
        method: 'POST',
        json: { vote },
      });
      if (res.ok) await fetchComments();
      else flashActionError('Could not register your vote.');
    } catch {
      flashActionError('Could not register your vote.');
    }
  };

  const handleTranslateComment = async (commentId: number, lang: string) => {
    try {
      const res = await apiFetchJson(`comments/${commentId}/translate/`, {
        method: 'POST',
        json: { lang },
      });
      if (res.ok) return (await res.json()) as { text: string };
      flashActionError('Could not translate this comment.');
    } catch {
      flashActionError('Could not translate this comment.');
    }
    return null;
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
      else flashActionError('Could not react to this comment.');
    } catch {
      flashActionError('Could not react to this comment.');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const res = await apiFetchJson(`comments/${commentId}/`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      await fetchComments();
    } catch {
      flashActionError('Could not delete this comment.');
    }
  };

  const handleEditComment = async (commentId: number, newText: string) => {
    try {
      const res = await apiFetchJson(`comments/${commentId}/`, {
        method: 'PATCH',
        json: { text: newText },
      });
      if (!res.ok) throw new Error('failed');
      await fetchComments();
    } catch {
      flashActionError('Could not edit this comment.');
    }
  };

  const recordShare = async (channel: ShareChannel = 'unknown') => {
    if (!id) return;
    try {
      const data = await recordContentShare('post', id, channel);
      if (data?.shares_count != null) setShareCount(data.shares_count);
      if (user.id) {
        trackEngagement({
          content_type: 'post',
          content_id: id,
          author_id: user.id,
          event_type: 'share',
          metadata: { channel },
        });
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setPollVote(my_poll_vote ?? null);
    setPollCounts(poll_results || {});
    setAnswered(!!my_question_answered);
    setAnswersCount(question_answers_count);
  }, [my_poll_vote, poll_results, my_question_answered, question_answers_count]);

  const handlePollVote = async (optionId: number) => {
    if (!id || post_type !== 'poll') return;
    const isUnvote = pollVote === optionId;
    setPollVote(isUnvote ? null : optionId);
    setPollCounts((prev) => {
      const next = { ...prev };
      if (isUnvote) {
        next[String(optionId)] = Math.max(0, (next[String(optionId)] || 0) - 1);
      } else {
        if (pollVote != null) {
          next[String(pollVote)] = Math.max(0, (next[String(pollVote)] || 0) - 1);
        }
        next[String(optionId)] = (next[String(optionId)] || 0) + 1;
      }
      return next;
    });
    try {
      const res = await apiFetchJson(`posts/${id}/poll_vote/`, {
        method: 'POST',
        json: { option_id: optionId },
      });
      if (res.ok) {
        const data = await res.json();
        setPollVote(data.my_poll_vote ?? null);
        setPollCounts(data.poll_results || {});
      } else {
        setPollVote(my_poll_vote ?? null);
        setPollCounts(poll_results || {});
        flashActionError('Could not register your poll vote.');
      }
    } catch {
      setPollVote(my_poll_vote ?? null);
      setPollCounts(poll_results || {});
      flashActionError('Could not register your poll vote.');
    }
  };

  const handleAnswer = async () => {
    if (!id || post_type !== 'question' || !answerText.trim() || answered) return;
    setAnswerBusy(true);
    try {
      const res = await apiFetchJson(`posts/${id}/answer/`, {
        method: 'POST',
        json: { text: answerText.trim() },
      });
      if (res.ok) {
        setAnswered(true);
        setAnswersCount((c) => c + 1);
        setAnswerText('');
      } else {
        flashActionError('Could not post your answer.');
      }
    } catch {
      flashActionError('Could not post your answer.');
    } finally {
      setAnswerBusy(false);
    }
  };

  const renderPoll = () => {
    if (post_type !== 'poll' || !poll_options?.length) return null;
    const total = Object.values(pollCounts).reduce((sum, c) => sum + (c || 0), 0);
    return (
      <div className="space-y-2 my-3">
        {poll_options.map((option) => {
          const count = pollCounts[String(option.id)] || 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          const isVoted = pollVote === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handlePollVote(option.id)}
              className={`relative w-full rounded-xl px-4 py-2.5 text-left border transition overflow-hidden ${isVoted ? 'border-vault bg-vault/10' : 'border-surface hover:border-vault/50'}`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-vault/10 transition-all"
                style={{ width: `${pct}%` }}
              />
              <span className="relative z-10 flex items-center justify-between text-sm">
                <span className="font-medium text-text">{option.text}</span>
                <span className="text-text-secondary tabular-nums">{pct}%</span>
              </span>
            </button>
          );
        })}
        <p className="text-xs text-text-secondary">{total} vote{total === 1 ? '' : 's'}</p>
      </div>
    );
  };

  const renderQuestion = () => {
    if (post_type !== 'question') return null;
    return (
      <div className="space-y-2 my-3">
        {answered ? (
          <p className="text-sm text-text-secondary">You answered. {answersCount} answer{answersCount === 1 ? '' : 's'} so far.</p>
        ) : (
          <>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Type your answer…"
              rows={2}
              className="w-full rounded-xl border border-surface bg-transparent p-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-bazaar resize-y"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAnswer}
                disabled={answerBusy || !answerText.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-tr from-vault to-bazaar disabled:opacity-50"
              >
                {answerBusy ? 'Submitting…' : 'Submit answer'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const isOwner = user.id != null && currentUser.id !== 0 && currentUser.id === user.id;

  const handleDeletePost = async () => {
    if (!id || busy) return;
    if (!(await confirm('Delete this post permanently?', { danger: true, confirmLabel: 'Delete' }))) return;
    setBusy(true);
    try {
      const res = await apiFetchJson(`posts/${id}/`, { method: 'DELETE' });
      if (res.ok) {
        setMenuOpen(false);
        onDeleted?.(id);
      } else {
        flashActionError('Could not delete this post.');
      }
    } catch {
      flashActionError('Could not delete this post.');
    } finally {
      setBusy(false);
    }
  };

  const handleBoostPost = async () => {
    if (!id || boostBusy || boostActive) return;
    if (!(await confirm(t('boost.confirm', { cost: '200' }), { confirmLabel: 'Boost' }))) return;
    setBoostBusy(true);
    setBoostError('');
    try {
      const res = await apiFetchJson(`posts/${id}/boost-promote/`, { method: 'POST', json: {} });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setBoostActive(true);
        setMenuOpen(false);
      } else {
        setBoostError(data.error || t('boost.error'));
      }
    } catch {
      setBoostError(t('boost.error'));
    } finally {
      setBoostBusy(false);
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
        setEditedAt(new Date().toISOString());
        setEditHistory([]);
        setEditHistoryOpen(false);
        setIsEditing(false);
        onUpdated?.();
      } else {
        flashActionError('Could not save your changes.');
      }
    } catch {
      flashActionError('Could not save your changes.');
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
        if (next && user.id) {
          trackEngagement({
            content_type: 'post',
            content_id: id,
            author_id: user.id,
            event_type: 'save',
          });
        }
      } else {
        flashActionError('Could not update saved status.');
      }
    } catch {
      flashActionError('Could not update saved status.');
    } finally {
      setSaveBusy(false);
    }
  };

  const handleReportPost = async () => {
    if (!id || !getUser()) return;
    if (!(await confirm('Report this post to moderators?', { confirmLabel: 'Report' }))) return;
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
      flashActionError('Could not submit the report.');
    }
  };

  const handleFeedFeedback = async (type: 'not_interested' | 'see_less' | 'hide_post') => {
    if (!id) return;
    setMenuOpen(false);
    const ok = await sendFeedFeedback(id, type);
    if (ok) {
      if (user.id && (type === 'not_interested' || type === 'hide_post')) {
        trackEngagement({
          content_type: 'post',
          content_id: id,
          author_id: user.id,
          event_type: 'hide',
          metadata: { feedback: type },
        });
      }
      setFeedHidden(true);
    }
  };

  const handleFollowAuthor = async () => {
    if (!user.id || followBusy || currentUser.id === 0 || currentUser.id === user.id) return;
    setFollowBusy(true);
    try {
      const res = await apiFetchJson('users/follow/', {
        method: 'POST',
        json: { following_id: user.id },
      });
      if (res.ok) {
        const data = await res.json().catch(() => null) as { is_following?: boolean } | null;
        if (typeof data?.is_following === 'boolean') setFollowingAuthor(data.is_following);
        else setFollowingAuthor((v) => !v);
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const handleReportComment = async (commentId: number, snippet: string) => {
    if (!id || !getUser()) return;
    if (!(await confirm('Report this comment to moderators?', { confirmLabel: 'Report' }))) return;
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
      flashActionError('Could not submit the report.');
    }
  };

  const handleCopyLink = async () => {
    if (!id || typeof window === 'undefined') return;
    const url = postShareUrl(id, 'copy');
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      void recordShare('copy');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      flashActionError('Could not copy the link.');
    }
  };

  const handleShareToStory = async () => {
    if (!id || !images?.[0] || sharingToStory) return;
    setSharingToStory(true);
    try {
      const ok = await sharePostToStory(id, images[0]);
      if (ok) {
        setSharedToStory(true);
        setTimeout(() => setSharedToStory(false), 2200);
      }
    } finally {
      setSharingToStory(false);
    }
  };

  const handleRepost = async () => {
    if (!id || repostBusy) return;
    const wasReposted = reposted;
    setReposted(!wasReposted);
    setRepostCount((c) => Math.max(0, c + (wasReposted ? -1 : 1)));
    setRepostBusy(true);
    try {
      const result = await repostPost(id);
      if (result) {
        setReposted(!!result.reposted);
        if (typeof result.reposts_count === 'number') setRepostCount(result.reposts_count);
        onUpdated?.();
      } else {
        setReposted(wasReposted);
        setRepostCount((c) => Math.max(0, c + (wasReposted ? 1 : -1)));
      }
    } catch {
      setReposted(wasReposted);
      setRepostCount((c) => Math.max(0, c + (wasReposted ? 1 : -1)));
    } finally {
      setRepostBusy(false);
    }
  };

  const handleQuoteSubmit = async (quoteText: string) => {
    if (!id || repostBusy || !quoteText.trim()) return;
    setRepostBusy(true);
    try {
      const result = await repostPost(id, quoteText.trim());
      if (result?.quote) {
        setRepostCount((c) => c + 1);
        setShowQuote(false);
        onUpdated?.();
      } else {
        flashActionError('Could not post your quote.');
      }
    } catch {
      flashActionError('Could not post your quote.');
    } finally {
      setRepostBusy(false);
    }
  };

  const handlePinProfile = async () => {
    if (!id || pinBusy) return;
    setPinBusy(true);
    setMenuOpen(false);
    try {
      const result = await pinProfilePost(id);
      if (!result) {
        flashActionError(t('signal.pinFail'));
        return;
      }
      if (result.error) {
        flashActionError(result.error);
        return;
      }
      setProfilePinned(!!result.is_profile_pinned);
      onUpdated?.();
    } finally {
      setPinBusy(false);
    }
  };

  const toggleThread = async () => {
    if (!id) return;
    if (threadOpen) {
      setThreadOpen(false);
      return;
    }
    setThreadOpen(true);
    if (threadPosts.length === 0) {
      setThreadLoading(true);
      try {
        const chain = await fetchThread(id);
        setThreadPosts(chain.filter((p) => p.id !== id) as EmbeddedPost[]);
      } finally {
        setThreadLoading(false);
      }
    }
  };

  const openShare = () => {
    setShowShare(true);
  };
  const shareUrl = id ? postShareUrl(id) : '';

  // استخراج أول رابط من النص
  const urlMatch = displayText.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
  const firstUrl = urlMatch ? urlMatch[0] : null;

  if (feedHidden) return null;

  return (
    <motion.div
      ref={engagementRef}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`relative ${variant === 'premium' ? 'post-card-premium' : 'card'} post-card-surface p-6 mb-0 hover:shadow-xl transition-shadow duration-300`}
    >
      {actionError && (
        <p className="absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 shadow-lg">
          {actionError}
        </p>
      )}
      {isPureRepost && (
        <div className="post-repost-label">
          <ArrowPathRoundedSquareIcon className="h-4 w-4" strokeWidth={1.75} />
          <span>{user.name} {t('feed.repostedLabel')}</span>
        </div>
      )}
      <div className="post-card__header mb-4">
        {user.id ? (
          <Link href={`/profile/${user.id}`} className="post-card__author group">
            <Image src={user.avatar || DEFAULT_AVATAR} alt={`${user.name} avatar`} width={40} height={40} className="post-card__avatar" unoptimized />
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-semibold text-text group-hover:underline">
                {user.name}
                {user.verified && <CheckBadgeIcon className="h-4 w-4 shrink-0 text-vault" aria-label="Verified" />}
                {flair && (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                    {flair}
                  </span>
                )}
              </div>
              {renderTimestamp()}
              {community?.slug && (
                <Link
                  href={`/communities/${community.slug}`}
                  className="mt-0.5 block text-xs font-semibold text-lab hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  c/{community.name || community.slug}
                  {is_community_pinned ? ' · 📌' : ''}
                </Link>
              )}
            </div>
          </Link>
        ) : (
          <div className="post-card__author">
            <Image src={user.avatar || DEFAULT_AVATAR} alt={`${user.name} avatar`} width={40} height={40} className="post-card__avatar" unoptimized />
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-semibold text-text">
                {user.name}
                {user.verified && <CheckBadgeIcon className="h-4 w-4 shrink-0 text-vault" aria-label="Verified" />}
                {flair && (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                    {flair}
                  </span>
                )}
              </div>
              {renderTimestamp()}
              {community?.slug && (
                <Link
                  href={`/communities/${community.slug}`}
                  className="mt-0.5 block text-xs font-semibold text-lab hover:underline"
                >
                  c/{community.name || community.slug}
                  {is_community_pinned ? ' · 📌' : ''}
                </Link>
              )}
            </div>
          </div>
        )}
        {!isOwner && user.id && currentUser.id !== 0 && !followingAuthor ? (
          <button
            type="button"
            onClick={() => void handleFollowAuthor()}
            disabled={followBusy}
            className="post-card__follow"
          >
            <UserPlusIcon className="h-4 w-4" strokeWidth={2} />
            {t('feed.follow')}
          </button>
        ) : null}
        <div className="post-card__actions">
          {boostActive && (
            <span className="flex items-center gap-1 rounded-full bg-vault/10 px-2 py-0.5 text-xs font-semibold text-vault">
              <RocketLaunchIcon className="h-3.5 w-3.5" strokeWidth={2} />
              {t('boost.badge')}
            </span>
          )}
          {id && (
            <>
              <button
                type="button"
                onClick={handleCopyLink}
                className="icon-only p-2"
                title={linkCopied ? 'Copied!' : 'Copy post link'}
                aria-label="Copy post link"
              >
                <LinkIcon className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={handleToggleSave}
                disabled={saveBusy}
                className="icon-only p-2"
                title={saved ? 'Remove from saved' : 'Save post'}
                aria-label={saved ? 'Remove from saved' : 'Save post'}
              >
                {saved ? (
                  <BookmarkSolid className="h-5 w-5 text-vault" />
                ) : (
                  <BookmarkIcon className="h-5 w-5" strokeWidth={1.75} />
                )}
              </button>
              <SaveToCollectionMenu
                postId={id}
                onSaved={(s) => { setSaved(s); onSavedChange?.(id, s); }}
              />
              {images && images.length > 0 && (
                <button
                  type="button"
                  onClick={handleShareToStory}
                  disabled={sharingToStory}
                  className="icon-only p-2"
                  title={sharedToStory ? 'Shared to your story!' : 'Share to Story'}
                  aria-label="Share to Story"
                >
                  <ArrowUpOnSquareIcon className="h-5 w-5" strokeWidth={1.75} />
                </button>
              )}
            </>
          )}
          {sharedToStory && (
            <span className="text-xs text-bazaar font-medium">Shared!</span>
          )}
          {visibility === 'followers' ? (
            <span className="post-badge" title={t('feed.limitedBadge')}>
              <LockClosedIcon className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">{t('feed.limitedBadge')}</span>
            </span>
          ) : (
            <span className="post-badge post-badge--public" title={t('feed.publicAudience')}>
              <GlobeAltIcon className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">{t('feed.publicAudience')}</span>
            </span>
          )}
          {reply_control !== 'everyone' && (
            <span className="post-badge" title={t('feed.replyLimited')}>
              <NoSymbolIcon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          )}
          {profilePinned && (
            <span className="post-badge post-badge--pinned" title={t('signal.pinned')}>
              <MapPinSolid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('signal.pinned')}</span>
            </span>
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
                className="icon-only p-2"
                title="Post options"
              >
                <EllipsisHorizontalIcon className="h-6 w-6" strokeWidth={1.5} />
              </button>
              {menuOpen && (
                <div className="post-card__menu absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-2xl">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setEditText(displayText); setIsEditing(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left"
                  >
                    <PencilSquareIcon className="h-4 w-4" strokeWidth={1.75} /> Edit
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handlePinProfile()}
                    disabled={pinBusy}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left disabled:opacity-60"
                  >
                    <MapPinIcon className="h-4 w-4" strokeWidth={1.75} />
                    {profilePinned ? t('signal.unpin') : t('signal.pin')}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleBoostPost()}
                    disabled={boostBusy || boostActive}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left disabled:opacity-60"
                  >
                    <RocketLaunchIcon className="h-4 w-4" strokeWidth={1.75} />
                    {boostActive ? t('boost.active') : t('boost.action')}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleDeletePost}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm post-card__menu-danger text-left"
                  >
                    <TrashIcon className="h-4 w-4" strokeWidth={1.75} /> Delete
                  </button>
                </div>
              )}
              {boostError && (
                <p className="absolute right-0 top-9 mt-1 w-48 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500 z-20">
                  {boostError}
                </p>
              )}
            </div>
          )}
          {!isOwner && id && currentUser.id !== 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                className="icon-only p-2"
                title="Report post"
              >
                <EllipsisHorizontalIcon className="h-6 w-6" strokeWidth={1.5} />
              </button>
              {menuOpen && (
                <div className="post-card__menu absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-2xl">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleFeedFeedback('hide_post')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left"
                  >
                    <EyeSlashIcon className="h-4 w-4" strokeWidth={1.75} /> {t('social.hidePost')}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleFeedFeedback('not_interested')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left"
                  >
                    <NoSymbolIcon className="h-4 w-4" strokeWidth={1.75} /> {t('social.notInterested')}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleFeedFeedback('see_less')}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left"
                  >
                    {t('social.seeLess')}
                  </button>
                  {!followingAuthor && user.id ? (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setMenuOpen(false); void handleFollowAuthor(); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left"
                    >
                      <UserPlusIcon className="h-4 w-4" strokeWidth={1.75} /> {t('feed.follow')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleReportPost}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-text hover:bg-surface text-left"
                  >
                    <FlagIcon className="h-4 w-4" strokeWidth={1.75} /> {t('social.report')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="post-card__body mb-4">
        {is_spoiler && !spoilerRevealed && !isEditing ? (
          <button
            type="button"
            onClick={() => setSpoilerRevealed(true)}
            className="w-full rounded-xl border border-dashed border-border bg-surface/50 px-4 py-6 text-sm font-semibold text-text-secondary"
          >
            Spoiler — tap to reveal
          </button>
        ) : isEditing ? (
          <div className="mb-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="cosmic-textarea resize-y"
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
        <div className="post-card__text-block mb-2">
          <p className="post-card__text whitespace-pre-wrap">
            {(() => {
              const limit = 280;
              const needsMore = displayText.length > limit;
              const shown = !needsMore || textExpanded
                ? displayText
                : `${displayText.slice(0, limit).replace(/\s+\S*$/, '')}…`;
              return shown;
            })()}
          </p>
          {displayText.length > 280 ? (
            <button
              type="button"
              className="post-card__see-more"
              onClick={() => setTextExpanded((v) => !v)}
            >
              {textExpanded ? t('feed.seeLess') : t('feed.seeMore')}
            </button>
          ) : null}
          {location_name ? (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary">
              <MapPinSolid className="h-3.5 w-3.5" />
              {location_name}
            </p>
          ) : null}
        </div>
        )}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/tag/${encodeURIComponent(tag)}`}
                className="post-card__tag"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
        {firstUrl && <LinkPreview url={firstUrl} />}
        {renderPoll()}
        {renderQuestion()}
        {hasMedia && (
          <div className="post-media-gallery-wrap">
            <PostMediaGallery
              images={images}
              videos={videos}
              imageAlts={imageAlts}
              onDoubleTap={(coords) => {
                const emoji = selectedReaction?.emoji || '✨';
                void handleReaction(emoji);
                hapticReaction('medium');
                setMediaBurst({ ...coords, emoji, key: Date.now() });
              }}
            />
            {mediaBurst && (
              <ReactionBurst
                key={mediaBurst.key}
                emoji={mediaBurst.emoji}
                x={mediaBurst.x}
                y={mediaBurst.y}
                onDone={() => setMediaBurst(null)}
              />
            )}
          </div>
        )}
        {editHistoryOpen && (
          <div className="post-edit-history">
            <p className="post-edit-history__title">{t('feed.viewEditHistory')}</p>
            {editHistoryLoading && (
              <p className="post-edit-history__loading">{t('common.loading')}</p>
            )}
            {!editHistoryLoading && editHistory.length === 0 && (
              <p className="post-edit-history__empty">{t('feed.noEditHistory')}</p>
            )}
            {!editHistoryLoading && editHistory.map((entry) => (
              <div key={entry.id} className="post-edit-history__item">
                <RelativeTime date={entry.edited_at} className="post-edit-history__time" />
                <p className="post-edit-history__text">{entry.previous_text}</p>
              </div>
            ))}
          </div>
        )}
        {/* عرض الصوت */}
        {audio && (
          <div className="post-card__audio">
            <audio controls preload="none">
              <source src={mediaUrl(audio)} />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}
        {/* عرض description */}
        {description && (
          <div className="text-text-secondary text-sm mt-2 whitespace-pre-line">{description}</div>
        )}
        {/* Embedded original for quote / repost */}
        {repost_of && repost_of.id && (
          <div className="mt-3">
            <QuotedPost
              id={repost_of.id}
              user={repost_of.user}
              text={repost_of.text}
              time={repost_of.time}
              images={repost_of.images}
            />
          </div>
        )}
        {shared_reel && shared_reel.id && (
          <div className="mt-3">
            <QuotedReel
              id={shared_reel.id}
              caption={shared_reel.caption}
              username={shared_reel.username}
              videoUrl={shared_reel.video_url}
            />
          </div>
        )}
      </div>
      {thread_count > 1 && (
        <div className="post-thread">
          <button type="button" onClick={toggleThread} className="post-thread__toggle">
            <QueueListIcon className="h-5 w-5" strokeWidth={1.75} />
            {threadOpen
              ? t('feed.hideThread')
              : `${t('feed.viewThread')} · ${thread_count}`}
          </button>
          {threadOpen && (
            <div className="post-thread__chain">
              {threadLoading && <p className="post-thread__loading">{t('common.loading')}</p>}
              {!threadLoading && threadPosts.map((p, i) => (
                <div key={p.id || i} className="post-thread__item">
                  <span className="post-thread__seq">{i + 2}</span>
                  <QuotedPost id={p.id} user={p.user} text={p.text} time={p.time} images={p.images} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {id && (
        <div className="post-card__votebar" aria-label="Post votes">
          <button
            type="button"
            disabled={voteBusy}
            onClick={() => void handleVotePost('boost')}
            aria-label="Upvote"
            className={`icon-only p-1 post-card__vote-up${myVote === 'boost' ? ' is-active' : ''}`}
          >
            <ChevronUpIcon className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <span
            className={`text-sm font-semibold min-w-[1.5rem] text-center post-card__vote-score${
              voteScore > 0 ? ' is-up' : voteScore < 0 ? ' is-down' : ' text-text-secondary'
            }`}
          >
            {voteScore}
          </span>
          <button
            type="button"
            disabled={voteBusy}
            onClick={() => void handleVotePost('dim')}
            aria-label="Downvote"
            className={`icon-only p-1 post-card__vote-down${myVote === 'dim' ? ' is-active' : ''}`}
          >
            <ChevronDownIcon className="h-5 w-5" strokeWidth={1.75} />
          </button>
          {!isOwner && user.id ? (
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setTipOpen((o) => !o)}
                aria-label={t('tip.send')}
                className="post-card__tip-trigger"
              >
                <GiftIcon className="h-5 w-5" strokeWidth={1.75} />
                {t('tip.send')}
              </button>
              {tipOpen && (
                <div className="post-card__tip-panel absolute left-0 top-10 z-30 w-56 rounded-2xl p-3">
                  <p className="mb-2 text-xs font-semibold text-text">
                    {t('tip.pickAmount')}
                  </p>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[10, 50, 100, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTipAmount(amt)}
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          tipAmount === amt ? 'bg-vault text-white' : 'bg-surface text-text-secondary'
                        }`}
                      >
                        {amt} ✨
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={tipAmount}
                    onChange={(e) => setTipAmount(Math.max(1, parseInt(e.target.value, 10) || 0))}
                    className="cosmic-input mb-2 text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setTipOpen(false)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={tipBusy}
                      onClick={() => void handleSendTip()}
                      className="rounded-lg bg-vault px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {tipBusy ? t('common.loading') : t('tip.send')}
                    </button>
                  </div>
                  {tipStatus && (
                    <p className="mt-2 text-xs text-text-secondary">{tipStatus}</p>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
      <PostEngagementBar
        onReaction={handleReaction}
        selectedReaction={selectedReaction?.emoji}
        reactionCounts={reactionCounts}
        topReactors={top_reactors}
        postId={id}
        views={viewCount}
        commentsCount={commentsCount}
        sharesCount={shareCount}
        repostsCount={repostCount}
        reposted={reposted}
        commentsOpen={commentsOpen}
        onCommentsToggle={() => setCommentsOpen((o) => !o)}
        onShare={openShare}
        onRepost={id ? handleRepost : undefined}
        onQuote={id ? () => setShowQuote(true) : undefined}
      />
      <AnimatePresence>
        {showShare && id && shareUrl && (
          <ShareCosmicPanel
            postId={id}
            postUrl={shareUrl}
            postTitle={displayText.slice(0, 120)}
            shareCount={shareCount}
            contentType="post"
            authorName={user.name}
            storyMediaUrl={images?.[0] || null}
            onShareToStory={
              images?.[0]
                ? async () => {
                    if (!id || !images[0]) return false;
                    return sharePostToStory(id, images[0]);
                  }
                : undefined
            }
            onClose={() => setShowShare(false)}
            onRecordShare={recordShare}
            dmMessage={displayText.slice(0, 120)}
          />
        )}
        {showQuote && id && (
          <QuoteComposer
            original={
              isPureRepost && repost_of
                ? repost_of
                : { id, user: { id: user.id, name: user.name, avatar: user.avatar }, text: displayText, time, images }
            }
            busy={repostBusy}
            onSubmit={handleQuoteSubmit}
            onClose={() => setShowQuote(false)}
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
        onPinComment={handlePinComment}
        onSparkComment={handleSparkComment}
        onVoteComment={handleVoteComment}
        onTranslateComment={handleTranslateComment}
        user={{ id: currentUser.id, name: currentUser.name, avatar: currentUser.avatar }}
        postOwner={{ id: user.id ?? 0, name: user.name }}
        sort={commentSort}
        onSortChange={setCommentSort}
        hasMore={commentsHasMore}
        onLoadMore={loadMoreComments}
        replyLocked={reply_control === 'nobody' && !isOwner}
      />
    </motion.div>
  );
}

export default memo(PostCard); 
