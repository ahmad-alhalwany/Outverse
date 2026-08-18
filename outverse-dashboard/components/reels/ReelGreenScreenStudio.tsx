'use client';

import { useEffect, useRef, useState } from 'react';
import { REEL_BACKDROPS } from '@/lib/reelTypes';
import { useLocale } from '../LocaleProvider';

/** Client-side green-screen / backdrop picker for create (chroma key live preview). */
export default function ReelGreenScreenStudio({
  videoUrl,
  backdrop,
  onBackdropChange,
  chromaEnabled,
  onChromaChange,
}: {
  videoUrl: string | null;
  backdrop: string;
  onBackdropChange: (key: string) => void;
  chromaEnabled: boolean;
  onChromaChange: (on: boolean) => void;
}) {
  const { t } = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!videoUrl || !chromaEnabled) {
      setRunning(false);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    let raf = 0;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      if (video.readyState >= 2) {
        canvas.width = video.videoWidth || 360;
        canvas.height = video.videoHeight || 640;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = frame.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Chroma key: strong green dominance
            if (g > 90 && g > r * 1.35 && g > b * 1.35) {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(frame, 0, 0);
        } catch {
          /* tainted canvas ignore */
        }
      }
      raf = requestAnimationFrame(draw);
    };

    const onPlay = () => {
      setRunning(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    video.addEventListener('play', onPlay);
    video.play().catch(() => {});
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      video.removeEventListener('play', onPlay);
    };
  }, [videoUrl, chromaEnabled, backdrop]);

  const bg = backdrop && REEL_BACKDROPS[backdrop] ? REEL_BACKDROPS[backdrop].css : '#0f172a';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-white/90">
          <input
            type="checkbox"
            checked={chromaEnabled}
            onChange={(e) => onChromaChange(e.target.checked)}
          />
          {t('reels.greenScreenToggle')}
        </label>
      </div>
      {chromaEnabled ? (
        <>
          <div className="flex flex-wrap gap-2">
            {Object.entries(REEL_BACKDROPS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => onBackdropChange(key)}
                className="rounded-full px-3 py-1.5 text-xs font-bold"
                style={{
                  border: backdrop === key ? '2px solid #A78BFA' : '1px solid rgba(255,255,255,0.2)',
                  background: meta.css,
                  color: '#fff',
                }}
              >
                {meta.label}
              </button>
            ))}
          </div>
          {videoUrl ? (
            <div
              className="relative overflow-hidden rounded-2xl"
              style={{ background: bg, aspectRatio: '9/16', maxHeight: 360 }}
            >
              <video
                ref={videoRef}
                src={videoUrl}
                className="absolute inset-0 h-full w-full object-cover opacity-0"
                muted
                loop
                playsInline
              />
              <canvas
                ref={canvasRef}
                className="relative z-[1] h-full w-full object-contain"
                style={{ mixBlendMode: running ? 'normal' : undefined }}
              />
              <p className="absolute bottom-2 left-2 z-[2] rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80">
                {t('reels.liveChromaPreview')}
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/60">{t('reels.greenScreenHint')}</p>
          )}
        </>
      ) : null}
    </div>
  );
}
