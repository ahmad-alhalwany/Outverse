'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReelItem } from '@/lib/reelTypes';
import { REEL_BACKDROPS } from '@/lib/reelTypes';

/** Synced on-video captions + AR-lite sticker/text overlays from effect_meta/template. */
export default function ReelOverlays({
  reel,
  currentTime,
  showCaptions = true,
}: {
  reel: ReelItem;
  currentTime: number;
  showCaptions?: boolean;
}) {
  const cues = reel.captions_status === 'ready' ? reel.captions || [] : [];
  const activeCue = useMemo(
    () => cues.find((c) => currentTime >= c.start && currentTime < c.end),
    [cues, currentTime],
  );

  const meta = reel.effect_meta || {};
  const stickers = meta.overlays?.length
    ? meta.overlays
    : reel.template_detail?.overlay_stickers || [];
  const overlayText = meta.overlay_text || reel.template_detail?.overlay_text || '';
  const backdropKey = meta.backdrop || reel.template_detail?.backdrop_preset || '';
  const backdrop = backdropKey ? REEL_BACKDROPS[backdropKey] : null;

  return (
    <>
      {backdrop && meta.chroma_key ? (
        <div
          className="pointer-events-none absolute inset-0 z-[1] opacity-40 mix-blend-screen"
          style={{ background: backdrop.css }}
          aria-hidden
        />
      ) : null}

      {stickers.map((s, i) => (
        <span
          key={s.id || `${s.emoji}-${i}`}
          className="pointer-events-none absolute z-[5] select-none"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            transform: `translate(-50%, -50%) scale(${s.scale || 1})`,
            fontSize: '1.75rem',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
          }}
          aria-hidden
        >
          {s.emoji}
        </span>
      ))}

      {overlayText ? (
        <div className="pointer-events-none absolute left-4 right-20 top-[18%] z-[6]">
          <p
            className="inline-block rounded-xl px-3 py-1.5 text-sm font-bold text-white"
            style={{
              background: 'rgba(124,58,237,0.45)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            }}
          >
            {overlayText}
          </p>
        </div>
      ) : null}

      {showCaptions && activeCue ? (
        <div className="pointer-events-none absolute bottom-28 left-4 right-20 z-[8] flex justify-center">
          <p
            className="max-w-full rounded-2xl px-3 py-2 text-center text-[0.95rem] font-semibold leading-snug text-white"
            style={{
              background: 'rgba(15, 10, 40, 0.72)',
              border: '1px solid rgba(167,139,250,0.35)',
              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
            }}
          >
            {activeCue.text}
          </p>
        </div>
      ) : null}
    </>
  );
}

export function useReelClock(active: boolean, videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [currentTime, setCurrentTime] = useState(0);
  useEffect(() => {
    if (!active) {
      setCurrentTime(0);
      return;
    }
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) setCurrentTime(v.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, videoRef]);
  return currentTime;
}
