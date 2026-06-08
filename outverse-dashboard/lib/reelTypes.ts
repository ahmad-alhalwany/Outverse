export type ReelMood = 'cosmic' | 'pulse' | 'void' | 'spark' | 'dream';

export type ReelFilter =
  | 'none'
  | 'cosmic'
  | 'glitch'
  | 'vintage'
  | 'neon'
  | 'void'
  | 'dream'
  | 'pulse';

export interface ReelUser {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
}

export interface ReelMusicTrack {
  id: number;
  slug: string;
  title: string;
  artist_label: string;
  mood: string;
  audio_url: string;
  order: number;
}

export interface ReelItem {
  id: number;
  user: ReelUser;
  video: string;
  caption: string;
  mood: ReelMood;
  filter_style: ReelFilter;
  tags: string[];
  sound_label: string;
  music_track: number | null;
  music_track_detail: ReelMusicTrack | null;
  custom_audio_url: string;
  music_start_seconds?: number;
  music_end_seconds?: number | null;
  duration_seconds: number;
  views: number;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_featured?: boolean;
  created_at: string;
}

export interface ReelDiscoverPayload {
  trending: ReelItem[];
  featured: ReelItem[];
  fresh: ReelItem[];
  by_mood: Record<string, ReelItem[]>;
  top_tags: string[];
  by_tag: Record<string, ReelItem[]>;
}

export interface ReelCommentItem {
  id: number;
  reel: number;
  parent?: number;
  user: ReelUser;
  text: string;
  gif_url?: string;
  sticker_url?: string;
  created_at: string;
  replies?: ReelCommentItem[];
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
}

export function reelAuthorName(u: ReelUser): string {
  const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  return full || u.username || 'Traveler';
}

export const REEL_MOOD_META: Record<
  ReelMood,
  { label: string; emoji: string; hue: string }
> = {
  cosmic: { label: 'Cosmic', emoji: '🌌', hue: '#6a00ff' },
  pulse: { label: 'Pulse', emoji: '💫', hue: '#00ccff' },
  void: { label: 'Void', emoji: '🕳️', hue: '#1e1b4b' },
  spark: { label: 'Spark', emoji: '✨', hue: '#fde047' },
  dream: { label: 'Dream', emoji: '🫧', hue: '#a78bfa' },
};

export const REEL_FILTER_META: Record<
  ReelFilter,
  { label: string; emoji: string; css: string }
> = {
  none: { label: 'Raw', emoji: '◎', css: '' },
  cosmic: {
    label: 'Cosmic',
    emoji: '🌌',
    css: 'saturate(1.35) contrast(1.1) hue-rotate(18deg) brightness(1.05)',
  },
  glitch: {
    label: 'Glitch',
    emoji: '⚡',
    css: 'contrast(1.4) saturate(1.8) hue-rotate(90deg) brightness(0.95)',
  },
  vintage: {
    label: 'Vintage',
    emoji: '📼',
    css: 'sepia(0.45) contrast(1.15) brightness(0.9)',
  },
  neon: {
    label: 'Neon',
    emoji: '💜',
    css: 'saturate(2.2) contrast(1.25) brightness(1.15) hue-rotate(-20deg)',
  },
  void: {
    label: 'Void',
    emoji: '🕳️',
    css: 'brightness(0.75) contrast(1.3) saturate(0.6)',
  },
  dream: {
    label: 'Dream',
    emoji: '🫧',
    css: 'blur(0.3px) saturate(1.2) brightness(1.1) hue-rotate(200deg)',
  },
  pulse: {
    label: 'Pulse',
    emoji: '💫',
    css: 'saturate(1.6) contrast(1.2) hue-rotate(-35deg)',
  },
};

export function musicTrackPlaybackUrl(track: ReelMusicTrack): string {
  const u = track.audio_url;
  if (u.startsWith('http')) return u;
  if (typeof window !== 'undefined') return `${window.location.origin}${u}`;
  return u;
}

export function reelMusicPlaybackUrl(reel: ReelItem): string | null {
  if (reel.custom_audio_url) return reel.custom_audio_url;
  if (reel.music_track_detail?.audio_url) {
    const u = reel.music_track_detail.audio_url;
    if (u.startsWith('http')) return u;
    if (typeof window !== 'undefined') return `${window.location.origin}${u}`;
    return u;
  }
  return null;
}
