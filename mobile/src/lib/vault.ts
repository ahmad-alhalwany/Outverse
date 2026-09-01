import { emotionMeta } from '@/lib/profileEmotions';

export type VaultPalette = {
  cream: string;
  ink: string;
  muted: string;
  line: string;
  card: string;
  glow: string;
  accent: string;
  accentDk: string;
};

export type VaultMoodRow = {
  emotion: string;
  count: number;
  asPercent?: boolean;
};

export type CapsuleStats = {
  sealed: number;
  ready: number;
  opened: number;
};

export function useVaultPalette(isDark: boolean): VaultPalette {
  if (isDark) {
    return {
      cream: '#120E24',
      ink: '#F5F3FF',
      muted: '#B0A6D9',
      line: 'rgba(167,139,250,0.22)',
      card: 'rgba(30,23,64,0.88)',
      glow: 'rgba(167,139,250,0.22)',
      accent: '#C4B5FD',
      accentDk: '#A78BFA',
    };
  }
  return {
    cream: '#F3F0FC',
    ink: '#211B3D',
    muted: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    card: 'rgba(255,255,255,0.92)',
    glow: 'rgba(124,58,237,0.18)',
    accent: '#7C3AED',
    accentDk: '#5B21B6',
  };
}

function asCount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function asCapsuleStats(data: unknown): CapsuleStats | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  return {
    sealed: asCount(obj.sealed),
    ready: asCount(obj.ready),
    opened: asCount(obj.opened),
  };
}

export function asVaultMoods(data: unknown): VaultMoodRow[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;

  const fromNamed = (rows: unknown, asPercent = false): VaultMoodRow[] => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        const r = (row || {}) as { emotion?: string; count?: number; pct?: number };
        const emotion = String(r.emotion || '').trim();
        if (!emotion) return null;
        const count = asPercent ? asCount(r.pct ?? r.count) : asCount(r.count ?? r.pct);
        return { emotion, count, asPercent };
      })
      .filter(Boolean)
      .slice(0, 6) as VaultMoodRow[];
  };

  const summary = fromNamed(obj.mood_summary);
  if (summary.length) return summary;
  const emotions = fromNamed(obj.emotions);
  if (emotions.length) return emotions;
  return fromNamed(obj.insights, true);
}

export function ritualStreak(data: unknown): number {
  if (!data || typeof data !== 'object') return 0;
  return asCount((data as { streak?: number }).streak);
}

export function moodLabel(
  emotion: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const meta = emotionMeta(emotion);
  const translated = t(meta.labelKey);
  if (translated && translated !== meta.labelKey) {
    return `${meta.emoji} ${translated}`;
  }
  const pretty = emotion.replace(/_/g, ' ');
  return `${meta.emoji} ${pretty.charAt(0).toUpperCase()}${pretty.slice(1)}`;
}
