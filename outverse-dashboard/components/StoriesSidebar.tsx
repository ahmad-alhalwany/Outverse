'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import CosmicVideoPlayer from './CosmicVideoPlayer';
import { apiFetchJson } from '@/lib/api';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useLocale } from '@/components/LocaleProvider';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';
import { useDialogA11y } from '@/lib/hooks/useDialogA11y';
import {
  fetchStoryRings,
  trackStoryView,
  reactToStory,
  replyToStory,
  deleteStory,
  fetchStoryViewers,
  muteStoryUser,
  saveStoryToConstellation,
  submitPollVote,
  submitQuestionResponse,
  fetchQuestionResponses,
  type StoryItem,
  type StoryRing,
  type StoryQuestionResponseItem,
  type PollResults,
} from '@/lib/storyUtils';
import { StorySegmentProgress } from './stories/StorySegmentProgress';
import StoryRingAvatar from './stories/StoryRingAvatar';
import StoryOverlaysLayer from './stories/StoryOverlaysLayer';
import { AddStoryModal } from './stories/StoryComposer';
import { filterCss, backgroundCss, moodAuraCss, formatCountdown } from '@/lib/storyStudio';
import PostReactions from './PostReactions';
import { formatRelativeTime } from '@/utils/dateFormatter';
import { EMOJI_BY_REACTION_TYPE, REACTION_TYPE_BY_EMOJI, countsToEmojiMap, type ReactionType } from '@/lib/reactions';
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  PauseIcon,
  TrashIcon,
  PaperAirplaneIcon,
  EllipsisHorizontalIcon,
  ArrowDownTrayIcon,
  FlagIcon,
  SpeakerXMarkIcon,
  SparklesIcon,
  LockClosedIcon,
  MapPinIcon,
} from '@heroicons/react/24/solid';

const SIDEBAR_WIDTH = 80;
const VISIBLE_STORIES = 4;
const STAR_COUNT = 36;
const SWITCH_SOUND_URL = 'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae5b2.mp3'; // Example short UI sound

function StarfieldBG() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
    let paused = document.hidden;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIDEBAR_WIDTH * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${SIDEBAR_WIDTH}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);

    // Generate stars
    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * SIDEBAR_WIDTH,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.2 + 0.5,
      speed: Math.random() * 0.18 + 0.04,
      alpha: Math.random() * 0.5 + 0.5,
    }));

    function draw() {
      if (paused) {
        animationId = requestAnimationFrame(draw);
        return;
      }
      if (!ctx) return;
      ctx.clearRect(0, 0, SIDEBAR_WIDTH, window.innerHeight);
      for (const star of stars) {
        ctx.save();
        ctx.globalAlpha = star.alpha;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, 2 * Math.PI);
        ctx.fillStyle = 'white';
        ctx.shadowColor = '#00CCFF';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
        // Move star upward
        star.y -= star.speed;
        if (star.y < -2) {
          star.y = window.innerHeight + 2;
          star.x = Math.random() * SIDEBAR_WIDTH;
        }
      }
      animationId = requestAnimationFrame(draw);
    }
    const handleVisibilityChange = () => {
      paused = document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    draw();
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      width={SIDEBAR_WIDTH}
      height={typeof window !== 'undefined' ? window.innerHeight : 800}
      aria-hidden="true"
    />
  );
}

function CosmicParticlesBG({ width = 480, height = 480 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId: number;
    const PARTICLE_COUNT = 32;
    const colors = ['#00CCFF', '#6A00FF', '#fff', '#AAB6FF', '#1ad1ff'];
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 2.5 + 1.2,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.5,
      alpha: Math.random() * 0.5 + 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      twinkle: Math.random() * Math.PI * 2,
    }));
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        if (!ctx) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha * (0.7 + 0.3 * Math.sin(p.twinkle + Date.now() * 0.001));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
        p.x += p.dx;
        p.y += p.dy;
        p.twinkle += 0.02;
        if (p.x < -5) p.x = width + 5;
        if (p.x > width + 5) p.x = -5;
        if (p.y < -5) p.y = height + 5;
        if (p.y > height + 5) p.y = -5;
      }
      animationId = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [width, height]);
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        zIndex: 0,
        pointerEvents: 'none',
        borderRadius: 24,
      }}
      aria-hidden="true"
    />
  );
}

function OrbitingPlanetTimer({ progress, size = 64 }: { progress: number, size?: number }) {
  // progress: 0 to 1
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const angle = progress * 2 * Math.PI - Math.PI / 2; // Start at top
  const planetX = cx + r * Math.cos(angle);
  const planetY = cy + r * Math.sin(angle);
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {/* Orbit path */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="url(#orbitGradient)" strokeWidth="3" strokeDasharray={Math.PI * 2 * r} strokeDashoffset={Math.PI * 2 * r * (1 - progress)} style={{ filter: 'drop-shadow(0 0 8px #00CCFF88)' }} />
      <defs>
        <radialGradient id="starGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="60%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#6A00FF" />
        </radialGradient>
        <linearGradient id="orbitGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00CCFF" />
          <stop offset="100%" stopColor="#6A00FF" />
        </linearGradient>
      </defs>
      {/* Central star */}
      <circle cx={cx} cy={cy} r={10} fill="url(#starGradient)" filter="url(#glow)" />
      {/* Orbiting planet */}
      <circle cx={planetX} cy={planetY} r={7} fill="#00CCFF" stroke="#fff" strokeWidth="2" filter="url(#planetGlow)" />
      {/* Glow filters */}
      <filter id="glow">
        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="planetGlow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </svg>
  );
}

export function StoryModal({
  story,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDeleted,
  onMuted,
  onUnlocked,
}: {
  story: any
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  hasPrev: boolean
  hasNext: boolean
  onDeleted?: (storyId: number) => void
  onMuted?: () => void
  onUnlocked?: () => void
}) {
  // Only ever mounted while open (parent does {showStory && <StoryModal />}),
  // so `open` is always true. Fixes a real audit finding: role="dialog" was
  // present but nothing backed it — no Escape handler, no focus trap.
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);
  const { t } = useLocale();
  const me = useAuthUser();
  const confirm = useConfirm();
  const isOwner = !!me && me.id === (story.userId ?? story.user_id ?? story.user?.id);
  const [myReaction, setMyReaction] = useState<string | null>(story.myReaction ?? null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>(story.reactionCounts ?? {});
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [savedToast, setSavedToast] = useState('');
  const [lockCountdown, setLockCountdown] = useState<number>(story.unlocksIn ?? 0);
  const [echoes, setEchoes] = useState<{ id: string; emoji: string }[]>([]);
  const echoBaselineRef = useRef<Record<string, number>>(story.reactionCounts ?? {});
  const [pollResults, setPollResults] = useState<PollResults>(story.pollResults ?? {});
  const [questionResponseCounts, setQuestionResponseCounts] = useState<Record<string, number>>(story.questionResponseCounts ?? {});
  const [openResponsesOverlayId, setOpenResponsesOverlayId] = useState<string | null>(null);
  const [questionResponses, setQuestionResponses] = useState<StoryQuestionResponseItem[]>([]);
  const [viewers, setViewers] = useState<{ viewer: { id: number; username: string; avatar: string | null } }[]>([]);
  const [spotlightSubmitting, setSpotlightSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [timerActive, setTimerActive] = useState(true);
  const [mediaIdx, setMediaIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [elapsedBeforePause, setElapsedBeforePause] = useState(0);
  const prevStoryRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // دمج جميع الوسائط في مصفوفة واحدة
  const allMedia = [
    ...(story.media || []),
    ...(story.mediaUrl ? [{ type: story.mediaUrl.includes('.mp4') || story.mediaUrl.includes('.webm') || story.mediaUrl.includes('.mov') ? 'video' : 'image', url: story.mediaUrl }] : [])
  ];

  const currentMedia = allMedia[mediaIdx];
  const isVideo = currentMedia?.type === 'video';
  const isImage = currentMedia?.type === 'image';
  const isTextOnly = allMedia.length === 0;
  const hasMultipleMedia = allMedia.length > 1;
  const hasDesign = (story.overlays?.length ?? 0) > 0 || (story.drawing?.length ?? 0) > 0;

  let duration = 15000; // 15 seconds for text
  if (isImage) duration = 15000; // 15 seconds for images
  if (isVideo) duration = 30000; // 30 seconds max for videos, will update on loadedmetadata

  // Animate on story change
  useEffect(() => {
    if (!prevStoryRef.current) {
      prevStoryRef.current = story;
      return;
    }
    if (story && prevStoryRef.current && story.id !== prevStoryRef.current.id) {
      setAnimating(true);
      setProgress(0);
      setMediaIdx(0);
      setTimerActive(true);
      setIsPaused(false); // إعادة تعيين حالة الإيقاف
      setPauseStartTime(null);
      setElapsedBeforePause(0);
      startTimeRef.current = 0;
      durationRef.current = 0;
      setMyReaction(story.myReaction ?? null);
      setReactionCounts(story.reactionCounts ?? {});
      setReplyText('');
      setReplySent(false);
      setViewersOpen(false);
      setViewers([]);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      setTimeout(() => {
        setAnimating(false);
        prevStoryRef.current = story;
      }, 320);
    }
  }, [story]);

  const advanceStory = useCallback(() => {
    if (mediaIdx < allMedia.length - 1) {
      setMediaIdx((current) => current + 1);
      setProgress(0);
      startTimeRef.current = 0;
    } else if (hasNext) {
      onNext();
    } else {
      onClose();
    }
  }, [allMedia.length, hasNext, mediaIdx, onClose, onNext]);

  // Resets playback refs whenever the media kind or index changes — this must
  // run before the progress-timer effect below (both fire on mount too, and
  // React runs effects in declaration order), otherwise it clobbers
  // startTimeRef back to 0 right after the timer effect seeds it, making the
  // next tick compute `Date.now() - 0` and instantly advance the story.
  useEffect(() => {
    if (isVideo) {
      setTimerActive(false);
      setProgress(0);
    } else {
      setTimerActive(true);
      setProgress(0);
    }
    setIsPaused(false);
    setPauseStartTime(null);
    setElapsedBeforePause(0);
    startTimeRef.current = 0;
    if (!isVideo) durationRef.current = 0;
  }, [isVideo, mediaIdx]);

  useEffect(() => {
    if (isVideo) return;
    if (!timerActive || isPaused) return;
    // Captured once per effect run so a later effect resetting startTimeRef
    // (e.g. the isVideo/mediaIdx reset above, which also fires on mount) can't
    // make a delayed tick compute `Date.now() - 0` and instantly advance.
    const localStart = startTimeRef.current || Date.now();
    startTimeRef.current = localStart;
    const localDuration = durationRef.current || duration;

    function tick() {
      const elapsed = Date.now() - localStart;
      const progressValue = Math.min(elapsed / localDuration, 1);
      requestAnimationFrame(() => {
        setProgress(progressValue);
      });
      if (elapsed < localDuration) {
        timerRef.current = setTimeout(tick, 80);
      } else {
        setProgress(1);
        advanceStory();
      }
    }
    tick();
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); } };
  }, [advanceStory, duration, isPaused, isVideo, timerActive, story]);

  // For video: set duration to video length (max 30s)
  const handleVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    let d = Math.min(video.duration * 1000, 30000); // 30 seconds max
    durationRef.current = d;
    setProgress(0);
    setTimerActive(false); // إيقاف التايمر العادي للفيديوهات
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!isVideo || !videoElement) return;

    const handleVideoEnded = () => advanceStory();
    const handleTimeUpdate = () => {
      if (isPaused || videoElement.duration <= 0) return;
      requestAnimationFrame(() => {
        setProgress(videoElement.currentTime / videoElement.duration);
      });
    };
    const handleLoadedMetadata = () => {
      setProgress(0);
      setTimerActive(false);
    };
    const handlePlay = () => setProgress(0);

    videoElement.addEventListener('ended', handleVideoEnded);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('play', handlePlay);

    return () => {
      videoElement.removeEventListener('ended', handleVideoEnded);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoElement.removeEventListener('play', handlePlay);
    };
  }, [advanceStory, isPaused, isVideo]);

  // إضافة تحسين للتايمر الكوني
  const normalizedProgress = Math.max(0, Math.min(1, progress)); // ضمان أن القيمة من 0 إلى 1
  
  // تحسين الأداء مع useMemo
  const memoizedProgress = React.useMemo(() => normalizedProgress, [normalizedProgress]);
  useEffect(() => {
    setProgress(0);
    setTimerActive(true);
    durationRef.current = isVideo ? durationRef.current : duration;
  }, [direction, duration, isVideo]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && hasPrev) {
        setDirection('left');
        onPrev();
      } else if (e.key === 'ArrowRight' && hasNext) {
        setDirection('right');
        onNext();
      } else if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  const handlePrev = () => {
    setDirection('left');
    onPrev();
  };
  const handleNext = () => {
    setDirection('right');
    onNext();
  };

  const nextMedia = () => {
    if (mediaIdx < allMedia.length - 1) {
      setMediaIdx(mediaIdx + 1);
      setProgress(0);
    }
  };

  const prevMedia = () => {
    if (mediaIdx > 0) {
      setMediaIdx(mediaIdx - 1);
      setProgress(0);
    }
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      setTimerActive(true);
      if (isVideo) {
        videoRef.current?.play().catch(() => {});
      } else {
        if (pauseStartTime && elapsedBeforePause > 0) {
          const remainingTime = durationRef.current - elapsedBeforePause;
          startTimeRef.current = Date.now() - (durationRef.current - remainingTime);
        } else {
          startTimeRef.current = Date.now();
        }
      }
    } else {
      setIsPaused(true);
      setTimerActive(false);
      if (isVideo) {
        videoRef.current?.pause();
      } else {
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedBeforePause(elapsed);
        setPauseStartTime(Date.now());
      }
    }
  };

  const handleReact = async (emoji: string) => {
    const type = REACTION_TYPE_BY_EMOJI[emoji];
    if (!type) return;
    const next = myReaction === type ? null : type;
    setMyReaction(next);
    const data = await reactToStory(story.id, next);
    if (data) {
      setMyReaction(data.my_reaction);
      setReactionCounts(data.reaction_counts || {});
    }
  };

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      await replyToStory(story.id, replyText.trim());
      const peerId = story.userId ?? story.user_id ?? story.user?.id;
      if (peerId) {
        await apiFetchJson('chat/send/', {
          method: 'POST',
          json: {
            peer_id: peerId,
            text: `Replied to your story: ${replyText.trim()}`,
          },
        });
      }
      setReplyText('');
      setReplySent(true);
      setTimeout(() => setReplySent(false), 2200);
    } catch {
      setSavedToast('Could not send your reply.');
      setTimeout(() => setSavedToast(''), 2200);
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!(await confirm('Delete this story?', { danger: true, confirmLabel: 'Delete' }))) return;
    const ok = await deleteStory(story.id);
    if (ok) {
      onDeleted?.(story.id);
      onClose();
    } else {
      setSavedToast('Could not delete this story.');
      setTimeout(() => setSavedToast(''), 2200);
    }
  };

  const handleDownload = () => {
    setMenuOpen(false);
    if (!currentMedia?.url) return;
    const a = document.createElement('a');
    a.href = currentMedia.url;
    a.download = `story-${story.id}`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  const handleReport = async () => {
    setMenuOpen(false);
    if (!me || !(await confirm(`Report ${displayName}'s story to moderators?`, { confirmLabel: 'Report' }))) return;
    try {
      await apiFetchJson('moderation/flagged/', {
        method: 'POST',
        json: {
          type: 'story',
          content: `story:${story.id} @${displayName}: ${(story.text || '').slice(0, 200)}`,
          reporter: me.username,
        },
      });
      setReportSent(true);
      setTimeout(() => setReportSent(false), 2200);
    } catch {
      setSavedToast('Could not submit the report.');
      setTimeout(() => setSavedToast(''), 2200);
    }
  };

  const handleMute = () => {
    setMenuOpen(false);
    const uid = story.userId ?? story.user_id ?? story.user?.id;
    if (!uid) return;
    muteStoryUser(uid);
    onMuted?.();
    onClose();
  };

  const handleSaveToConstellation = async () => {
    setMenuOpen(false);
    const result = await saveStoryToConstellation(story.id);
    if (result) {
      setSavedToast(`Saved to “${result.title}”`);
    } else {
      setSavedToast('Could not save this story.');
    }
    setTimeout(() => setSavedToast(''), 2200);
  };

  const handleSubmitSpotlight = async () => {
    setMenuOpen(false);
    if (spotlightSubmitting) return;
    setSpotlightSubmitting(true);
    try {
      const res = await apiFetchJson(`stories/${story.id}/submit_spotlight/`, { method: 'POST' });
      if (!res.ok) throw new Error('failed');
      setSavedToast('Submitted to Spotlight.');
    } catch {
      setSavedToast('Could not submit to Spotlight.');
    } finally {
      setSpotlightSubmitting(false);
      setTimeout(() => setSavedToast(''), 2200);
    }
  };

  const handleVote = async (overlayId: string, optionIndex: number) => {
    // Optimistic update so the tap feels instant.
    setPollResults((prev) => {
      const cur = prev[overlayId] ?? { counts: {}, total: 0, my_vote: null };
      const counts = { ...cur.counts };
      const prevVote = cur.my_vote;
      if (prevVote !== null && prevVote !== undefined) {
        counts[String(prevVote)] = Math.max(0, (counts[String(prevVote)] ?? 0) - 1);
      }
      counts[String(optionIndex)] = (counts[String(optionIndex)] ?? 0) + 1;
      const total = prevVote === null || prevVote === undefined ? cur.total + 1 : cur.total;
      return { ...prev, [overlayId]: { counts, total, my_vote: optionIndex } };
    });
    const result = await submitPollVote(story.id, overlayId, optionIndex);
    if (result) {
      setPollResults((prev) => ({ ...prev, [overlayId]: result }));
    }
  };

  const handleSubmitAnswer = (overlayId: string, text: string) => {
    submitQuestionResponse(story.id, overlayId, text);
  };

  const handleOpenResponses = async (overlayId: string) => {
    setOpenResponsesOverlayId(overlayId);
    const rows = await fetchQuestionResponses(story.id, overlayId);
    setQuestionResponses(rows);
  };

  // Time Capsule: tick the countdown once a second while sealed.
  useEffect(() => {
    setLockCountdown(story.unlocksIn ?? 0);
    if (!story.isLocked) return;
    const id = setInterval(() => setLockCountdown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [story.id, story.isLocked, story.unlocksIn]);

  useEffect(() => {
    if (!story.isLocked || lockCountdown > 0) return;
    onUnlocked?.();
  }, [lockCountdown, story.isLocked, onUnlocked]);

  // Reset poll/question local state whenever the displayed story changes.
  useEffect(() => {
    setPollResults(story.pollResults ?? {});
    setQuestionResponseCounts(story.questionResponseCounts ?? {});
    setOpenResponsesOverlayId(null);
    setQuestionResponses([]);
  }, [story.id]);

  // Story Echo: poll reaction counts and spawn anonymized floating emoji
  // bubbles for whatever changed since the last check — a light-weight
  // "live" communal feel without needing websockets.
  useEffect(() => {
    echoBaselineRef.current = story.reactionCounts ?? {};
    if (story.isLocked) return;
    const poll = async () => {
      try {
        const res = await apiFetchJson(`stories/${story.id}/`);
        if (!res.ok) return;
        const data = await res.json();
        const counts: Record<string, number> = data.reaction_counts || {};
        const spawned: { id: string; emoji: string }[] = [];
        for (const [type, count] of Object.entries(counts)) {
          const prev = echoBaselineRef.current[type] || 0;
          const delta = count - prev;
          if (delta > 0) {
            const emoji = EMOJI_BY_REACTION_TYPE[type as ReactionType] || '✨';
            for (let i = 0; i < Math.min(delta, 3); i++) {
              spawned.push({ id: `${Date.now()}-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`, emoji });
            }
          }
        }
        echoBaselineRef.current = counts;
        if (spawned.length) {
          setEchoes((cur) => [...cur, ...spawned]);
          spawned.forEach((e) => {
            setTimeout(() => setEchoes((cur) => cur.filter((x) => x.id !== e.id)), 2600);
          });
        }
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [story.id, story.isLocked]);

  const toggleViewers = async () => {
    if (viewersOpen) {
      setViewersOpen(false);
      return;
    }
    setViewersOpen(true);
    const rows = await fetchStoryViewers(story.id);
    setViewers(rows);
  };

  if (!story) return null;

  const segmentCount = Math.max(allMedia.length, 1);
  const displayName = story.name || story.user?.name || 'Story';
  const avatarSrc = story.avatar || story.user?.avatar || '';
  const relativeTime = story.createdAt ? formatRelativeTime(story.createdAt) : '';

  return (
    <div ref={dialogRef} className="story-viewer-backdrop" role="dialog" aria-modal="true" aria-label="Story viewer">
      <audio ref={audioRef} src={SWITCH_SOUND_URL} preload="auto" className="hidden" />

      {hasPrev && (
        <button type="button" onClick={handlePrev} className="story-nav-outside story-nav-prev" aria-label="Previous story">
          <ChevronLeftIcon className="h-8 w-8" />
        </button>
      )}

      <div
        className={`story-viewer-phone ${animating ? 'story-viewer-phone--anim' : ''}`}
        style={{
          opacity: animating ? 0.85 : 1,
          transform: animating
            ? direction === 'right'
              ? 'translateX(24px) scale(0.98)'
              : 'translateX(-24px) scale(0.98)'
            : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="story-viewer-chrome">
          <StorySegmentProgress
            segmentCount={segmentCount}
            activeIndex={isTextOnly ? 0 : mediaIdx}
            progress={memoizedProgress}
          />

          <div className="story-viewer-header">
            <div className="story-viewer-user min-w-0 flex-1">
              {avatarSrc ? (
                <Image src={avatarSrc} alt={`${displayName} avatar`} width={38} height={38} className="story-viewer-avatar" unoptimized />
              ) : (
                <span className="story-viewer-avatar story-viewer-avatar--fallback">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="story-viewer-name truncate">{displayName}</p>
                <div className="story-viewer-subline">
                  {relativeTime && <span>{relativeTime}</span>}
                  {isOwner ? (
                    (story.viewerCount ?? story.views ?? 0) > 0 && (
                      <>
                        {relativeTime && <span aria-hidden>·</span>}
                        <button type="button" onClick={toggleViewers} className="story-viewer-subline-btn">
                          <EyeIcon className="h-3.5 w-3.5" />
                          {(story.viewerCount ?? story.views ?? 0).toLocaleString()}
                        </button>
                      </>
                    )
                  ) : (
                    (story.views ?? 0) > 0 && (
                      <>
                        {relativeTime && <span aria-hidden>·</span>}
                        <span className="story-viewer-subline-btn">
                          <EyeIcon className="h-3.5 w-3.5" />
                          {(story.views ?? 0).toLocaleString()}
                        </span>
                      </>
                    )
                  )}
                  {story.locationName && (
                    <>
                      {(relativeTime || (story.views ?? 0) > 0) && <span aria-hidden>·</span>}
                      <span className="story-viewer-subline-btn">
                        <MapPinIcon className="h-3.5 w-3.5" />
                        {story.locationName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="story-viewer-actions">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
                  className="story-viewer-icon-btn"
                  aria-label="More options"
                >
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <div className="story-viewer-menu">
                    {isOwner ? (
                      <>
                        {currentMedia?.url && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleDownload}
                            className="story-viewer-menu-item"
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" /> Download
                          </button>
                        )}
                        {!story.constellation && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={handleSaveToConstellation}
                            className="story-viewer-menu-item"
                          >
                            <SparklesIcon className="h-4 w-4" /> Save to Constellation
                          </button>
                        )}
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void handleSubmitSpotlight()}
                          disabled={spotlightSubmitting}
                          className="story-viewer-menu-item"
                        >
                          <SparklesIcon className="h-4 w-4" /> {spotlightSubmitting ? 'Submitting...' : 'Submit to Spotlight'}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleDelete}
                          className="story-viewer-menu-item story-viewer-menu-item--danger"
                        >
                          <TrashIcon className="h-4 w-4" /> Delete story
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleMute}
                          className="story-viewer-menu-item"
                        >
                          <SpeakerXMarkIcon className="h-4 w-4" /> Mute {displayName}
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={handleReport}
                          className="story-viewer-menu-item story-viewer-menu-item--danger"
                        >
                          <FlagIcon className="h-4 w-4" /> Report
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button type="button" onClick={onClose} className="story-viewer-icon-btn" aria-label="Close">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          {reportSent && <p className="story-viewer-toast">Reported — thanks for helping keep Cosonova safe.</p>}
          {savedToast && <p className="story-viewer-toast">{savedToast}</p>}

          {isOwner && viewersOpen && (
            <div className="story-viewer-viewers-panel">
              {viewers.length === 0 ? (
                <p className="text-xs text-white/60 px-1 py-2">No views yet.</p>
              ) : (
                viewers.map((v) => (
                  <div key={v.viewer.id} className="flex items-center gap-2 px-1 py-1.5">
                    {v.viewer.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.viewer.avatar} alt={v.viewer.username} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white">
                        {v.viewer.username.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs text-white/85">@{v.viewer.username}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="story-viewer-body relative">
          {!story.isLocked && story.mood && (
            <div className="story-viewer-mood-aura" style={{ background: moodAuraCss(story.mood) }} aria-hidden />
          )}

          {story.isLocked ? (
            <div className="story-viewer-locked">
              <span className="story-viewer-locked-icon">
                <LockClosedIcon className="h-8 w-8" />
              </span>
              <p className="story-viewer-locked-title">Time Capsule</p>
              <p className="story-viewer-locked-sub">
                {isOwner ? 'Sealed — even you have to wait.' : `Sealed by ${displayName}.`}
              </p>
              <p className="story-viewer-locked-countdown">Opens in {formatCountdown(lockCountdown)}</p>
            </div>
          ) : isTextOnly ? (
            <div className="story-viewer-text-only" style={{ background: backgroundCss(story.backgroundStyle) }}>
              {!hasDesign && <p>{story.text}</p>}
            </div>
          ) : allMedia.length > 0 ? (
            <div className="story-viewer-media">
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={currentMedia.url}
                  className="w-full h-full object-cover"
                  style={{ filter: filterCss(story.filterStyle) }}
                  autoPlay
                  muted
                  playsInline
                  onLoadedMetadata={handleVideoMeta}
                />
              ) : (
                <Image
                  src={currentMedia.url}
                  alt={story.text ? `Story media from ${displayName}` : `${displayName} story media`}
                  fill
                  className="w-full h-full object-cover"
                  style={{ filter: filterCss(story.filterStyle) }}
                  unoptimized
                />
              )}
              <div className="story-viewer-vignette" />
            </div>
          ) : null}

          {hasDesign && (
            <StoryOverlaysLayer
              overlays={story.overlays || []}
              drawing={story.drawing || []}
              interactive
              isOwner={isOwner}
              pollResults={pollResults}
              questionResponseCounts={questionResponseCounts}
              onVote={handleVote}
              onSubmitAnswer={handleSubmitAnswer}
              onOpenResponses={handleOpenResponses}
            />
          )}

          {story.text && !isTextOnly && !hasDesign && (
            <div className="story-viewer-caption">
              <p>{story.text}</p>
            </div>
          )}

          {story.sharedPost && (
            <Link
              href={`/post/${story.sharedPost.id}`}
              className="story-shared-post-card"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="story-shared-post-icon">📤</span>
              <div className="min-w-0">
                <p className="story-shared-post-title">{t('stories.viewPost')}</p>
                <p className="story-shared-post-sub">@{story.sharedPost.username}</p>
              </div>
            </Link>
          )}

          {openResponsesOverlayId && (
            <div className="story-question-responses-panel" onClick={(e) => e.stopPropagation()}>
              <div className="story-question-responses-header">
                <p>{t('stories.answersTitle')}</p>
                <button type="button" onClick={() => setOpenResponsesOverlayId(null)} aria-label={t('stories.closeAnswers')}>
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              {questionResponses.length === 0 ? (
                <p className="story-question-responses-empty">{t('stories.answersEmpty')}</p>
              ) : (
                questionResponses.map((r) => (
                  <div key={r.id} className="story-question-responses-row">
                    <span className="story-question-responses-avatar">
                      {r.responder.username.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="story-question-responses-username">@{r.responder.username}</p>
                      <p className="story-question-responses-text">{r.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="story-tap-zones">
            <button
              type="button"
              className="story-tap-left"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation();
                if (mediaIdx > 0) prevMedia();
                else if (hasPrev) handlePrev();
              }}
            />
            <button
              type="button"
              className="story-tap-center"
              aria-label={isPaused ? 'Play' : 'Pause'}
              onClick={(e) => {
                e.stopPropagation();
                togglePause();
              }}
            />
            <button
              type="button"
              className="story-tap-right"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation();
                if (mediaIdx < allMedia.length - 1) nextMedia();
                else if (hasNext) handleNext();
              }}
            />
          </div>

          {isPaused && (
            <div className="story-pause-badge" aria-hidden>
              <PauseIcon className="h-10 w-10 text-white" />
            </div>
          )}

          {echoes.length > 0 && (
            <div className="story-echo-layer" aria-hidden>
              {echoes.map((e, i) => (
                <span
                  key={e.id}
                  className="story-echo-bubble"
                  style={{ left: `${15 + ((i * 23) % 70)}%`, animationDelay: `${(i % 3) * 0.15}s` }}
                >
                  {e.emoji}
                </span>
              ))}
            </div>
          )}
        </div>

        {!isOwner && (
          <div className="story-viewer-footer" onClick={(e) => e.stopPropagation()}>
            <PostReactions
              compact
              contentType="story"
              contentId={story.id}
              onReaction={handleReact}
              selectedReaction={myReaction ? EMOJI_BY_REACTION_TYPE[myReaction as ReactionType] : undefined}
              reactionCounts={countsToEmojiMap(reactionCounts)}
            />
            <div className="story-viewer-reply-row">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Reply to ${displayName}…`}
                className="story-viewer-reply-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleReply();
                }}
              />
              <button
                type="button"
                onClick={handleReply}
                className="story-viewer-reply-send"
                aria-label="Send reply"
                disabled={!replyText.trim()}
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </div>
            {replySent && <p className="story-viewer-reply-sent">Sent!</p>}
          </div>
        )}
      </div>

      {hasNext && (
        <button type="button" onClick={handleNext} className="story-nav-outside story-nav-next" aria-label="Next story">
          <ChevronRightIcon className="h-8 w-8" />
        </button>
      )}

      <button type="button" className="story-backdrop-dismiss" onClick={onClose} aria-label="Close story" />
    </div>
  );
}

export { AddStoryModal };

export default function StoriesSidebar() {
  const [startIdx, setStartIdx] = useState(0);
  const [hovered, setHovered] = useState<number|null>(null);
  const [addHovered, setAddHovered] = useState(false);
  const [showStory, setShowStory] = useState<any|null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [storyRings, setStoryRings] = useState<StoryRing[]>([]);
  const [playlist, setPlaylist] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const { rings, flat } = await fetchStoryRings();
      setStoryRings(rings);
      setPlaylist(flat);
    } catch {
      // Keep whatever was already loaded — this is also called to refresh
      // after a delete/mute action, and wiping the sidebar to "no stories"
      // on a failed refresh would be misleading since that action already
      // succeeded.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const endIdx = startIdx + VISIBLE_STORIES;
  const visibleRings = storyRings.slice(startIdx, endIdx);

  const canScrollUp = startIdx > 0;
  const canScrollDown = endIdx < storyRings.length;

  const currentStoryIdx = showStory ? playlist.findIndex((s) => s.id === showStory.id) : -1;
  const hasPrev = currentStoryIdx > 0;
  const hasNext = currentStoryIdx < playlist.length - 1;
  const handlePrev = () => {
    if (hasPrev) setShowStory(playlist[currentStoryIdx - 1]);
  };
  const handleNext = () => {
    if (hasNext) setShowStory(playlist[currentStoryIdx + 1]);
  };

  useEffect(() => {
    if (showStory?.id) trackStoryView(showStory.id);
  }, [showStory?.id, trackStoryView]);

  const openRing = (ring: StoryRing) => {
    if (ring.items.length > 0) setShowStory(ring.items[0]);
  };

  return (
    <aside
      className="hidden md:flex"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: SIDEBAR_WIDTH,
        height: '100vh',
        background: 'rgba(10,10,34,0.85)',
        borderRight: '2px solid',
        borderImage: 'linear-gradient(180deg, #6A00FF, #00CCFF) 1',
        boxShadow: '0 0 16px 2px #6A00FF55',
        zIndex: 50,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 0',
        overflow: 'hidden',
      }}
      aria-label="Stories sidebar"
    >
      {/* Starfield background */}
      <StarfieldBG />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 1, position: 'relative' }}>
        {/* Up arrow just above stories */}
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: canScrollUp ? 'pointer' : 'not-allowed',
            color: canScrollUp ? '#00CCFF' : '#444',
            fontSize: 24,
            marginBottom: 4,
          }}
          aria-label="Scroll up"
          onClick={() => canScrollUp && setStartIdx(startIdx - 1)}
          disabled={!canScrollUp}
        >
          ▲
        </button>
        {/* Stories */}
        {loading ? (
          <p style={{ color: '#fff', fontSize: 18 }}>Loading stories...</p>
        ) : visibleRings.length === 0 ? (
          <p style={{ color: '#fff', fontSize: 18 }}>No stories available.</p>
        ) : (
          visibleRings.map((ring) => (
            <div
              key={ring.userId}
              className="relative"
              onMouseEnter={() => setHovered(ring.userId)}
              onMouseLeave={() => setHovered(null)}
            >
              <StoryRingAvatar
                name={ring.name}
                avatar={ring.avatar}
                count={ring.count}
                size="lg"
                isNew={ring.isNew}
                mood={ring.mood}
                isLocked={ring.isLocked}
                audience={ring.audience}
                onClick={() => openRing(ring)}
              />
              {hovered === ring.userId && (
                <div className="story-sidebar-tooltip">
                  {ring.name}
                  {ring.count > 1 && <span className="opacity-75"> · {ring.count}</span>}
                </div>
              )}
            </div>
          ))
        )}
        {/* Down arrow just below stories */}
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: canScrollDown ? 'pointer' : 'not-allowed',
            color: canScrollDown ? '#00CCFF' : '#444',
            fontSize: 24,
            marginTop: 4,
          }}
          aria-label="Scroll down"
          onClick={() => canScrollDown && setStartIdx(startIdx + 1)}
          disabled={!canScrollDown}
        >
          ▼
        </button>
        {/* Add Story button below down arrow */}
        <button
          style={{
            marginTop: 18,
            width: addHovered ? 54 : 44,
            height: addHovered ? 54 : 44,
            borderRadius: '50%',
            border: 'none',
            background: 'radial-gradient(circle at 60% 40%, #fff 0%, #6A00FF 40%, #00CCFF 100%)',
            boxShadow: addHovered
              ? '0 0 32px 12px #00CCFF99, 0 0 48px 16px #6A00FF77'
              : '0 0 16px 4px #00CCFF55, 0 0 24px 8px #6A00FF44',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.22s cubic-bezier(.4,2,.6,1)',
            cursor: 'pointer',
            position: 'relative',
            outline: 'none',
          }}
          aria-label="Add Story"
          onMouseEnter={() => setAddHovered(true)}
          onMouseLeave={() => setAddHovered(false)}
          onClick={() => setShowAdd(true)}
        >
          <span
            style={{
              fontSize: addHovered ? 32 : 24,
              color: '#fff',
              textShadow: '0 0 8px #00CCFF, 0 0 16px #6A00FF',
              transition: 'font-size 0.22s cubic-bezier(.4,2,.6,1)',
              fontWeight: 700,
              userSelect: 'none',
            }}
          >
            +
          </span>
          {/* Stardust effect on hover */}
          {addHovered && (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                boxShadow: '0 0 32px 12px #fff8, 0 0 64px 24px #00CCFF44',
                pointerEvents: 'none',
                opacity: 0.7,
                animation: 'pulseGlow 1.2s infinite alternate',
              }}
            />
          )}
        </button>
      </div>
      {/* Add keyframes for stardust glow */}
      <style>{`
        @keyframes pulseGlow {
          0% { opacity: 0.7; filter: blur(0px); }
          100% { opacity: 1; filter: blur(2px); }
        }
      `}</style>
      {/* Story modal */}
      {showStory && (
        <StoryModal
          story={showStory}
          onClose={() => setShowStory(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onDeleted={() => fetchStories()}
          onMuted={() => fetchStories()}
        />
      )}
      {/* Add story modal */}
      {showAdd && <AddStoryModal onClose={() => setShowAdd(false)} onCreated={fetchStories} />}
    </aside>
  );
} 