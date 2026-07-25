'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ArrowsPointingOutIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/solid';

interface CosmicVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  style?: React.CSSProperties;
  isStory?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
}

export type CosmicVideoPlayerHandle = {
  seekTo: (seconds: number, options?: { play?: boolean }) => void;
};

const formatTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

function CosmicParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => {
        const seed = (i + 1) * 9973;
        const rand = (n: number) => ((seed * (n + 3)) % 1000) / 1000;
        return {
          w: 2 + rand(1) * 3,
          left: rand(2) * 98,
          top: rand(3) * 98,
          opacity: 0.25 + rand(4) * 0.55,
          duration: 2.2 + rand(5) * 2.8,
          delay: rand(6) * 2,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/80 shadow-[0_0_8px_rgba(196,181,253,0.7)] animate-cosmic-particle"
          style={{
            width: p.w,
            height: p.w,
            left: `${p.left}%`,
            top: `${p.top}%`,
            opacity: p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

const CosmicVideoPlayer = forwardRef<CosmicVideoPlayerHandle, CosmicVideoPlayerProps>(({
  src,
  poster,
  className = '',
  style,
  isStory = false,
  autoPlay = false,
  muted: initialMuted = false,
  loop = false,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(initialMuted);
  const [seeking, setSeeking] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [buffered, setBuffered] = useState(0);

  useEffect(() => {
    if (!autoPlay || !videoRef.current) return;
    void videoRef.current.play().catch(() => setPlaying(false));
  }, [autoPlay, src]);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds, options) => {
      const v = videoRef.current;
      if (!v) return;
      const max = duration || v.duration || Number.POSITIVE_INFINITY;
      v.currentTime = Math.max(0, Math.min(max, seconds));
      setCurrent(v.currentTime);
      if (options?.play) {
        void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    },
  }), [duration]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isStory) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const onMeta = () => {
      if (v.duration > 30) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          v.pause();
          setPlaying(false);
        }, 30000);
      }
    };
    v.addEventListener('loadedmetadata', onMeta);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      if (timeout) clearTimeout(timeout);
    };
  }, [isStory, src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!seeking) setCurrent(v.currentTime || 0);
    try {
      if (v.buffered.length) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    } catch {
      /* ignore */
    }
  };

  const handleLoaded = () => setDuration(videoRef.current?.duration || 0);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrent(val);
    if (videoRef.current) videoRef.current.currentTime = val;
  };

  const skip = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration || v.duration || 0, (v.currentTime || 0) + sec));
    setCurrent(v.currentTime);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  const toggleFullscreen = async () => {
    const el = shellRef.current || videoRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      videoRef.current?.requestFullscreen?.();
    }
  };

  const progress = duration ? (current / duration) * 100 : 0;
  const bufferPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;
  const showControls = !isStory && (hovering || !playing);

  return (
    <div
      ref={shellRef}
      className={`group relative overflow-hidden rounded-2xl bg-[#0c0818] ${className}`}
      style={{
        ...style,
        boxShadow:
          '0 0 0 1px rgba(167,139,250,0.22), 0 18px 50px rgba(8,6,24,0.45), 0 0 40px rgba(106,0,255,0.12)',
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, rgba(106,0,255,0.28), transparent 50%), radial-gradient(ellipse at 90% 100%, rgba(0,204,255,0.14), transparent 45%)',
        }}
      />
      <CosmicParticles />

      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="relative z-10 block h-full w-full object-cover"
        style={{ maxHeight: style?.maxHeight ?? 520, minHeight: style?.minHeight ?? undefined }}
        controls={false}
        playsInline
        preload={autoPlay ? 'metadata' : 'none'}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop && !isStory}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
      />

      {/* Center play affordance */}
      {!playing && !isStory ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center"
          aria-label="Play"
        >
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(196,181,253,0.35)] bg-[rgba(20,16,42,0.72)] text-white backdrop-blur-md transition hover:scale-105"
            style={{ boxShadow: '0 0 28px rgba(106,0,255,0.45)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          </span>
        </button>
      ) : null}

      {!isStory && (
        <div
          className={`absolute bottom-0 left-0 z-30 w-full bg-gradient-to-t from-[#0c0818]/95 via-[#0c0818]/45 to-transparent px-3 pb-3 pt-10 transition-opacity duration-200 ${
            showControls ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <div className="relative mb-2.5 h-4 w-full">
            <div className="absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/15" />
            <div
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/25"
              style={{ width: `${bufferPct}%` }}
            />
            <div
              className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #7C3AED 0%, #A78BFA 55%, #22D3EE 100%)',
                boxShadow: '0 0 14px rgba(167,139,250,0.65)',
              }}
            />
            {duration > 0 ? (
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                style={{
                  left: `${progress}%`,
                  background: 'linear-gradient(135deg, #C4B5FD, #22D3EE)',
                  boxShadow: '0 0 12px rgba(167,139,250,0.9)',
                }}
              />
            ) : null}
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.05}
              value={current}
              onChange={handleSeek}
              onMouseDown={() => setSeeking(true)}
              onMouseUp={() => setSeeking(false)}
              onTouchStart={() => setSeeking(true)}
              onTouchEnd={() => setSeeking(false)}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              aria-label="Seek"
            />
          </div>

          <div className="flex items-center gap-1.5 text-white">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(196,181,253,0.28)] bg-white/10 backdrop-blur-sm transition hover:bg-vault/40"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z" /></svg>
              )}
            </button>
            <button type="button" onClick={() => skip(-10)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/10">
              −10s
            </button>
            <button type="button" onClick={() => skip(10)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/10">
              +10s
            </button>
            <span className="min-w-[72px] text-center text-[11px] tabular-nums text-white/75">
              {formatTime(current)} / {formatTime(duration)}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(196,181,253,0.22)] bg-white/10 hover:bg-vault/35"
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <SpeakerXMarkIcon className="h-4 w-4" /> : <SpeakerWaveIcon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(196,181,253,0.22)] bg-white/10 hover:bg-vault/35"
              aria-label="Fullscreen"
            >
              <ArrowsPointingOutIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

CosmicVideoPlayer.displayName = 'CosmicVideoPlayer';

export default CosmicVideoPlayer;
