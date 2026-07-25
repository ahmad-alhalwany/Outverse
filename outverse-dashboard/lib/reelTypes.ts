import type { ReactionType } from './reactions';

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
  shares_count: number;
  is_liked: boolean;
  is_saved?: boolean;
  reaction_counts?: Record<string, number>;
  my_reaction?: ReactionType | null;
  is_featured?: boolean;
  is_active?: boolean;
  created_at: string;
  remix_of?: number | null;
  stitch_of?: number | null;
  allow_remix?: boolean;
  allow_weave?: boolean;
  allow_download?: boolean;
  is_dimmed?: boolean;
  template?: number | null;
  template_detail?: {
    id: number;
    slug: string;
    title: string;
    overlay_stickers?: Array<{ id?: string; emoji: string; x: number; y: number; scale?: number }>;
    overlay_text?: string;
    backdrop_preset?: string;
  } | null;
  captions?: Array<{ start: number; end: number; text: string }>;
  captions_status?: 'none' | 'pending' | 'ready' | 'failed';
  captions_language?: string;
  effect_meta?: {
    backdrop?: string;
    chroma_key?: boolean;
    overlays?: Array<{ id?: string; emoji: string; x: number; y: number; scale?: number }>;
    overlay_text?: string;
  };
  inspiration_question?: number | null;
  source_idea?: number | null;
  inspiration_attribution?: { type: 'question' | 'idea'; id: number; label: string } | null;
}

export interface ReelTemplate {
  id: number;
  slug: string;
  title: string;
  description: string;
  mood: ReelMood;
  filter_style: ReelFilter;
  overlay_stickers: Array<{ id?: string; emoji: string; x: number; y: number; scale?: number }>;
  overlay_text: string;
  default_sound_label: string;
  music_track: number | null;
  backdrop_preset: string;
  order: number;
}

export const REEL_BACKDROPS: Record<string, { label: string; css: string }> = {
  nebula: {
    label: 'Nebula',
    css: 'radial-gradient(circle at 30% 20%, #a78bfa 0%, #4c1d95 45%, #0f172a 100%)',
  },
  orbit: {
    label: 'Orbit',
    css: 'linear-gradient(160deg, #22d3ee 0%, #7c3aed 50%, #1e1b4b 100%)',
  },
  void: {
    label: 'Void',
    css: 'radial-gradient(circle at 50% 80%, #312e81 0%, #020617 70%)',
  },
  aurora: {
    label: 'Aurora',
    css: 'linear-gradient(120deg, #34d399 0%, #818cf8 40%, #f472b6 100%)',
  },
};

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
  edited_at?: string;
  is_pinned?: boolean;
  pin_order?: number | null;
  sparked_by_author?: boolean;
  is_post_author?: boolean;
  vote_score?: number;
  my_vote?: 'boost' | 'dim' | null;
  quoted_comment?: { id: number; text: string; user: ReelUser } | null;
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
