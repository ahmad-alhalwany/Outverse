'use client';

import Image from 'next/image';


import { useCallback, useEffect, useRef, useState } from 'react';

import Link from 'next/link';

import { motion, AnimatePresence } from 'framer-motion';

import {
  ArrowPathRoundedSquareIcon,
  BookmarkIcon,
  ChatBubbleLeftIcon,
  EyeIcon,
  FlagIcon,
  PencilSquareIcon,
  RectangleStackIcon,
  ScissorsIcon,
  ShareIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  TrashIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';

import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import {
  countsToEmojiMap,
  COSMIC_REACTIONS,
  EMOJI_BY_REACTION_TYPE,
  REACTION_TYPE_BY_EMOJI,
  hapticReaction,
  type ReactionType,
} from '@/lib/reactions';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { reelPageUrl } from '@/lib/fetchReel';
import { recordContentShare } from '@/lib/shareApi';
import type { ShareChannel } from '@/lib/shareUtils';
import { shareReelToStory } from '@/lib/storyUtils';
import {
  enforceTrimLoop,
  musicTrimFromReel,
  trimmedAudioTime,
} from '@/lib/reelMusicTrim';
import {
  REEL_FILTER_META,
  REEL_MOOD_META,
  reelAuthorName,
  reelMusicPlaybackUrl,
  type ReelFilter,
  type ReelItem,
} from '@/lib/reelTypes';

import RelativeTime from '@/components/RelativeTime';
import MentionText from '@/components/MentionText';

import { useLocale } from '../LocaleProvider';

import ShareCosmicPanel from '../ShareCosmicPanel';
import PostReactions from '../PostReactions';
import ReelCommentsSheet from './ReelCommentsSheet';
import ReelRemixBadge from './ReelRemixBadge';
import ReelOverlays, { useReelClock } from './ReelOverlays';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import ReportDialog, { type ReportReason } from '@/components/ReportDialog';

interface ReelLikeResult {
  liked: boolean;
  likes_count: number;
  reaction_counts?: Record<string, number>;
  my_reaction?: ReactionType | null;
}

interface ReelSlideProps {
  reel: ReelItem;
  active: boolean;
  onLike: (id: number, reaction: ReactionType) => Promise<ReelLikeResult | null>;
  onView: (id: number) => void;
  onDeleted?: () => void;
  onSavedChange?: (id: number, saved: boolean) => void;
  onDimmed?: (id: number) => void;
}

export default function ReelSlide({ reel, active, onLike, onView, onDeleted, onSavedChange, onDimmed }: ReelSlideProps) {

  const { t } = useLocale();

  const videoRef = useRef<HTMLVideoElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const [liked, setLiked] = useState(reel.is_liked);
  const [likes, setLikes] = useState(reel.likes_count);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(() =>
    countsToEmojiMap(reel.reaction_counts),
  );
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(() =>
    reel.my_reaction ? EMOJI_BY_REACTION_TYPE[reel.my_reaction] : undefined,
  );
  const [burstEmoji, setBurstEmoji] = useState('✨');

  const [commentsCount, setCommentsCount] = useState(reel.comments_count);
  const [shares, setShares] = useState(reel.shares_count);
  const [saved, setSaved] = useState(Boolean(reel.is_saved));

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [muted, setMuted] = useState(true);

  const [burst, setBurst] = useState(0);

  const [likePop, setLikePop] = useState(false);

  const [progress, setProgress] = useState(0);

  const [paused, setPaused] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(reel.caption || '');
  const [tagsDraft, setTagsDraft] = useState((reel.tags || []).join(', '));
  const [filterDraft, setFilterDraft] = useState<ReelFilter>((reel.filter_style || 'none') as ReelFilter);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [actionError, setActionError] = useState('');

  const flashActionError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError((cur) => (cur === msg ? '' : cur)), 3000);
  };

  const viewedRef = useRef(false);
  const progressFrameRef = useRef<number | null>(null);

  const lastTap = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speeding = useRef(false);
  const dwellSent = useRef<Set<string>>(new Set());
  const currentTime = useReelClock(active, videoRef);

  const mood = REEL_MOOD_META[reel.mood] || REEL_MOOD_META.cosmic;

  const filterKey = (reel.filter_style || 'none') as ReelFilter;

  const filterMeta = REEL_FILTER_META[filterKey] || REEL_FILTER_META.none;

  const avatar = reel.user.avatar ? mediaUrl(reel.user.avatar) : '';

  const musicUrl = reelMusicPlaybackUrl(reel);
  const hasOverlayMusic = !!musicUrl;
  const musicTrim = musicTrimFromReel(reel);
  const me = useAuthUser();
  const confirm = useConfirm();
  const isOwner = me?.id === reel.user.id;

  useEffect(() => {
    if (!active || !me) return;
    const sec = currentTime;
    const mark = sec >= 10 ? '10' : sec >= 3 ? '3' : null;
    if (!mark || dwellSent.current.has(mark)) return;
    dwellSent.current.add(mark);
    void apiFetchJson(`reels/${reel.id}/dwell/`, {
      method: 'POST',
      json: { seconds: sec },
    }).catch(() => {});
  }, [active, currentTime, me, reel.id]);

  useEffect(() => {
    if (!active) dwellSent.current = new Set();
  }, [active, reel.id]);



  useEffect(() => {

    setLiked(reel.is_liked);
    setLikes(reel.likes_count);
    setReactionCounts(countsToEmojiMap(reel.reaction_counts));
    setSelectedEmoji(reel.my_reaction ? EMOJI_BY_REACTION_TYPE[reel.my_reaction] : undefined);

    setCommentsCount(reel.comments_count);
    setShares(reel.shares_count);
    setSaved(Boolean(reel.is_saved));

    setProgress(0);
    setCaptionDraft(reel.caption || '');
    setTagsDraft((reel.tags || []).join(', '));
    setFilterDraft((reel.filter_style || 'none') as ReelFilter);
    setEditError('');

  }, [reel.id, reel.is_liked, reel.likes_count, reel.reaction_counts, reel.my_reaction, reel.comments_count, reel.shares_count, reel.is_saved, reel.caption, reel.tags, reel.filter_style]);



  const applyLikeResult = useCallback((res: ReelLikeResult | null) => {
    if (!res) return;
    setLiked(res.liked);
    setLikes(res.likes_count);
    if (res.reaction_counts) setReactionCounts(countsToEmojiMap(res.reaction_counts));
    setSelectedEmoji(res.my_reaction ? EMOJI_BY_REACTION_TYPE[res.my_reaction] : undefined);
  }, []);

  const handleReelReaction = useCallback(
    async (emoji: string) => {
      const type = REACTION_TYPE_BY_EMOJI[emoji];
      if (!type) return;
      const res = await onLike(reel.id, type);
      applyLikeResult(res);
      if (res?.liked) {
        setBurstEmoji(emoji);
        setBurst((b) => b + 1);
        setLikePop(true);
        setTimeout(() => setLikePop(false), 700);
      }
    },
    [applyLikeResult, onLike, reel.id],
  );

  const quickSpark = useCallback(async () => {
    const emoji = selectedEmoji || '✨';
    hapticReaction('medium');
    setBurstEmoji(emoji);
    setBurst((b) => b + 1);
    const type = REACTION_TYPE_BY_EMOJI[emoji] || 'spark';
    const res = await onLike(reel.id, type);
    applyLikeResult(res);
    if (res?.liked) {
      setLikePop(true);
      setTimeout(() => setLikePop(false), 700);
    }
  }, [applyLikeResult, onLike, reel.id, selectedEmoji]);



  const syncPlayback = useCallback(

    (play: boolean) => {

      const v = videoRef.current;

      const a = audioRef.current;

      if (v) {

        if (play) v.play().catch(() => {});

        else {

          v.pause();

          v.currentTime = 0;

        }

        if (hasOverlayMusic) v.muted = true;

        else v.muted = muted;

      }

      if (a && hasOverlayMusic) {

        a.muted = muted;

        if (play) {
          if (v && a.duration && Number.isFinite(a.duration)) {
            a.currentTime = trimmedAudioTime(
              v.currentTime,
              musicTrim,
              a.duration,
            );
          }
          a.play().catch(() => {});
        } else {
          a.pause();
          a.currentTime = musicTrim.start;
        }

      }

      setPaused(!play);

    },

    [hasOverlayMusic, muted, musicTrim],

  );



  useEffect(() => {

    if (active) {

      syncPlayback(true);

      if (!viewedRef.current) {

        viewedRef.current = true;

        onView(reel.id);

      }

    } else {

      syncPlayback(false);

    }

  }, [active, reel.id, onView, syncPlayback]);



  useEffect(() => {

    const v = videoRef.current;

    const a = audioRef.current;

    if (!v || !active) return;

    const alignAudio = () => {
      if (!a || !hasOverlayMusic || !a.duration || !Number.isFinite(a.duration)) return;
      enforceTrimLoop(a, musicTrim);
      const target = trimmedAudioTime(v.currentTime, musicTrim, a.duration);
      if (Math.abs(a.currentTime - target) > 0.35) {
        a.currentTime = target;
      }
    };

    const onTime = () => {
      if (v.duration && Number.isFinite(v.duration) && progressFrameRef.current == null) {
        progressFrameRef.current = window.requestAnimationFrame(() => {
          setProgress((v.currentTime / v.duration) * 100);
          progressFrameRef.current = null;
        });
      }

      alignAudio();

    };

    const onPlay = () => {

      setPaused(false);

      if (a && hasOverlayMusic) {

        alignAudio();

        a.muted = muted;

        a.play().catch(() => {});

      }

    };

    const onPause = () => {

      setPaused(true);

      if (a && hasOverlayMusic) a.pause();

    };

    v.addEventListener('timeupdate', onTime);

    v.addEventListener('play', onPlay);

    v.addEventListener('pause', onPause);

    return () => {
      if (progressFrameRef.current != null) {
        window.cancelAnimationFrame(progressFrameRef.current);
        progressFrameRef.current = null;
      }

      v.removeEventListener('timeupdate', onTime);

      v.removeEventListener('play', onPlay);

      v.removeEventListener('pause', onPause);

    };

  }, [active, reel.id, hasOverlayMusic, muted, musicTrim]);



  useEffect(() => {

    const v = videoRef.current;

    const a = audioRef.current;

    if (v && !hasOverlayMusic) v.muted = muted;

    if (a && hasOverlayMusic) a.muted = muted;

  }, [muted, hasOverlayMusic]);



  const onVideoTap = () => {
    if (speeding.current) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      void quickSpark();
    } else {
      const v = videoRef.current;
      if (v) {
        if (v.paused) syncPlayback(true);
        else syncPlayback(false);
      }
    }
    lastTap.current = now;
  };

  const setPlaybackRate = (rate: number) => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (v) v.playbackRate = rate;
    if (a) a.playbackRate = rate;
  };

  const onHoldStart = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      speeding.current = true;
      setPlaybackRate(2);
    }, 280);
  };

  const onHoldEnd = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (speeding.current) {
      setPlaybackRate(1);
      speeding.current = false;
    }
  };

  const dimSignal = async () => {
    if (!me || isOwner) return;
    try {
      const res = await apiFetchJson(`reels/${reel.id}/dim/`, { method: 'POST' });
      if (!res.ok) {
        flashActionError(t('reels.actionFailed'));
        return;
      }
      const data = await res.json();
      if (data.dimmed) onDimmed?.(reel.id);
    } catch {
      flashActionError(t('reels.actionFailed'));
    }
  };



  const soundLabel =

    reel.music_track_detail?.title ||

    reel.sound_label ||

    t('reels.originalSound');



  const submitReelReport = async (reason: ReportReason, details: string) => {
    if (!me || isOwner) return false;
    try {
      const res = await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'reel',
          object_id: reel.id,
          content: `reel:${reel.id} @${reelAuthorName(reel.user)}: ${(reel.caption || '').slice(0, 200)}`,
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

  const recordShare = async (channel: ShareChannel = 'unknown') => {
    try {
      const data = await recordContentShare('reel', reel.id, channel);
      if (data?.shares_count != null) setShares(data.shares_count);
    } catch {
      /* ignore */
    }
  };

  const toggleSave = async () => {
    if (!me) return;
    try {
      const res = await apiFetchJson(`reels/${reel.id}/save/`, { method: 'POST' });
      if (!res.ok) {
        flashActionError(t('reels.actionFailed'));
        return;
      }
      const data = await res.json();
      const nextSaved = Boolean(data.saved);
      setSaved(nextSaved);
      onSavedChange?.(reel.id, nextSaved);
    } catch {
      flashActionError(t('reels.actionFailed'));
    }
  };

  const [crossposted, setCrossposted] = useState(false);
  const [crosspostBusy, setCrosspostBusy] = useState(false);

  const handleShareToFeed = async () => {
    if (!me || crosspostBusy || crossposted) return;
    setCrosspostBusy(true);
    try {
      const res = await apiFetchJson('posts/', {
        method: 'POST',
        json: { text: '', shared_reel_id: reel.id },
      });
      if (res.ok) setCrossposted(true);
      else flashActionError(t('reels.actionFailed'));
    } catch {
      flashActionError(t('reels.actionFailed'));
    } finally {
      setCrosspostBusy(false);
    }
  };

  const deleteReel = async () => {
    if (!me || !isOwner) return;
    if (!(await confirm(t('reels.confirmDeleteReel'), { danger: true, confirmLabel: t('common.delete') }))) return;
    try {
      const res = await apiFetch(`reels/${reel.id}/`, { method: 'DELETE' });
      if (res.ok) onDeleted?.();
      else flashActionError(t('reels.actionFailed'));
    } catch {
      flashActionError(t('reels.actionFailed'));
    }
  };

  const saveEdit = async () => {
    if (!me || !isOwner) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const res = await apiFetchJson(`reels/${reel.id}/`, {
        method: 'PATCH',
        json: {
          caption: captionDraft.trim(),
          tags: tagsDraft
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          filter_style: filterDraft,
        },
      });
      if (!res.ok) throw new Error('failed');
      window.location.reload();
    } catch {
      setEditError(t('reels.updateFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(n);
  };



  return (

    <section

      className={`reel-slide reel-slide--filter-${filterKey}${active ? ' reel-slide--active' : ''}`}

      data-mood={reel.mood}

      style={{ '--reel-hue': mood.hue } as React.CSSProperties}

    >

      <div className="reel-slide__viewport">

        {actionError && (
          <p
            className="reel-comments-sheet__empty"
            style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 40,
              background: 'rgba(0,0,0,0.7)',
              color: '#f87171',
              padding: '6px 14px',
              borderRadius: 999,
            }}
          >
            {actionError}
          </p>
        )}

        <div className="reel-slide__frame">

          <div className="reel-slide__warp" aria-hidden />

          <div className="reel-slide__scanlines" aria-hidden />

          {filterKey === 'glitch' && <div className="reel-slide__glitch-layer" aria-hidden />}



          {active && (

            <div className="reel-slide__progress" aria-hidden>

              <span className="reel-slide__progress-fill" style={{ width: `${progress}%` }} />

            </div>

          )}



          <video
            ref={videoRef}
            className="reel-slide__video"
            src={mediaUrl(reel.video) || reel.video}
            style={{ filter: filterMeta.css || undefined }}
            loop
            playsInline
            muted
            onClick={onVideoTap}
            onPointerDown={onHoldStart}
            onPointerUp={onHoldEnd}
            onPointerLeave={onHoldEnd}
            onPointerCancel={onHoldEnd}
          />

          <ReelOverlays reel={reel} currentTime={currentTime} />

          {musicUrl && <audio ref={audioRef} src={musicUrl} loop playsInline />}



          <div className="reel-slide__vignette" aria-hidden />

          {!reel.is_active && isOwner && (
            <div
              className="absolute left-4 right-4 top-4 rounded-2xl px-4 py-3 text-sm font-medium"
              style={{
                background: 'rgba(255, 196, 0, 0.18)',
                border: '1px solid rgba(255, 196, 0, 0.35)',
                color: '#fff',
              }}
            >
              {t('reels.hiddenModeration')}
            </div>
          )}



          {active && paused && (

            <div className="reel-slide__pause-hint" aria-hidden>

              <span className="reel-slide__pause-icon">▶</span>

            </div>

          )}



          <AnimatePresence>

            {likePop && (

              <motion.div

                className="reel-slide__like-burst"

                initial={{ scale: 0.4, opacity: 0 }}

                animate={{ scale: 1.2, opacity: 1 }}

                exit={{ scale: 1.6, opacity: 0 }}

                key={burst}

              >

                <span className="reel-slide__like-burst-emoji">{burstEmoji}</span>

              </motion.div>

            )}

          </AnimatePresence>



          {reel.views > 0 && (

            <div className="reel-slide__views">

              <EyeIcon className="h-3.5 w-3.5" />

              <span>{formatCount(reel.views)}</span>

            </div>

          )}

        </div>

      </div>



      <div className="reel-slide__side">
        <Link href={`/profile/${reel.user.id}`} className="reel-slide__avatar-link">
          <span className="reel-slide__avatar-ring">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Image src={avatar} alt={`${reelAuthorName(reel.user)} avatar`} width={40} height={40} className="reel-slide__avatar" />
            ) : (
              <span className="reel-slide__avatar-fallback">{mood.emoji}</span>
            )}
          </span>
        </Link>

        <button
          type="button"
          className={`reel-slide__action${saved ? ' reel-slide__action--liked' : ''}`}
          onClick={toggleSave}
          aria-label={t('reels.save')}
          title={t('reels.save')}
        >
          <BookmarkIcon />
          <span>{saved ? t('reels.saved') : t('reels.save')}</span>
        </button>

        <div className="reel-slide__action reel-slide__action--react">
          <PostReactions
            variant="reel"
            compact
            contentType="reel"
            contentId={reel.id}
            selectedReaction={selectedEmoji}
            reactionCounts={reactionCounts}
            onReaction={(emoji) => void handleReelReaction(emoji)}
          />
          <span className="reel-slide__react-count">{formatCount(likes)}</span>
        </div>

        <button
          type="button"
          className="reel-slide__action"
          onClick={() => setCommentsOpen(true)}
          aria-label={t('reels.commentsTitle')}
          title={t('reels.commentsTitle')}
        >
          <ChatBubbleLeftIcon />
          <span>{formatCount(commentsCount)}</span>
        </button>

        <button
          type="button"
          className="reel-slide__action"
          onClick={() => setShareOpen(true)}
          aria-label={t('reels.share')}
          title={t('reels.share')}
        >
          <ShareIcon />
          <span>{shares > 0 ? formatCount(shares) : t('reels.share')}</span>
        </button>

        {(reel.allow_remix !== false) && (
          <Link
            href={`/reels/create?remix_of=${reel.id}`}
            className="reel-slide__action"
            aria-label={t('reels.remix')}
            title={t('reels.remixHint')}
          >
            <ArrowPathRoundedSquareIcon />
            <span>{t('reels.remix')}</span>
          </Link>
        )}

        {(reel.allow_weave !== false) && (
          <Link
            href={`/reels/create?stitch_of=${reel.id}`}
            className="reel-slide__action"
            aria-label={t('reels.weave')}
            title={t('reels.weaveHint')}
          >
            <ScissorsIcon />
            <span>{t('reels.weave')}</span>
          </Link>
        )}

        {me && (
          <button
            type="button"
            className="reel-slide__action"
            onClick={() => void handleShareToFeed()}
            disabled={crosspostBusy || crossposted}
            aria-label={t('reels.shareToFeed')}
            title={t('reels.shareToFeed')}
          >
            <RectangleStackIcon />
            <span>{crossposted ? t('reels.sharedToFeedShort') : t('reels.shareToFeedShort')}</span>
          </button>
        )}

        <button
          type="button"
          className="reel-slide__action"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? t('reels.unmute') : t('reels.mute')}
          title={muted ? t('reels.unmute') : t('reels.mute')}
        >
          {muted ? <SpeakerXMarkIcon /> : <SpeakerWaveIcon />}
        </button>

        {isOwner ? (
          <>
            <button
              type="button"
              className="reel-slide__action"
              onClick={() => setEditOpen(true)}
              aria-label={t('reels.editReel')}
              title={t('reels.editReel')}
            >
              <PencilSquareIcon />
              <span>{t('reels.editReel')}</span>
            </button>
            <button
              type="button"
              className="reel-slide__action"
              onClick={() => {
                void (async () => {
                  const res = await apiFetchJson(`reels/${reel.id}/generate-captions/`, {
                    method: 'POST',
                    json: { force: true, language: reel.captions_language || 'en' },
                  });
                  if (res.ok) window.alert(t('reels.captionsRefreshed'));
                  else flashActionError(t('reels.actionFailed'));
                })();
              }}
              aria-label={t('reels.generateCaptions')}
              title={t('reels.captions')}
            >
              <span style={{ fontSize: 11, fontWeight: 800 }}>CC</span>
              <span>CC</span>
            </button>
            <button
              type="button"
              className="reel-slide__action reel-slide__action--danger"
              onClick={deleteReel}
              aria-label={t('reels.deleteReel')}
              title={t('reels.deleteReel')}
            >
              <TrashIcon />
              <span>{t('reels.deleteReel')}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="reel-slide__action"
              onClick={() => void dimSignal()}
              aria-label={t('reels.dimSignal')}
              title={t('reels.dimSignal')}
            >
              <EyeSlashIcon />
              <span>{t('reels.dimSignalShort')}</span>
            </button>
            <button
              type="button"
              className="reel-slide__action"
              onClick={() => setReportOpen(true)}
              aria-label={t('reels.reportReel')}
              title={t('reels.reportReel')}
            >
              <FlagIcon />
              <span>{t('reels.reportReel')}</span>
            </button>
          </>
        )}
      </div>



      <div className="reel-slide__meta">

        <div className="reel-slide__chips">

          {reel.remix_of != null && (
            <ReelRemixBadge remixOfId={reel.remix_of} />
          )}
          {reel.stitch_of != null && (
            <ReelRemixBadge remixOfId={reel.stitch_of} labelKey="reels.weaveOf" />
          )}
          {reel.inspiration_attribution?.type === 'question' && (
            <Link href={`/inspiration?q=${reel.inspiration_attribution.id}`} className="reel-slide__remix-chip">
              ✦ {reel.inspiration_attribution.label}
            </Link>
          )}
          {reel.inspiration_attribution?.type === 'idea' && (
            <Link href={`/bazaar/${reel.inspiration_attribution.id}`} className="reel-slide__remix-chip">
              💡 {reel.inspiration_attribution.label}
            </Link>
          )}

          <span className="reel-slide__mood-chip">

            <span>{mood.emoji}</span>

            <span>{mood.label}</span>

          </span>

          {filterKey !== 'none' && (

            <span className="reel-slide__filter-chip">

              {filterMeta.emoji} {filterMeta.label}

            </span>

          )}

        </div>

        <Link href={`/profile/${reel.user.id}`} className="reel-slide__author">

          @{reelAuthorName(reel.user)}

        </Link>

        {reel.caption && <MentionText text={reel.caption} className="reel-slide__caption" />}

        {reel.tags && reel.tags.length > 0 && (

          <div className="reel-slide__tags">

            {reel.tags.slice(0, 4).map((tag) => (

              <Link

                key={tag}

                href={`/reels?tag=${encodeURIComponent(tag)}`}

                className="reel-slide__tag"

              >

                #{tag}

              </Link>

            ))}

          </div>

        )}

        {reel.music_track_detail ? (
          <Link href={`/reels/sound/${reel.music_track_detail.id}`} className="reel-slide__sound reel-slide__sound-link">
            <span className="reel-slide__sound-wave" aria-hidden />
            <span className="reel-slide__sound-marquee">
              <span>{soundLabel}</span>
            </span>
          </Link>
        ) : (
          <div className="reel-slide__sound">
            <span className="reel-slide__sound-wave" aria-hidden />
            <span className="reel-slide__sound-marquee">
              <span>{soundLabel}</span>
            </span>
          </div>
        )}

        <RelativeTime date={reel.created_at} className="reel-slide__time block" />

        {active && (

          <p className="reel-slide__hint">{t('reels.doubleTap')}</p>

        )}

      </div>



      <ReelCommentsSheet
        reelId={reel.id}
        reelOwnerId={reel.user.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCountChange={setCommentsCount}
      />

      <AnimatePresence>
        {shareOpen && (
          <ShareCosmicPanel
            postUrl={reelPageUrl(reel.id)}
            postTitle={reel.caption?.slice(0, 80) || t('reels.shareSignalTitle')}
            dmMessage={reel.caption?.slice(0, 80) || t('reels.shareSignalTitle')}
            shareCount={shares}
            contentType="reel"
            authorName={reelAuthorName(reel.user)}
            storyMediaUrl={mediaUrl(reel.video) || reel.video}
            onShareToStory={async (draft) => {
              const video = mediaUrl(reel.video) || reel.video;
              if (!video) return false;
              return shareReelToStory(reel.id, video, {
                caption: reel.caption || undefined,
                text: draft?.text,
                audience: draft?.audience,
              });
            }}
            onRecordShare={recordShare}
            onClose={() => setShareOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {editOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{ background: 'rgba(10,10,34,0.72)', backdropFilter: 'blur(4px)' }}
            onClick={() => setEditOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl p-6"
              style={{ background: 'rgba(20,20,40,0.96)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <h3 className="text-lg font-semibold text-white mb-4">{t('reels.editTitle')}</h3>
              <label className="block text-sm text-white/70 mb-1">{t('reels.captionLabel')}</label>
              <textarea
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                rows={3}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none bg-white/5 text-white border border-white/10"
              />
              <label className="block text-sm text-white/70 mt-4 mb-1">
                {t('reels.tagsLabel')} · {t('reels.tagsHint')}
              </label>
              <input
                value={tagsDraft}
                onChange={(e) => setTagsDraft(e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none bg-white/5 text-white border border-white/10"
              />
              <label className="block text-sm text-white/70 mt-4 mb-1">{t('reels.filterLabel')}</label>
              <select
                value={filterDraft}
                onChange={(e) => setFilterDraft(e.target.value as ReelFilter)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none bg-white/5 text-white border border-white/10"
              >
                {Object.entries(REEL_FILTER_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </select>
              {editError ? <p className="text-sm text-red-300 mt-3">{editError}</p> : null}
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white bg-white/10"
                >
                  {t('common.close')}
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(90deg, #6a00ff, #a855f7)' }}
                >
                  {savingEdit ? t('reels.savingReel') : t('reels.saveReel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t('social.reportWhyReel')}
        onSubmit={submitReelReport}
      />
    </section>

  );

}

