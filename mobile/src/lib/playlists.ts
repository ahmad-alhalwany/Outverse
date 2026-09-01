export type PlaylistsPalette = {
  page: string;
  card: string;
  inputBg: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  chipBg: string;
  danger: string;
};

export type PlaylistVideo = {
  id: number;
  title: string;
  description?: string;
  video?: string;
  video_url?: string;
  thumbnail?: string | null;
};

export type PlaylistItem = {
  id: number;
  order?: number;
  video?: PlaylistVideo | null;
};

export type Playlist = {
  id: number;
  title: string;
  description: string;
  is_public: boolean;
  items: PlaylistItem[];
  user?: { id?: number | string };
};

export function usePlaylistsPalette(isDark: boolean): PlaylistsPalette {
  if (isDark) {
    return {
      page: '#14102A',
      card: '#1E1740',
      inputBg: '#14102A',
      text: '#F5F3FF',
      muted: '#B0A6D9',
      accent: '#C4B5FD',
      border: 'rgba(255,255,255,0.08)',
      chipBg: 'rgba(255,255,255,0.06)',
      danger: '#E57373',
    };
  }
  return {
    page: '#F3F0FC',
    card: '#FFFFFF',
    inputBg: '#F5F1FE',
    text: '#211B3D',
    muted: '#79709E',
    accent: '#7C3AED',
    border: '#E3D9F7',
    chipBg: '#E9E1FA',
    danger: '#B23A3A',
  };
}

function asId(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function asVideo(data: unknown): PlaylistVideo | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  return {
    id,
    title: String(obj.title || ''),
    description: obj.description ? String(obj.description) : undefined,
    video: obj.video ? String(obj.video) : undefined,
    video_url: obj.video_url ? String(obj.video_url) : undefined,
    thumbnail: obj.thumbnail ? String(obj.thumbnail) : null,
  };
}

function asItem(data: unknown): PlaylistItem | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  const video = asVideo(obj.video) || asVideo(obj.video_detail);
  return {
    id,
    order: typeof obj.order === 'number' ? obj.order : undefined,
    video,
  };
}

export function asPlaylist(data: unknown): Playlist | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  const items: PlaylistItem[] = Array.isArray(obj.items)
    ? (obj.items.map(asItem).filter(Boolean) as PlaylistItem[])
    : Array.isArray(obj.videos)
      ? (obj.videos.map((video, index) => {
          const parsed = asVideo(video);
          return parsed ? { id: parsed.id * 1000 + index, video: parsed } : null;
        }).filter(Boolean) as PlaylistItem[])
      : [];
  return {
    id,
    title: String(obj.title || obj.name || `Playlist #${id}`),
    description: String(obj.description || ''),
    is_public: obj.is_public !== false,
    items,
    user: obj.user && typeof obj.user === 'object' ? (obj.user as Playlist['user']) : undefined,
  };
}

export function asPlaylists(data: unknown): Playlist[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.map(asPlaylist).filter((row): row is Playlist => Boolean(row));
}

export function playlistFieldError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0] != null) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}
