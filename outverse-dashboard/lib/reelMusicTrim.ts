export interface MusicTrim {
  start: number;
  end: number | null;
}

export function musicTrimFromReel(reel: {
  music_start_seconds?: number;
  music_end_seconds?: number | null;
}): MusicTrim {
  return {
    start: Math.max(0, reel.music_start_seconds ?? 0),
    end:
      reel.music_end_seconds != null && reel.music_end_seconds > 0
        ? reel.music_end_seconds
        : null,
  };
}

export function segmentLength(trim: MusicTrim, duration: number): number {
  const start = Math.max(0, trim.start);
  const end =
    trim.end != null && trim.end > start
      ? Math.min(trim.end, duration)
      : duration;
  return Math.max(0.05, end - start);
}

/** Map video timeline position into a trimmed audio segment (loops). */
export function trimmedAudioTime(
  videoTime: number,
  trim: MusicTrim,
  duration: number,
): number {
  const start = Math.max(0, trim.start);
  const len = segmentLength(trim, duration);
  return start + (videoTime % len);
}

/** Keep audio within [start, end); loop back to start when past end. */
export function enforceTrimLoop(
  audio: HTMLAudioElement,
  trim: MusicTrim,
): void {
  if (!audio.duration || !Number.isFinite(audio.duration)) return;
  const start = Math.max(0, trim.start);
  const end =
    trim.end != null && trim.end > start
      ? Math.min(trim.end, audio.duration)
      : audio.duration;
  if (audio.currentTime < start || audio.currentTime >= end) {
    audio.currentTime = start;
  }
}

export function formatTrimTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
