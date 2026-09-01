/** Cosonova story studio tokens — mobile mirror of web `lib/storyStudio`. */

export type StoryFilterKey =
  | 'none'
  | 'cosmic'
  | 'glitch'
  | 'vintage'
  | 'neon'
  | 'void'
  | 'dream'
  | 'pulse';

export const STORY_FILTERS: { key: StoryFilterKey; label: string; emoji: string; tint: string }[] = [
  { key: 'none', label: 'Raw', emoji: '◎', tint: 'transparent' },
  { key: 'cosmic', label: 'Cosmic', emoji: '🌌', tint: 'rgba(124,58,237,0.22)' },
  { key: 'glitch', label: 'Glitch', emoji: '⚡', tint: 'rgba(34,211,238,0.2)' },
  { key: 'vintage', label: 'Vintage', emoji: '📼', tint: 'rgba(180,120,40,0.28)' },
  { key: 'neon', label: 'Neon', emoji: '💜', tint: 'rgba(236,72,153,0.22)' },
  { key: 'void', label: 'Void', emoji: '🕳️', tint: 'rgba(0,0,0,0.38)' },
  { key: 'dream', label: 'Dream', emoji: '🫧', tint: 'rgba(56,189,248,0.2)' },
  { key: 'pulse', label: 'Pulse', emoji: '💫', tint: 'rgba(167,139,250,0.24)' },
];

export function filterTint(key?: string | null): string {
  return STORY_FILTERS.find((f) => f.key === key)?.tint || 'transparent';
}

export const STORY_BACKGROUNDS: { key: string; label: string; colors: [string, string, ...string[]] }[] = [
  { key: 'cosmic-violet', label: 'Cosmic', colors: ['#1a1a2e', '#2d1b4a', '#0f172a'] },
  { key: 'nebula', label: 'Nebula', colors: ['#7C3AED', '#C084FC', '#22D3EE'] },
  { key: 'ocean', label: 'Ocean', colors: ['#0f172a', '#164e63', '#0891b2'] },
  { key: 'sunset', label: 'Sunset', colors: ['#7c2d12', '#c2410c', '#f59e0b'] },
  { key: 'void', label: 'Void', colors: ['#0a0a14', '#0a0a14'] },
  { key: 'aurora', label: 'Aurora', colors: ['#065f46', '#22D3EE', '#7C3AED'] },
  { key: 'blush', label: 'Blush Dawn', colors: ['#4c1d95', '#db2777', '#f472b6'] },
  { key: 'midnight', label: 'Midnight', colors: ['#020617', '#1e1b4b', '#312e81'] },
];

export function backgroundColors(key?: string | null): [string, string, ...string[]] {
  const found = STORY_BACKGROUNDS.find((b) => b.key === key)?.colors || STORY_BACKGROUNDS[0].colors;
  return found as [string, string, ...string[]];
}

export const STORY_TEMPLATES: {
  key: string;
  label: string;
  background: string;
  textColor: string;
  fontWeight: number;
  fontSize: number;
}[] = [
  { key: 'bold', label: 'Bold', background: 'nebula', textColor: '#ffffff', fontWeight: 800, fontSize: 8 },
  { key: 'soft-dream', label: 'Soft Dream', background: 'blush', textColor: '#ffffff', fontWeight: 600, fontSize: 6.5 },
  { key: 'neon', label: 'Neon', background: 'ocean', textColor: '#67E8F9', fontWeight: 700, fontSize: 7 },
  { key: 'midnight-quote', label: 'Quote', background: 'midnight', textColor: '#C4B5FD', fontWeight: 500, fontSize: 5.5 },
  { key: 'sunset-shout', label: 'Sunset', background: 'sunset', textColor: '#fff7ed', fontWeight: 700, fontSize: 7 },
];

export const STORY_STICKERS = [
  '✨', '🌌', '💫', '🔥', '💜', '🌙', '⭐', '🚀',
  '🎉', '❤️', '😂', '😍', '👍', '🎨', '🌈', '☀️',
  '⚡', '🍀', '🎵', '💯',
];

export const STORY_TEXT_COLORS = [
  '#ffffff', '#0f172a', '#7C3AED', '#22D3EE', '#F472B6', '#FBBF24', '#4ADE80',
];

export const STORY_BRUSH_COLORS = [
  '#ffffff', '#7C3AED', '#22D3EE', '#F472B6', '#FBBF24', '#EF4444', '#4ADE80',
];

export type StoryTextOverlay = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: number;
  align?: 'left' | 'center' | 'right';
};

export type StoryStickerOverlay = {
  id: string;
  type: 'sticker';
  x: number;
  y: number;
  emoji: string;
  scale: number;
};

export type StoryPollOverlay = {
  id: string;
  type: 'poll';
  x: number;
  y: number;
  question: string;
  options: [string, string];
};

export type StoryQuestionOverlay = {
  id: string;
  type: 'question';
  x: number;
  y: number;
  prompt: string;
};

export type StoryLocationOverlay = {
  id: string;
  type: 'location';
  x: number;
  y: number;
  label: string;
  lat?: number | null;
  lng?: number | null;
};

export type StoryMentionOverlay = {
  id: string;
  type: 'mention';
  x: number;
  y: number;
  userId: number;
  username: string;
};

export type StoryCountdownOverlay = {
  id: string;
  type: 'countdown';
  x: number;
  y: number;
  label: string;
  targetAt: string;
};

export type StoryOverlay =
  | StoryTextOverlay
  | StoryStickerOverlay
  | StoryPollOverlay
  | StoryQuestionOverlay
  | StoryLocationOverlay
  | StoryMentionOverlay
  | StoryCountdownOverlay;

export type StoryStroke = {
  points: [number, number][];
  color: string;
  width: number;
};

export function uid(prefix = 'o') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newTextOverlay(text = 'Tap to edit'): StoryTextOverlay {
  return {
    id: uid('t'),
    type: 'text',
    x: 50,
    y: 50,
    text,
    color: '#ffffff',
    fontSize: 7,
    fontWeight: 700,
    align: 'center',
  };
}

export function newStickerOverlay(emoji: string): StoryStickerOverlay {
  return {
    id: uid('s'),
    type: 'sticker',
    x: 50,
    y: 50,
    emoji,
    scale: 1,
  };
}

export function newPollOverlay(): StoryPollOverlay {
  return {
    id: uid('p'),
    type: 'poll',
    x: 50,
    y: 50,
    question: 'Which one?',
    options: ['Option A', 'Option B'],
  };
}

export function newQuestionOverlay(): StoryQuestionOverlay {
  return {
    id: uid('q'),
    type: 'question',
    x: 50,
    y: 50,
    prompt: 'Ask me anything',
  };
}

export function newLocationOverlay(
  label = 'Somewhere magical',
  lat?: number | null,
  lng?: number | null,
): StoryLocationOverlay {
  return {
    id: uid('l'),
    type: 'location',
    x: 50,
    y: 50,
    label,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
  };
}

export const STORY_MAP_PRESETS: { label: string; lat: number; lng: number }[] = [
  { label: 'Damascus', lat: 33.5138, lng: 36.2765 },
  { label: 'Amman', lat: 31.9539, lng: 35.9106 },
  { label: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { label: 'Dubai', lat: 25.0805, lng: 55.1403 },
  { label: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { label: 'Tokyo', lat: 35.6595, lng: 139.7004 },
  { label: 'Berlin', lat: 52.52, lng: 13.405 },
  { label: 'San Francisco', lat: 37.8199, lng: -122.4784 },
];

export function newMentionOverlay(userId: number, username: string): StoryMentionOverlay {
  return {
    id: uid('m'),
    type: 'mention',
    x: 50,
    y: 50,
    userId,
    username,
  };
}

export const COUNTDOWN_DURATIONS: { label: string; hours: number }[] = [
  { label: '1h', hours: 1 },
  { label: '1d', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '1w', hours: 168 },
];

export function newCountdownOverlay(label = 'Coming soon'): StoryCountdownOverlay {
  return {
    id: uid('c'),
    type: 'countdown',
    x: 50,
    y: 50,
    label,
    targetAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  };
}

export function formatCountdownLong(seconds: number): string {
  if (seconds <= 0) return "Time's up!";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export const STORY_MOODS: { emoji: string; label: string; aura: string; ring: string }[] = [
  { emoji: '😊', label: 'Happy', aura: 'rgba(251,191,36,0.38)', ring: '#F59E0B' },
  { emoji: '🎨', label: 'Artistic', aura: 'rgba(236,72,153,0.38)', ring: '#EC4899' },
  { emoji: '💡', label: 'Inspired', aura: 'rgba(34,211,238,0.38)', ring: '#22D3EE' },
  { emoji: '🎉', label: 'Energetic', aura: 'rgba(249,115,22,0.38)', ring: '#F97316' },
  { emoji: '✨', label: 'Spark', aura: 'rgba(167,139,250,0.38)', ring: '#7C3AED' },
];

export function moodAuraColor(emoji?: string | null): string {
  return STORY_MOODS.find((m) => m.emoji === emoji)?.aura || 'transparent';
}

export const CAPSULE_DURATIONS: { label: string; hours: number }[] = [
  { label: '1h', hours: 1 },
  { label: '3h', hours: 3 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
];

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'unlocking…';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function normalizeStrokes(raw: unknown): StoryStroke[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const s = item as { points?: unknown; color?: string; width?: number };
      const points = Array.isArray(s.points)
        ? s.points
            .map((p): [number, number] | null => {
              if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
              if (p && typeof p === 'object' && 'x' in p && 'y' in p) {
                const pt = p as { x: number; y: number };
                return [Number(pt.x), Number(pt.y)];
              }
              return null;
            })
            .filter((p): p is [number, number] => !!p)
        : [];
      return { points, color: s.color || '#ffffff', width: typeof s.width === 'number' ? s.width : 3 };
    })
    .filter((s) => s.points.length > 0);
}

export function overlayFontSize(size: number) {
  // Website overlays use ~5–8; older mobile shares used ~28.
  if (size > 14) return Math.max(16, size * 0.55);
  return Math.max(16, size * 3.6);
}
