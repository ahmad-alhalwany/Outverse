'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  enforceTrimLoop,
  trimmedAudioTime,
  type MusicTrim,
} from '@/lib/reelMusicTrim';
import {
  REEL_FILTER_META,
  musicTrackPlaybackUrl,
  type ReelFilter,
  type ReelMusicTrack,
} from '@/lib/reelTypes';

interface ReelCreatePreviewProps {
  previewUrl: string | null;
  filterStyle: ReelFilter;
  musicTrack: number | null;
  tracks: ReelMusicTrack[];
  customAudio: File | null;
  musicTrim: MusicTrim;
}

export default function ReelCreatePreview({
  previewUrl,
  filterStyle,
  musicTrack,
  tracks,
  customAudio,
  musicTrim,
}: ReelCreatePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);

  const filterMeta = REEL_FILTER_META[filterStyle];
  const selectedTrack = tracks.find((tr) => tr.id === musicTrack) ?? null;
  const overlayFromTrack = selectedTrack ? musicTrackPlaybackUrl(selectedTrack) : null;
  const overlayUrl = customAudioUrl || overlayFromTrack;
  const hasOverlay = !!overlayUrl;

  useEffect(() => {
    if (!customAudio) {
      setCustomAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(customAudio);
    setCustomAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [customAudio]);

  const syncPlay = useCallback(
    (play: boolean) => {
      const v = videoRef.current;
      const a = audioRef.current;
      if (v) {
        v.muted = hasOverlay;
        if (play) v.play().catch(() => {});
        else v.pause();
      }
      if (a && hasOverlay) {
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
        }
      }
    },
    [hasOverlay, musicTrim],
  );

  useEffect(() => {
    if (!previewUrl) return;
    const v = videoRef.current;
    if (!v) return;

    const alignAudio = () => {
      const a = audioRef.current;
      if (!a || !hasOverlay || !a.duration) return;
      enforceTrimLoop(a, musicTrim);
      const target = trimmedAudioTime(v.currentTime, musicTrim, a.duration);
      if (Math.abs(a.currentTime - target) > 0.35) a.currentTime = target;
    };

    const onPlay = () => syncPlay(true);
    const onPause = () => {
      const a = audioRef.current;
      if (a && hasOverlay) a.pause();
    };
    const onTime = () => alignAudio();

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('timeupdate', onTime);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('timeupdate', onTime);
    };
  }, [previewUrl, hasOverlay, syncPlay, musicTrim]);

  useEffect(() => {
    const a = audioRef.current;
    const v = videoRef.current;
    if (a && hasOverlay) {
      a.load();
      if (v && !v.paused) a.play().catch(() => {});
    }
  }, [overlayUrl, hasOverlay]);

  if (!previewUrl) return null;

  return (
    <div
      className={`reels-create__preview-stage reels-create__preview-stage--filter-${filterStyle}`}
    >
      <div className="reels-create__preview-frame">
        {filterStyle === 'glitch' && (
          <div className="reel-slide__glitch-layer" aria-hidden />
        )}
        <video
          ref={videoRef}
          src={previewUrl}
          className="reels-create__preview"
          style={{ filter: filterMeta.css || undefined }}
          loop
          playsInline
          muted={hasOverlay}
          autoPlay
          onClick={() => {
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) syncPlay(true);
            else syncPlay(false);
          }}
        />
        {overlayUrl && (
          <audio ref={audioRef} src={overlayUrl} loop playsInline />
        )}
        <span className="reels-create__preview-badge">
          {filterMeta.emoji} {filterMeta.label}
          {hasOverlay ? ' · 🎵' : ''}
        </span>
      </div>
    </div>
  );
}
