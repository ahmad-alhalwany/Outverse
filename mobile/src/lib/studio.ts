export const STUDIO_CANVAS_W = 800;
export const STUDIO_CANVAS_H = 480;
export const STUDIO_PALETTE = ['#5B21B6', '#DC2626', '#059669', '#2563EB', '#D97706', '#111827'];

export type StudioUser = {
  id: number;
  username: string;
  avatar?: string | null;
};

export type StudioPoint = { x: number; y: number };

export type StudioStroke = {
  id: number;
  user?: StudioUser | null;
  points: StudioPoint[];
  color: string;
  width: number;
};

export type StudioMedia = {
  id: number;
  user?: StudioUser | null;
  image: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  filter?: string;
  opacity?: number;
  visible?: boolean;
};

export type StudioShapeKind = 'rectangle' | 'circle' | 'line';

export type StudioShape = {
  id: number;
  user?: StudioUser | null;
  kind: StudioShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  color: string;
  stroke_width: number;
  opacity?: number;
  visible?: boolean;
};

export type StudioText = {
  id: number;
  user?: StudioUser | null;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  z_index: number;
  color: string;
  font_size: number;
  opacity?: number;
  visible?: boolean;
};

export type StudioSession = {
  id: number;
  title: string;
  host: StudioUser;
  mode: 'solo' | 'live';
  is_live?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type StudioSessionDetail = StudioSession & {
  strokes: StudioStroke[];
  media: StudioMedia[];
  shapes: StudioShape[];
  texts: StudioText[];
  participants: { user: StudioUser }[];
};

export type StudioChatMsg = { user: StudioUser; text: string };

export function useStudioPalette(isDark: boolean) {
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
      line: 'rgba(167,139,250,0.22)',
      canvas: '#2A2154',
      coverFrom: '#251B4D',
      coverTo: '#3A2A6B',
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
    canvas: '#FFFFFF',
    coverFrom: '#E9E1FA',
    coverTo: '#DCC9FA',
  };
}

export function asStudioSessions(data: unknown): StudioSession[] {
  if (Array.isArray(data)) return data as StudioSession[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: StudioSession[] }).results)) {
    return (data as { results: StudioSession[] }).results;
  }
  return [];
}

export function asStudioUsers(data: unknown): StudioUser[] {
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return raw
    .map((row) => {
      const item = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
      const nested = (item.user || item.following || item) as Record<string, unknown>;
      const id = Number(nested.id);
      if (!id) return null;
      return {
        id,
        username: String(nested.username || ''),
        avatar: (nested.avatar as string | null) || null,
      };
    })
    .filter(Boolean) as StudioUser[];
}

export function pointsToSvg(points: StudioPoint[], scale: number): string {
  if (!points || points.length < 2) return '';
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * scale},${p.y * scale}`)
    .join(' ');
}
