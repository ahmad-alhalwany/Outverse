'use client';

import { useEffect, useState } from 'react';
import { formatTrimTime, type MusicTrim } from '@/lib/reelMusicTrim';
import { useLocale } from '../LocaleProvider';

interface ReelMusicTrimProps {
  audioUrl: string | null;
  trim: MusicTrim;
  onChange: (trim: MusicTrim) => void;
}

export default function ReelMusicTrim({
  audioUrl,
  trim,
  onChange,
}: ReelMusicTrimProps) {
  const { t } = useLocale();
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!audioUrl) {
      setDuration(0);
      return;
    }
    const audio = new Audio(audioUrl);
    const onMeta = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
        const end = trim.end ?? audio.duration;
        if (end > audio.duration || trim.start >= audio.duration) {
          onChange({ start: 0, end: audio.duration });
        }
      }
    };
    audio.addEventListener('loadedmetadata', onMeta);
    audio.load();
    return () => {
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.src = '';
    };
  }, [audioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!audioUrl || duration <= 0) return null;

  const end = trim.end ?? duration;
  const startPct = (trim.start / duration) * 100;
  const endPct = (end / duration) * 100;

  const setStart = (value: number) => {
    const next = Math.min(Math.max(0, value), end - 0.5);
    onChange({ start: next, end: trim.end });
  };

  const setEnd = (value: number) => {
    const next = Math.max(Math.min(duration, value), trim.start + 0.5);
    onChange({ start: trim.start, end: next });
  };

  return (
    <div className="reels-create__trim">
      <div className="reels-create__trim-head">
        <span className="reels-create__label !mb-0">{t('reels.musicTrim')}</span>
        <span className="reels-create__trim-times">
          {formatTrimTime(trim.start)} – {formatTrimTime(end)}
          <span className="opacity-60"> / {formatTrimTime(duration)}</span>
        </span>
      </div>
      <div className="reels-create__trim-track" aria-hidden>
        <div
          className="reels-create__trim-fill"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
      </div>
      <div className="reels-create__trim-sliders">
        <label className="reels-create__trim-slider">
          <span>{t('reels.trimStart')}</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={trim.start}
            onChange={(e) => setStart(parseFloat(e.target.value))}
          />
        </label>
        <label className="reels-create__trim-slider">
          <span>{t('reels.trimEnd')}</span>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={end}
            onChange={(e) => setEnd(parseFloat(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
