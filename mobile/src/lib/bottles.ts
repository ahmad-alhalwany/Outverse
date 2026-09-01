import { emotionMeta, PROFILE_EMOTIONS } from '@/lib/profileEmotions';

export const BOTTLE_EMOTIONS = PROFILE_EMOTIONS;

export type BottlesPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  overlay: string;
};

export type BottleRow = {
  id: number;
  emotion_type: string;
  message?: string | null;
  location_lat: number | null;
  location_lng: number | null;
  created_at: string;
  caught_at?: string | null;
  expires_at?: string;
  is_mine?: boolean;
  sender_anon_id?: string;
  sender_username?: string | null;
};

export type BottleMarker = {
  id: number;
  lat: number;
  lng: number;
  color: string;
  emoji: string;
  label: string;
  emotion: string;
  expiresAt?: string;
  isMine?: boolean;
  message?: string | null;
};

export type BottleDashboard = {
  thrown: number;
  caught: number;
  timeline: Array<{ day: number; date: string; emotion: string | null }>;
  insights: Array<{ emotion: string; pct: number }>;
  current_mood: string | null;
};

export type BottleLocation = { lat: number; lng: number; label: string };

export function useBottlesPalette(isDark: boolean): BottlesPalette {
  if (isDark) {
    return {
      cream: '#14102A',
      card: '#1E1740',
      card2: '#251B4D',
      white: '#2A2154',
      brown: '#C4B5FD',
      brownDk: '#A78BFA',
      text: '#F5F3FF',
      text2: '#B0A6D9',
      line: 'rgba(167,139,250,0.20)',
      overlay: 'rgba(10,8,24,0.72)',
    };
  }
  return {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
  };
}

function toCoord(value: unknown): number | null {
  const n = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function asBottles(data: unknown): BottleRow[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows
    .map((row) => {
      const b = (row || {}) as Record<string, unknown>;
      const id = Number(b.id);
      if (!id) return null;
      return {
        id,
        emotion_type: String(b.emotion_type || 'mystery'),
        message: (b.message as string | null | undefined) ?? null,
        location_lat: toCoord(b.location_lat ?? b.lat ?? b.latitude),
        location_lng: toCoord(b.location_lng ?? b.lng ?? b.longitude),
        created_at: String(b.created_at || ''),
        caught_at: (b.caught_at as string | null | undefined) ?? null,
        expires_at: (b.expires_at as string | undefined) || (b.expiry_time as string | undefined),
        is_mine: Boolean(b.is_mine),
        sender_anon_id: b.sender_anon_id ? String(b.sender_anon_id) : undefined,
        sender_username: (b.sender_username as string | null | undefined) ?? null,
      };
    })
    .filter(Boolean) as BottleRow[];
}

export function asBottleMarkers(
  data: unknown,
  t: (key: string) => string,
): BottleMarker[] {
  return asBottles(data)
    .filter((b) => b.location_lat != null && b.location_lng != null)
    .map((b) => {
      const em = emotionMeta(b.emotion_type);
      return {
        id: b.id,
        lat: b.location_lat as number,
        lng: b.location_lng as number,
        color: em.color,
        emoji: em.emoji,
        label: t(em.labelKey),
        emotion: b.emotion_type,
        expiresAt: b.expires_at,
        isMine: b.is_mine,
        message: b.message,
      };
    });
}

export function asBottleDashboard(data: unknown): BottleDashboard {
  const obj = (data && typeof data === 'object' ? data : {}) as Partial<BottleDashboard>;
  return {
    thrown: Number(obj.thrown || 0),
    caught: Number(obj.caught || 0),
    timeline: Array.isArray(obj.timeline) ? obj.timeline : [],
    insights: Array.isArray(obj.insights) ? obj.insights : [],
    current_mood: obj.current_mood ?? null,
  };
}

export function markerToBottle(marker: BottleMarker): BottleRow {
  return {
    id: marker.id,
    emotion_type: marker.emotion,
    message: marker.message,
    location_lat: marker.lat,
    location_lng: marker.lng,
    created_at: new Date().toISOString(),
    expires_at: marker.expiresAt,
    is_mine: marker.isMine,
  };
}

export function relativeBottleTime(iso?: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function axiosDetail(error: unknown) {
  const data = (error as { response?: { data?: { detail?: string; error?: string } } })?.response?.data;
  return data?.detail || data?.error || '';
}

export function axiosStatus(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status;
}
