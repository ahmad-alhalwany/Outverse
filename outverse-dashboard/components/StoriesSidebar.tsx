'use client'

<<<<<<< HEAD
import React, { useState, useRef, useEffect, useCallback } from 'react';
import CosmicVideoPlayer from './CosmicVideoPlayer';
import { apiFetch } from '@/lib/api';
import { STORIES_API, mapStoryFromApi, groupStoriesByUser, type StoryItem, type StoryRing } from '@/lib/storyUtils';
import { StorySegmentProgress } from './stories/StorySegmentProgress';
import StoryRingAvatar from './stories/StoryRingAvatar';
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, EyeIcon, PauseIcon } from '@heroicons/react/24/solid';

const SIDEBAR_WIDTH = 80;
const VISIBLE_STORIES = 4;
const STAR_COUNT = 36;
const SWITCH_SOUND_URL = 'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae5b2.mp3'; // Example short UI sound

const API_URL = STORIES_API;
=======
import React, { useState, useRef, useEffect } from 'react';
import CosmicVideoPlayer from './CosmicVideoPlayer';

const SIDEBAR_WIDTH = 80;
const VISIBLE_STORIES = 6;
const STAR_COUNT = 36;
const SWITCH_SOUND_URL = 'https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae5b2.mp3'; // Example short UI sound

const currentUser = {
  name: 'Alex Creative',
  avatar: 'https://randomuser.me/api/portraits/men/10.jpg',
};

const API_URL = 'http://localhost:8000/api/stories/';
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660

function StarfieldBG() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animationId: number;
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
    draw();
    return () => cancelAnimationFrame(animationId);
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

<<<<<<< HEAD
export function StoryModal({ story, onClose, onPrev, onNext, hasPrev, hasNext }: { story: any, onClose: () => void, onPrev: () => void, onNext: () => void, hasPrev: boolean, hasNext: boolean }) {
=======
function StoryModal({ story, onClose, onPrev, onNext, hasPrev, hasNext }: { story: any, onClose: () => void, onPrev: () => void, onNext: () => void, hasPrev: boolean, hasNext: boolean }) {
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
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

  // Timer logic
  useEffect(() => {
    // لا نحتاج للتايمر للفيديوهات، سنعتمد على انتهاء الفيديو
    if (isVideo) return;
    
    if (!timerActive || isPaused) return;
    
    // إعادة تعيين وقت البداية إذا لم يكن محدداً
    if (startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
    
    let localDuration = durationRef.current || duration;
    
    function tick() {
      const elapsed = Date.now() - startTimeRef.current;
      const progressValue = Math.min(elapsed / localDuration, 1); // من 0 إلى 1
      
      // تحديث سلس مع requestAnimationFrame
      requestAnimationFrame(() => {
        setProgress(progressValue);
      });
      
      if (elapsed < localDuration) {
        timerRef.current = setTimeout(tick, 16); // تحديث كل 16ms (60fps) للسلاسة
      } else {
        setProgress(1);
        // انتقل للوسائط التالية أو للقصة التالية
        if (mediaIdx < allMedia.length - 1) {
          setMediaIdx(mediaIdx + 1);
          setProgress(0);
          startTimeRef.current = 0; // إعادة تعيين وقت البداية
        } else if (hasNext) {
          onNext();
        } else {
          // إغلاق الستوري عند انتهاء آخر ستوري
          onClose();
        }
      }
    }
    tick();
    return () => { if (timerRef.current) { clearTimeout(timerRef.current); } };
    // eslint-disable-next-line
  }, [story, timerActive, mediaIdx, allMedia.length, hasNext, onNext, isVideo, isPaused]);

  // For video: set duration to video length (max 30s)
  const handleVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    let d = Math.min(video.duration * 1000, 30000); // 30 seconds max
    durationRef.current = d;
    setProgress(0);
    setTimerActive(false); // إيقاف التايمر العادي للفيديوهات
  };

  // إضافة event listener لانتهاء الفيديو وتحديث التايمر
  useEffect(() => {
    if (!isVideo) return;
    
    const handleVideoEnded = () => {
      // عند انتهاء الفيديو، انتقل للوسيط التالي أو القصة التالية
      if (mediaIdx < allMedia.length - 1) {
        setMediaIdx(mediaIdx + 1);
        setProgress(0);
      } else if (hasNext) {
        onNext();
      } else {
        // إغلاق الستوري عند انتهاء آخر ستوري
        onClose();
      }
    };

    const handleTimeUpdate = () => {
      if (isPaused) return; // لا تحديث إذا كان متوقف
      
      const videoElement = document.querySelector('video');
      if (videoElement && videoElement.duration > 0) {
        // تحديث التايمر حسب وقت الفيديو الحالي (من 0 إلى 1)
        const currentTime = videoElement.currentTime;
        const duration = videoElement.duration;
        const progressValue = currentTime / duration; // من 0 إلى 1
        
        // تحديث أكثر سلاسة مع requestAnimationFrame
        requestAnimationFrame(() => {
          setProgress(progressValue);
        });
      }
    };

    const handleLoadedMetadata = () => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        // إعادة تعيين التايمر عند تحميل الفيديو
        setProgress(0);
        setTimerActive(false);
        
        // بدء تحديث التايمر فوراً وبشكل سلس
        const updateProgress = () => {
          if (videoElement && videoElement.duration > 0) {
            const currentTime = videoElement.currentTime;
            const duration = videoElement.duration;
            const progressValue = currentTime / duration;
            
            // تحديث سلس مع requestAnimationFrame
            requestAnimationFrame(() => {
              setProgress(progressValue);
            });
          }
        };
        
        // تحديث أولي
        updateProgress();
      }
    };

    const handlePlay = () => {
      // عند بدء التشغيل، تأكد من تحديث التايمر
      const videoElement = document.querySelector('video');
      if (videoElement) {
        requestAnimationFrame(() => {
          setProgress(0);
        });
      }
    };
    
    // إضافة event listeners للفيديو الحالي
    const videoElement = document.querySelector('video');
    if (videoElement) {
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
    }
  }, [isVideo, mediaIdx, allMedia.length, hasNext, onNext]);

  // ضبط التايمر حسب نوع الوسيط
  useEffect(() => {
    if (isVideo) {
      // للفيديوهات، نعتمد على انتهاء الفيديو
      setTimerActive(false);
      setProgress(0); // إعادة تعيين التايمر عند تغيير الوسيط
    } else {
      // للصور والنصوص، نستخدم التايمر العادي
      setTimerActive(true);
      setProgress(0); // إعادة تعيين التايمر عند تغيير الوسيط
    }
    
    // إعادة تعيين حالة الإيقاف عند تغيير الوسيط
    setIsPaused(false);
    setPauseStartTime(null);
    setElapsedBeforePause(0);
    startTimeRef.current = 0;
  }, [isVideo, mediaIdx]);

  // إضافة تحسين للتايمر الكوني
  const normalizedProgress = Math.max(0, Math.min(1, progress)); // ضمان أن القيمة من 0 إلى 1
  
  // تحسين الأداء مع useMemo
  const memoizedProgress = React.useMemo(() => normalizedProgress, [normalizedProgress]);
  // Pause timer when video is paused, resume when playing
  const handleVideoPlay = () => {
    if (isVideo) {
      // للفيديوهات، لا نحتاج للتايمر العادي
      setTimerActive(false);
    } else {
      setTimerActive(true);
      // إعادة تعيين التايمر عند بدء الفيديو
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setProgress(0);
    }
  };
  const handleVideoPause = () => setTimerActive(false);

  // Reset timer on manual navigation
  useEffect(() => {
    setProgress(0);
    setTimerActive(true);
    durationRef.current = isVideo ? durationRef.current : duration;
    // eslint-disable-next-line
  }, [direction]);

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

  // دالة إيقاف/تشغيل الستوري
  const togglePause = () => {
    if (isPaused) {
      // استئناف الستوري
      setIsPaused(false);
      setTimerActive(true);
      
      if (isVideo) {
        // استئناف الفيديو
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.play();
        }
      } else {
        // استئناف التايمر العادي
        if (pauseStartTime && elapsedBeforePause > 0) {
          const remainingTime = durationRef.current - elapsedBeforePause;
          startTimeRef.current = Date.now() - (durationRef.current - remainingTime);
        } else {
          startTimeRef.current = Date.now();
        }
      }
    } else {
      // إيقاف الستوري
      setIsPaused(true);
      setTimerActive(false);
      
      if (isVideo) {
        // إيقاف الفيديو
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.pause();
        }
      } else {
        // حفظ الوقت المنقضي قبل الإيقاف
        const elapsed = Date.now() - startTimeRef.current;
        setElapsedBeforePause(elapsed);
        setPauseStartTime(Date.now());
      }
    }
  };

  if (!story) return null;
<<<<<<< HEAD

  const segmentCount = Math.max(allMedia.length, 1);
  const displayName = story.name || story.user?.name || 'Story';
  const avatarSrc = story.avatar || story.user?.avatar || '';

  return (
    <div className="story-viewer-backdrop" role="dialog" aria-modal="true" aria-label="Story viewer">
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
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className="story-viewer-avatar" />
              ) : (
                <span className="story-viewer-avatar story-viewer-avatar--fallback">
                  {displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{displayName}</p>
                {(story.views ?? 0) > 0 && (
                  <p className="text-[11px] text-white/70 flex items-center gap-1">
                    <EyeIcon className="h-3.5 w-3.5" />
                    {(story.views ?? 0).toLocaleString()} views
                  </p>
                )}
              </div>
            </div>
            <button type="button" onClick={onClose} className="story-viewer-close" aria-label="Close">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="story-viewer-body relative">
          {isTextOnly ? (
            <div className="story-viewer-text-only">
              <p>{story.text}</p>
            </div>
          ) : allMedia.length > 0 ? (
            <div className="story-viewer-media">
              {isVideo ? (
                <CosmicVideoPlayer
                  src={currentMedia.url}
                  style={{ width: '100%', height: '100%' }}
                  isStory
                  autoPlay
                  muted
                  loop={false}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentMedia.url} alt="" className="w-full h-full object-cover" />
              )}
              <div className="story-viewer-vignette" />
            </div>
          ) : null}

          {story.text && !isTextOnly && (
            <div className="story-viewer-caption">
              <p>{story.text}</p>
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
        </div>
      </div>

      {hasNext && (
        <button type="button" onClick={handleNext} className="story-nav-outside story-nav-next" aria-label="Next story">
          <ChevronRightIcon className="h-8 w-8" />
        </button>
      )}

      <button type="button" className="story-backdrop-dismiss" onClick={onClose} aria-label="Close story" />
=======
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(10,10,34,0.85)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '40px',
      paddingBottom: '40px',
      backdropFilter: 'blur(2px)',
      overflow: 'auto',
    }}>
      <audio ref={audioRef} src={SWITCH_SOUND_URL} preload="auto" style={{ display: 'none' }} />
      {/* Prev arrow */}
      {hasPrev && (
        <button onClick={handlePrev} style={{
          position: 'absolute',
          left: 32,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: '#00CCFF',
          fontSize: 44,
          cursor: 'pointer',
          zIndex: 2,
          padding: 0,
        }} aria-label="Previous story">&#8592;</button>
      )}
      <div
        style={{
          background: 'linear-gradient(135deg, #23234a 60%, #1a1a38 100%)',
          borderRadius: 24,
          boxShadow: '0 8px 48px #00CCFF33, 0 2px 12px #6A00FF44',
          padding: '24px',
          width: 'min(90vw, 480px)',
          height: 'min(80vh, 680px)',
          maxWidth: '480px',
          maxHeight: '680px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          marginTop: '60px',
          transition: 'transform 0.32s cubic-bezier(.4,2,.6,1), opacity 0.32s cubic-bezier(.4,2,.6,1)',
          opacity: animating ? 0 : 1,
          transform: animating
            ? direction === 'right'
              ? 'translateX(80px) scale(0.98)'
              : 'translateX(-80px) scale(0.98)'
            : 'translateX(0) scale(1)',
          overflow: 'hidden',
        }}
      >
        {/* Cosmic particles background */}
        <CosmicParticlesBG width={480} height={720} />
        {/* منطقة النقر لإيقاف/تشغيل الستوري */}
        <div
          onClick={togglePause}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            cursor: 'pointer',
            zIndex: 1,
          }}
        />
        {/* مؤشر الإيقاف */}
        {isPaused && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            backdropFilter: 'blur(4px)',
          }}>
            <div style={{
              width: 0,
              height: 0,
              borderLeft: '20px solid #00CCFF',
              borderTop: '12px solid transparent',
              borderBottom: '12px solid transparent',
              marginLeft: '4px',
            }} />
          </div>
        )}
        {/* Top bar: avatar, name, timer, close button */}
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          zIndex: 2,
          gap: '16px',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img 
              src={story.avatar || (story.user && story.user.avatar) || currentUser.avatar} 
              alt={story.name || (story.user && story.user.name) || currentUser.name} 
              style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px', 
                boxShadow: '0 2px 8px #00CCFF33',
                border: '2px solid rgba(0, 204, 255, 0.3)'
              }} 
            />
            <span style={{ 
              color: '#fff', 
              fontWeight: 600, 
              fontSize: '18px',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)'
            }}>{(story.user && story.user.name) || currentUser.name}</span>
          </div>
          <div style={{ marginLeft: '12px', marginRight: '12px' }}>
            <OrbitingPlanetTimer progress={memoizedProgress} size={72} />
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(0,0,0,0.3)',
            border: 'none',
            color: '#fff',
            fontSize: '32px',
            cursor: 'pointer',
            zIndex: 2,
            marginLeft: '8px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }} 
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          aria-label="Close">×</button>
        </div>
                {/* Story text - عرض مختلف حسب وجود الوسائط */}
        {isTextOnly ? (
          // عرض النص في المنتصف عندما يكون نص فقط
          <div style={{ 
            color: '#AAB6FF', 
            fontSize: '22px', 
            lineHeight: '1.6',
            textAlign: 'center', 
            zIndex: 1, 
            maxWidth: '90%', 
            padding: '0 20px',
            wordBreak: 'break-word',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100% - 120px)',
            minHeight: '300px',
            marginTop: '20px'
          }}>
            <div style={{
              maxWidth: '400px',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              position: 'relative'
            }}>
              {story.text}
            </div>
          </div>
        ) : (
          // عرض النص العادي عندما توجد وسائط
          <div style={{ 
            color: '#AAB6FF', 
            fontSize: '18px', 
            lineHeight: '1.5',
            margin: '80px 0 24px 0', 
            textAlign: 'center', 
            zIndex: 1, 
            minHeight: '24px', 
            maxWidth: '100%', 
            padding: '0 16px',
            wordBreak: 'break-word' 
          }}>{story.text}</div>
        )}
        {/* عرض الوسائط مع السلايدر المختلط */}
        {allMedia.length > 0 && (
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: 'calc(100% - 120px)', 
            minHeight: '400px',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            background: '#181a2a', 
            borderRadius: 16, 
            boxShadow: '0 2px 16px #00CCFF22', 
            overflow: 'hidden', 
            transition: 'opacity 0.32s cubic-bezier(.4,2,.6,1)', 
            zIndex: 1,
            marginTop: '16px'
          }}>
            {/* مناطق النقر للتنقل */}
            {hasMultipleMedia && (
              <>
                <div
                  onClick={prevMedia}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '30%',
                    height: '100%',
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                />
                <div
                  onClick={nextMedia}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: '30%',
                    height: '100%',
                    cursor: 'pointer',
                    zIndex: 2,
                  }}
                />
              </>
            )}
            {/* أزرار التنقل بين الوسائط */}
            {hasMultipleMedia && (
              <>
                {mediaIdx > 0 && (
                  <button onClick={prevMedia} style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.7)',
                    border: '1px solid rgba(0, 204, 255, 0.3)',
                    color: '#00CCFF',
                    fontSize: '24px',
                    cursor: 'pointer',
                    zIndex: 3,
                    padding: '12px 8px',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(4px)',
                  }} 
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 204, 255, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                  aria-label="Previous media">‹</button>
                )}
                {mediaIdx < allMedia.length - 1 && (
                  <button onClick={nextMedia} style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(0,0,0,0.7)',
                    border: '1px solid rgba(0, 204, 255, 0.3)',
                    color: '#00CCFF',
                    fontSize: '24px',
                    cursor: 'pointer',
                    zIndex: 3,
                    padding: '12px 8px',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(4px)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 204, 255, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.7)';
                    e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                  }}
                  aria-label="Next media">›</button>
                )}
                {/* مؤشر الوسائط */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '6px',
                  zIndex: 3,
                }}>
                  {allMedia.map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: idx === mediaIdx ? '#00CCFF' : 'rgba(255,255,255,0.3)',
                        transition: 'all 0.2s',
                        boxShadow: idx === mediaIdx ? '0 0 8px #00CCFF' : 'none',
                      }}
                    />
                  ))}
                </div>
                {/* شريط التقدم للوسائط */}
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  right: '12px',
                  height: '3px',
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: '2px',
                  zIndex: 3,
                  backdropFilter: 'blur(4px)',
                }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #00CCFF, #6A00FF)',
                      borderRadius: '2px',
                      width: `${((mediaIdx + 1) / allMedia.length) * 100}%`,
                      transition: 'width 0.3s ease',
                      boxShadow: '0 0 8px rgba(0, 204, 255, 0.5)',
                    }}
                  />
                </div>
              </>
            )}
            {/* عرض الوسائط الحالية */}
            {isVideo ? (
              <CosmicVideoPlayer
                src={currentMedia.url}
                style={{ width: '100%', height: '100%' }}
                isStory={true}
                autoPlay={true}
                muted={true}
                loop={false}
              />
            ) : (
              <img src={currentMedia.url} alt="Story media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
        )}
      </div>
      {/* Next arrow */}
      {hasNext && (
        <button onClick={handleNext} style={{
          position: 'absolute',
          right: 32,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: '#00CCFF',
          fontSize: 44,
          cursor: 'pointer',
          zIndex: 2,
          padding: 0,
        }} aria-label="Next story">&#8594;</button>
      )}
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
    </div>
  );
}

<<<<<<< HEAD
export function AddStoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleMediaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !mediaFile) {
=======
function AddStoryModal({ onClose, onAdd }: { onClose: () => void, onAdd: (story: any) => void }) {
  const [text, setText] = useState('');
  const [avatar, setAvatar] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [error, setError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection for avatar
  const handleAvatarIconClick = () => {
    avatarInputRef.current?.click();
  };
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(URL.createObjectURL(file));
    }
  };

  // Handle file selection for media
  const handleMediaIconClick = () => {
    mediaInputRef.current?.click();
  };
  const handleMediaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text && !avatar && !mediaUrl) {
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
      setError('Please add story text, an image, or a video.');
      return;
    }
    setError('');
<<<<<<< HEAD
    setSubmitting(true);
    try {
      const form = new FormData();
      if (text.trim()) form.append('text', text.trim());
      if (mediaFile) {
        if (mediaFile.type.startsWith('video')) form.append('video', mediaFile);
        else form.append('image', mediaFile);
      }
      const res = await apiFetch('stories/', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Failed to publish story');
      onCreated();
      onClose();
    } catch {
      setError('Could not publish story. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="story-add-backdrop">
      <form onSubmit={handleSubmit} className="story-add-form">
        <button onClick={onClose} type="button" className="story-add-close" aria-label="Close">
          <XMarkIcon className="h-5 w-5" />
        </button>
        <h3 className="story-add-title">New cosmic story</h3>
        <p className="story-add-sub">Share a moment — text, photo, or short video</p>
        <textarea
          placeholder="Write something magical… (optional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="story-add-textarea"
        />
        <button type="button" onClick={() => mediaInputRef.current?.click()} className="story-add-media-btn">
          🎬 Add image or video
        </button>
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleMediaFile}
        />
        {mediaPreview && (
          <div className="story-add-preview">
            {mediaFile?.type.startsWith('video') ? (
              <video src={mediaPreview} controls className="w-full max-h-40 rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaPreview} alt="preview" className="w-full max-h-40 rounded-lg object-cover" />
            )}
          </div>
        )}
        {error && <p className="story-add-error">{error}</p>}
        <button type="submit" disabled={submitting} className="story-add-submit cosmic-btn w-full !py-3 mt-2">
          {submitting ? 'Launching…' : 'Publish story'}
        </button>
=======
    onAdd({
      text,
      avatar: avatar || currentUser.avatar,
      mediaUrl,
      id: Date.now(),
      status: 'online',
      isNew: true,
      isActive: false,
      user: currentUser,
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(10,10,34,0.85)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: 'linear-gradient(135deg, #23234a 60%, #1a1a38 100%)',
        borderRadius: 24,
        boxShadow: '0 8px 48px #00CCFF33, 0 2px 12px #6A00FF44',
        padding: 36,
        minWidth: 320,
        minHeight: 260,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      }}>
        <button onClick={onClose} type="button" style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: 28,
          cursor: 'pointer',
          zIndex: 2,
        }} aria-label="Close">×</button>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 22, marginBottom: 18 }}>Add New Story</div>
        <textarea
          placeholder="Story text (optional)"
          value={text}
          onChange={e => setText(e.target.value)}
          style={{ marginBottom: 12, padding: 8, borderRadius: 8, border: '1px solid #444', width: 200, color: '#111', fontWeight: 500, minHeight: 48, resize: 'vertical' }}
        />
        {/* Avatar URL with icon */}
        <div style={{ position: 'relative', width: 200, marginBottom: 12 }}>
          <span
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#6A00FF', cursor: 'pointer', zIndex: 2 }}
            onClick={handleAvatarIconClick}
            title="Upload image"
            role="button"
            tabIndex={0}
          >🖼️</span>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarFile}
          />
          <input
            type="text"
            placeholder="Avatar URL (optional)"
            value={avatar}
            onChange={e => setAvatar(e.target.value)}
            style={{
              padding: '8px 8px 8px 34px',
              borderRadius: 8,
              border: '1px solid #444',
              width: '100%',
              color: '#111',
              fontWeight: 500,
            }}
          />
        </div>
        {/* Media URL with icon */}
        <div style={{ position: 'relative', width: 200, marginBottom: 18 }}>
          <span
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#00CCFF', cursor: 'pointer', zIndex: 2 }}
            onClick={handleMediaIconClick}
            title="Upload image or video"
            role="button"
            tabIndex={0}
          >🎬</span>
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleMediaFile}
          />
          <input
            type="text"
            placeholder="Media URL (image or video, optional)"
            value={mediaUrl}
            onChange={e => setMediaUrl(e.target.value)}
            style={{
              padding: '8px 8px 8px 34px',
              borderRadius: 8,
              border: '1px solid #444',
              width: '100%',
              color: '#111',
              fontWeight: 500,
            }}
          />
        </div>
        {error && <div style={{ color: '#ff5a5a', marginBottom: 8, fontWeight: 500 }}>{error}</div>}
        <button type="submit" style={{ background: 'linear-gradient(90deg, #6A00FF, #00CCFF)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginTop: 8 }}>Add</button>
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
      </form>
    </div>
  );
}

export default function StoriesSidebar() {
  const [startIdx, setStartIdx] = useState(0);
  const [hovered, setHovered] = useState<number|null>(null);
  const [addHovered, setAddHovered] = useState(false);
  const [showStory, setShowStory] = useState<any|null>(null);
  const [showAdd, setShowAdd] = useState(false);
<<<<<<< HEAD
  const [storyRings, setStoryRings] = useState<StoryRing[]>([]);
  const [playlist, setPlaylist] = useState<StoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.results || [];
      const { rings, flat } = groupStoriesByUser(list.map(mapStoryFromApi));
      setStoryRings(rings);
      setPlaylist(flat);
    } catch {
      setStoryRings([]);
      setPlaylist([]);
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

  const trackStoryView = useCallback((storyId: number) => {
    fetch(`${API_URL}${storyId}/increment_views/`, { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (showStory?.id) trackStoryView(showStory.id);
  }, [showStory?.id, trackStoryView]);

  const openRing = (ring: StoryRing) => {
    if (ring.items.length > 0) setShowStory(ring.items[0]);
=======
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStories() {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();
        // تحويل بيانات API للبنية المطلوبة
        const mapped = data.map((story: any) => {
          const user = story.user || {};
          // اختر أول صورة أو فيديو (للعرض في الأفاتار)
          let mediaUrl = '';
          if (story.image) mediaUrl = fullMediaUrl(story.image);
          else if (story.video) mediaUrl = fullMediaUrl(story.video);
          else if (story.media && story.media.length > 0) {
            const m = story.media[0];
            mediaUrl = fullMediaUrl(m.media_file);
          }
          return {
            id: story.id,
            name: user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.username || '',
            avatar: user.avatar || '',
            status: 'online',
            isNew: true,
            isActive: false,
            mediaUrl,
            text: story.text,
            media: story.media ? story.media.map((m: any) => ({
              type: m.media_type,
              url: fullMediaUrl(m.media_file),
            })) : [],
          };
        });
        setStories(mapped);
      } catch (err) {
        setStories([]);
      } finally {
        setLoading(false);
      }
    }
    fetchStories();
  }, []);

  function fullMediaUrl(url: string) {
    if (!url) return '';
    return url.startsWith('http') ? url : `http://localhost:8000${url}`;
  }

  const endIdx = startIdx + VISIBLE_STORIES;
  const visibleStories = stories.slice(startIdx, endIdx);

  const canScrollUp = startIdx > 0;
  const canScrollDown = endIdx < stories.length;

  // For modal navigation
  const currentStoryIdx = showStory ? stories.findIndex(s => s.id === showStory.id) : -1;
  const hasPrev = currentStoryIdx > 0;
  const hasNext = currentStoryIdx < stories.length - 1;
  const handlePrev = () => {
    if (hasPrev) setShowStory(stories[currentStoryIdx - 1]);
  };
  const handleNext = () => {
    if (hasNext) setShowStory(stories[currentStoryIdx + 1]);
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
  };

  return (
    <aside
<<<<<<< HEAD
      className="hidden md:flex"
=======
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
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
<<<<<<< HEAD
=======
        display: 'flex',
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
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
<<<<<<< HEAD
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
                onClick={() => openRing(ring)}
              />
              {hovered === ring.userId && (
                <div className="story-sidebar-tooltip">
                  {ring.name}
                  {ring.count > 1 && <span className="opacity-75"> · {ring.count}</span>}
                </div>
              )}
            </div>
=======
        ) : visibleStories.length === 0 ? (
          <p style={{ color: '#fff', fontSize: 18 }}>No stories available.</p>
        ) : (
          visibleStories.map((story, i) => (
          <div
            key={story.id}
            style={{
              width: hovered === story.id ? 60 : 48,
              height: hovered === story.id ? 60 : 48,
              background: 'linear-gradient(135deg, #23234a 60%, #1a1a38 100%)',
              clipPath: 'polygon(25% 6.7%, 75% 6.7%, 100% 50%, 75% 93.3%, 25% 93.3%, 0% 50%)',
              border: story.isNew ? '2px solid #00CCFF' : '2px solid #6A00FF',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: story.isActive
                ? '0 0 24px 8px #6A00FF88, 0 0 32px 8px #00CCFF44'
                : hovered === story.id
                ? '0 0 24px 8px #00CCFF99, 0 0 32px 8px #6A00FF44'
                : '0 0 8px 2px #6A00FF44',
              transform: 'rotate(45deg)',
              position: 'relative',
              transition: 'all 0.18s cubic-bezier(.4,2,.6,1)',
              cursor: 'pointer',
            }}
            aria-label={`Story slot ${i+1}`}
            onMouseEnter={() => setHovered(story.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setShowStory(story)}
          >
            {/* Avatar upright inside hexagon */}
            <img
              src={story.avatar}
              alt={story.name}
              style={{
                width: hovered === story.id ? 46 : 36,
                height: hovered === story.id ? 46 : 36,
                objectFit: 'cover',
                borderRadius: 8,
                transform: 'rotate(-45deg)',
                boxShadow: '0 1px 4px #0008',
                background: '#222',
                transition: 'all 0.18s cubic-bezier(.4,2,.6,1)',
              }}
            />
            {/* Status indicators */}
            {/* Online: gold dot bottom right */}
            {story.status === 'online' && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 6,
                  right: 6,
                  width: 10,
                  height: 10,
                  background: 'gold',
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  boxShadow: '0 0 6px 2px gold',
                  zIndex: 2,
                }}
                title="Online"
              />
            )}
            {/* Bio card on hover */}
            {hovered === story.id && (
              <div
                style={{
                  position: 'absolute',
                  left: 60,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  minWidth: 120,
                  background: 'rgba(20,24,48,0.98)',
                  color: '#fff',
                  borderRadius: 12,
                  boxShadow: '0 4px 24px #00CCFF44, 0 1.5px 8px #6A00FF55',
                  padding: '12px 16px',
                  fontSize: 15,
                  fontWeight: 500,
                  letterSpacing: 0.2,
                  opacity: 1,
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  transition: 'opacity 0.18s cubic-bezier(.4,2,.6,1), transform 0.18s cubic-bezier(.4,2,.6,1)',
                  zIndex: 10,
                }}
              >
                {story.name}
              </div>
            )}
          </div>
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
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
        />
      )}
      {/* Add story modal */}
<<<<<<< HEAD
      {showAdd && <AddStoryModal onClose={() => setShowAdd(false)} onCreated={fetchStories} />}
=======
      {showAdd && <AddStoryModal onClose={() => setShowAdd(false)} onAdd={story => setStories([story, ...stories])} />}
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
    </aside>
  );
} 