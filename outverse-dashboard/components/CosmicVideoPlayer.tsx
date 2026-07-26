'use client';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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

function CosmicParticles({ active }: { active: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const seed = (i + 1) * 9973;
        const rand = (n: number) => ((seed * (n + 3)) % 1000) / 1000;
        return {
          w: 1.5 + rand(1) * 2.5,
          left: rand(2) * 98,
          top: rand(3) * 98,
          opacity: 0.2 + rand(4) * 0.45,
          duration: 2.4 + rand(5) * 2.6,
          delay: rand(6) * 2,
        };
      }),
    [],
  );

  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-violet-200/80 shadow-[0_0_8px_rgba(196,181,253,0.65)] animate-cosmic-particle"
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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(initialMuted);
  const [volume, setVolume] = useState(initialMuted ? 0 : 0.85);
  const [seeking, setSeeking] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [ready, setReady] = useState(false);
  const [scrubHover, setScrubHover] = useState(false);
  const [pulse, setPulse] = useState<'play' | 'pause' | null>(null);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 2400);
    }
  }, [playing]);

  useEffect(() => {
    if (!autoPlay || !videoRef.current) return;
    void videoRef.current.play().catch(() => setPlaying(false));
  }, [autoPlay, src]);

  useEffect(() => {
    setReady(false);
    setCurrent(0);
    setDuration(0);
    setBuffered(0);
    setPlaying(false);
  }, [src]);

  useEffect(() => {
    if (!playing) {
      setControlsVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      return;
    }
    if (!hovering && !seeking) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 2400);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing, hovering, seeking]);

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

  const flashPulse = (kind: 'play' | 'pause') => {
    setPulse(kind);
    window.setTimeout(() => setPulse(null), 420);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().then(() => {
        setPlaying(true);
        flashPulse('play');
      }).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
      flashPulse('pause');
    }
    revealControls();
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

  const handleLoaded = () => {
    const v = videoRef.current;
    setDuration(v?.duration || 0);
    setReady(true);
    if (v) {
      v.volume = muted ? 0 : volume;
      v.muted = muted;
    }
  };

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
    revealControls();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
    if (!next && volume === 0) {
      setVolume(0.7);
      v.volume = 0.7;
    }
    revealControls();
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    const next = Math.max(0, Math.min(1, val));
    setVolume(next);
    if (v) v.volume = next;
    if (next === 0) {
      setMuted(true);
      if (v) v.muted = true;
    } else if (muted) {
      setMuted(false);
      if (v) v.muted = false;
    }
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
    revealControls();
  };

  useEffect(() => {
    const el = shellRef.current;
    if (!el || isStory) return;
    const onKey = (e: KeyboardEvent) => {
      if (!el.contains(document.activeElement) && document.activeElement !== el) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skip(5);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skip(-5);
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'f') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStory, muted, duration, playing]);

  const progress = duration ? (current / duration) * 100 : 0;
  const bufferPct = duration ? Math.min(100, (buffered / duration) * 100) : 0;
  const showControls = !isStory && (controlsVisible || hovering || !playing || seeking);

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      role="region"
      aria-label="Video player"
      className={`cosmic-vplayer group relative isolate overflow-hidden rounded-[1.15rem] outline-none ${className}`}
      style={{
        aspectRatio: '16 / 9',
        boxShadow:
          '0 0 0 1px rgba(167,139,250,0.18), 0 20px 50px rgba(8,6,24,0.4), 0 0 48px rgba(106,0,255,0.12)',
        ...style,
      }}
      onMouseEnter={() => {
        setHovering(true);
        revealControls();
      }}
      onMouseLeave={() => setHovering(false)}
      onMouseMove={revealControls}
      onFocus={revealControls}
    >
      {/* Atmosphere */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[#070512]" />
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse at 18% 0%, rgba(124,58,237,0.38), transparent 52%), radial-gradient(ellipse at 88% 100%, rgba(34,211,238,0.16), transparent 48%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent 40%)',
        }}
      />
      <CosmicParticles active={!playing && !ready} />

      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={`relative z-10 block h-full w-full object-contain transition-opacity duration-300 ${ready || poster ? 'opacity-100' : 'opacity-0'}`}
        controls={false}
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        muted={muted}
        loop={loop && !isStory}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onCanPlay={() => setReady(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
      />

      {/* Idle vignette */}
      {!playing && (
        <div className="pointer-events-none absolute inset-0 z-[15] bg-gradient-to-t from-[#070512]/75 via-transparent to-[#070512]/25" />
      )}

      {/* Pulse feedback */}
      {pulse && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <span className="cosmic-vplayer__pulse flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md shadow-[0_0_40px_rgba(124,58,237,0.55)]">
            {pulse === 'play' ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7L8 5z" /></svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width={4} height={14} rx={1} /><rect x="14" y="5" width={4} height={14} rx={1} /></svg>
            )}
          </span>
        </div>
      )}

      {/* Center play */}
      {!playing && !isStory ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex items-center justify-center"
          aria-label="Play"
        >
          <span className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-400/25" style={{ animationDuration: '2.4s' }} />
            <span
              className="relative flex h-full w-full items-center justify-center rounded-full text-white transition hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(145deg, rgba(124,58,237,0.92), rgba(14,165,233,0.75))',
                boxShadow: '0 0 0 1px rgba(255,255,255,0.18), 0 12px 40px rgba(76,29,149,0.55), 0 0 48px rgba(34,211,238,0.25)',
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="ml-0.5">
                <path d="M8 5v14l11-7L8 5z" />
              </svg>
            </span>
          </span>
        </button>
      ) : null}

      {!ready && !poster && !isStory && (
        <div className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-300/25 border-t-violet-300" />
        </div>
      )}

      {!isStory && (
        <div
          className={`absolute inset-x-0 bottom-0 z-30 transition-all duration-300 ${
            showControls ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none'
          }`}
        >
          <div className="bg-gradient-to-t from-[#070512] via-[#070512]/80 to-transparent px-3 pb-3 pt-14">
            {/* Scrubber */}
            <div
              className="relative mb-3 h-5 w-full"
              onMouseEnter={() => setScrubHover(true)}
              onMouseLeave={() => setScrubHover(false)}
            >
              <div
                className={`absolute left-0 top-1/2 w-full -translate-y-1/2 rounded-full bg-white/12 transition-all ${
                  scrubHover || seeking ? 'h-2' : 'h-1.5'
                }`}
              />
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-white/22 transition-all ${
                  scrubHover || seeking ? 'h-2' : 'h-1.5'
                }`}
                style={{ width: `${bufferPct}%` }}
              />
              <div
                className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-full transition-all ${
                  scrubHover || seeking ? 'h-2' : 'h-1.5'
                }`}
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #7C3AED 0%, #A78BFA 50%, #22D3EE 100%)',
                  boxShadow: '0 0 16px rgba(167,139,250,0.55)',
                }}
              />
              {duration > 0 && (
                <div
                  className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 transition-transform ${
                    scrubHover || seeking ? 'h-4 w-4 scale-110' : 'h-3 w-3'
                  }`}
                  style={{
                    left: `${progress}%`,
                    background: 'linear-gradient(135deg, #C4B5FD, #22D3EE)',
                    boxShadow: '0 0 14px rgba(167,139,250,0.95)',
                  }}
                />
              )}
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

            {/* Controls dock */}
            <div
              className="flex items-center gap-1 rounded-2xl px-1.5 py-1 text-white sm:gap-1.5 sm:px-2"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 28px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-[0_6px_18px_rgba(124,58,237,0.45)] transition hover:brightness-110 active:scale-95"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><path d="M8 5v14l11-7L8 5z" /></svg>
                )}
              </button>

              <button
                type="button"
                onClick={() => skip(-10)}
                className="hidden h-8 items-center gap-0.5 rounded-lg px-2 text-[11px] font-semibold text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex"
                aria-label="Back 10 seconds"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M3.5 15a9 9 0 1 0 .8-8.2L1 10" /></svg>
                10
              </button>
              <button
                type="button"
                onClick={() => skip(10)}
                className="hidden h-8 items-center gap-0.5 rounded-lg px-2 text-[11px] font-semibold text-white/80 transition hover:bg-white/10 hover:text-white sm:inline-flex"
                aria-label="Forward 10 seconds"
              >
                10
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6" /><path d="M20.5 15a9 9 0 1 1-.8-8.2L23 10" /></svg>
              </button>

              <span className="min-w-[4.5rem] px-1 text-center text-[11px] font-medium tabular-nums tracking-wide text-white/70">
                {formatTime(current)}
                <span className="text-white/35"> / </span>
                {formatTime(duration)}
              </span>

              <div className="flex-1" />

              <div className="group/vol flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 hover:text-white"
                  aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {muted || volume === 0 ? <SpeakerXMarkIcon className="h-4 w-4" /> : <SpeakerWaveIcon className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  className="cosmic-vplayer__vol hidden w-16 cursor-pointer sm:block"
                  aria-label="Volume"
                />
              </div>

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 hover:text-white"
                aria-label="Fullscreen"
              >
                <ArrowsPointingOutIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

CosmicVideoPlayer.displayName = 'CosmicVideoPlayer';

export default CosmicVideoPlayer;
