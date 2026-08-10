export type StoryFilterKey =
  | 'none'
  | 'cosmic'
  | 'glitch'
  | 'vintage'
  | 'neon'
  | 'void'
  | 'dream'
  | 'pulse';

export const STORY_FILTERS: { key: StoryFilterKey; label: string; emoji: string; css: string }[] = [
  { key: 'none', label: 'Raw', emoji: '◎', css: '' },
  { key: 'cosmic', label: 'Cosmic', emoji: '🌌', css: 'saturate(1.35) contrast(1.1) hue-rotate(18deg) brightness(1.05)' },
  { key: 'glitch', label: 'Glitch', emoji: '⚡', css: 'contrast(1.4) saturate(1.8) hue-rotate(90deg) brightness(0.95)' },
  { key: 'vintage', label: 'Vintage', emoji: '📼', css: 'sepia(0.45) contrast(1.15) brightness(0.9)' },
  { key: 'neon', label: 'Neon', emoji: '💜', css: 'saturate(2.2) contrast(1.25) brightness(1.15) hue-rotate(-20deg)' },
  { key: 'void', label: 'Void', emoji: '🕳️', css: 'brightness(0.75) contrast(1.3) saturate(0.6)' },
  { key: 'dream', label: 'Dream', emoji: '🫧', css: 'blur(0.3px) saturate(1.2) brightness(1.1) hue-rotate(200deg)' },
  { key: 'pulse', label: 'Pulse', emoji: '💫', css: 'saturate(1.6) contrast(1.2) hue-rotate(-35deg)' },
];

export function filterCss(key?: string | null): string {
  return STORY_FILTERS.find((f) => f.key === key)?.css || '';
}

export const STORY_BACKGROUNDS: { key: string; label: string; css: string }[] = [
  { key: 'cosmic-violet', label: 'Cosmic', css: 'linear-gradient(160deg, #1a1a2e 0%, #2d1b4a 50%, #0f172a 100%)' },
  { key: 'nebula', label: 'Nebula', css: 'linear-gradient(135deg, #7C3AED 0%, #C084FC 50%, #22D3EE 100%)' },
  { key: 'ocean', label: 'Ocean', css: 'linear-gradient(160deg, #0f172a 0%, #164e63 60%, #0891b2 100%)' },
  { key: 'sunset', label: 'Sunset', css: 'linear-gradient(160deg, #7c2d12 0%, #c2410c 55%, #f59e0b 100%)' },
  { key: 'void', label: 'Void', css: '#0a0a14' },
  { key: 'aurora', label: 'Aurora', css: 'linear-gradient(135deg, #065f46 0%, #22D3EE 55%, #7C3AED 100%)' },
  { key: 'blush', label: 'Blush Dawn', css: 'linear-gradient(160deg, #4c1d95 0%, #db2777 60%, #f472b6 100%)' },
  { key: 'midnight', label: 'Midnight', css: 'linear-gradient(160deg, #020617 0%, #1e1b4b 60%, #312e81 100%)' },
];

export function backgroundCss(key?: string | null): string {
  return STORY_BACKGROUNDS.find((b) => b.key === key)?.css || STORY_BACKGROUNDS[0].css;
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

export function newTextOverlay(text = 'Tap to edit'): StoryTextOverlay {
  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'sticker',
    x: 50,
    y: 50,
    emoji,
    scale: 1,
  };
}

export function newPollOverlay(): StoryPollOverlay {
  return {
    id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'poll',
    x: 50,
    y: 50,
    question: 'Which one?',
    options: ['Option A', 'Option B'],
  };
}

export function newQuestionOverlay(): StoryQuestionOverlay {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'location',
    x: 50,
    y: 50,
    label,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
  };
}

/** Quick picks so Story Map gets real pins without GPS. */
export const STORY_MAP_PRESETS: { label: string; lat: number; lng: number }[] = [
  { label: 'Damascus', lat: 33.5138, lng: 36.2765 },
  { label: 'Amman', lat: 31.9539, lng: 35.9106 },
  { label: 'Cairo', lat: 30.0444, lng: 31.2357 },
  { label: 'Dubai', lat: 25.0805, lng: 55.1403 },
  { label: 'Istanbul', lat: 41.0082, lng: 28.9784 },
  { label: 'Tokyo', lat: 35.6595, lng: 139.7004 },
  { label: 'Berlin', lat: 52.52, lng: 13.405 },
  { label: 'San Francisco', lat: 37.8199, lng: -122.4783 },
];

export function newMentionOverlay(userId: number, username: string): StoryMentionOverlay {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

// --- Mood Aura: same emoji taxonomy as the post composer, so a story's mood
// carries the same meaning site-wide. Each mood tints the ring + a soft glow
// behind the viewer — a differentiator no mainstream story feature has.
export const STORY_MOODS: { emoji: string; label: string; aura: string; ring: string }[] = [
  { emoji: '😊', label: 'Happy', aura: 'radial-gradient(circle at 50% 15%, rgba(251,191,36,0.4), transparent 60%)', ring: 'linear-gradient(135deg, #FBBF24, #F59E0B)' },
  { emoji: '🎨', label: 'Artistic', aura: 'radial-gradient(circle at 50% 15%, rgba(236,72,153,0.4), transparent 60%)', ring: 'linear-gradient(135deg, #EC4899, #7C3AED)' },
  { emoji: '💡', label: 'Inspired', aura: 'radial-gradient(circle at 50% 15%, rgba(34,211,238,0.4), transparent 60%)', ring: 'linear-gradient(135deg, #22D3EE, #0891B2)' },
  { emoji: '🎉', label: 'Energetic', aura: 'radial-gradient(circle at 50% 15%, rgba(249,115,22,0.4), transparent 60%)', ring: 'linear-gradient(135deg, #F97316, #EF4444)' },
  { emoji: '✨', label: 'Spark', aura: 'radial-gradient(circle at 50% 15%, rgba(167,139,250,0.4), transparent 60%)', ring: 'linear-gradient(135deg, #A78BFA, #7C3AED)' },
];

export function moodAuraCss(emoji?: string | null): string {
  return STORY_MOODS.find((m) => m.emoji === emoji)?.aura || '';
}

export function moodRingCss(emoji?: string | null): string | null {
  return STORY_MOODS.find((m) => m.emoji === emoji)?.ring || null;
}

// --- Time Capsule: seal a story so it (and its content) stays hidden from
// everyone, including its own author, until the chosen moment.
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
