import type { Story } from '@/types';
import { mediaUrl } from '@/api/config';

export const STORY_MAP_C = {
  bg: '#0c0a1a',
  surface: '#17132e',
  raised: '#221c42',
  raised2: '#2c2554',
  border: 'rgba(196, 181, 253, 0.35)',
  borderSoft: 'rgba(196, 181, 253, 0.18)',
  text: '#ffffff',
  muted: '#c4b5fd',
  quiet: '#9ca3af',
  cyan: '#22d3ee',
  cyanSoft: '#67e8f9',
  amber: '#fbbf24',
};

export type StoryMapPin = {
  id: number | string;
  lat: number;
  lng: number;
  locationName: string;
  author: string;
  avatar: string;
  thumbnail: string;
  text: string;
  createdAt: string;
  story: Story;
};

function num(...values: unknown[]): number | null {
  for (const value of values) {
    const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function pinFromStoryRow(row: unknown): StoryMapPin | null {
  if (!row || typeof row !== 'object') return null;
  const raw = row as Record<string, unknown>;
  const story = ((raw.story as Story) || raw) as Story;
  const lat = num(raw.location_lat, raw.latitude, raw.lat, story.location_lat);
  const lng = num(raw.location_lng, raw.longitude, raw.lng, story.location_lng);
  if (lat == null || lng == null) return null;

  const user = (story.user || story.author || {}) as { username?: string; avatar?: string | null; first_name?: string };
  const media = (raw.media as Record<string, unknown>) || {};
  const image = story.image || story.media || media.thumbnail || media.image;
  const video = story.video || media.video;

  return {
    id: story.id ?? raw.id as string | number,
    lat,
    lng,
    locationName: String(story.location_name || raw.location_name || ''),
    author: String(user.username || user.first_name || 'Creator'),
    avatar: mediaUrl(String(user.avatar || '')),
    thumbnail: mediaUrl(String(image || video || '')),
    text: String(story.text || ''),
    createdAt: String(story.created_at || ''),
    story,
  };
}

export function asStoryMapPins(data: unknown): StoryMapPin[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.map(pinFromStoryRow).filter((pin): pin is StoryMapPin => !!pin);
}

export function uniquePlaces(pins: StoryMapPin[]) {
  return new Set(pins.map((p) => p.locationName || `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`)).size;
}

export function relativeStoryTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}
