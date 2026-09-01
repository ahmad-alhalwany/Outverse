import { mediaUrl } from '@/api/config';
import { displayName } from '@/lib/names';
import type { User } from '@/types';

export type BoardsPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
};

export type PublicBoardInfo = {
  id: number;
  name: string;
  description: string;
  item_count: number;
  is_public?: boolean;
  cover_url?: string;
};

export type BoardPin = {
  id: number;
  text: string;
  image: string;
  author: string;
};

export function useBoardsPalette(isDark: boolean): BoardsPalette {
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
  };
}

function asId(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function asPublicBoard(data: unknown): PublicBoardInfo | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  return {
    id,
    name: String(obj.name || '').trim() || 'Board',
    description: String(obj.description || '').trim(),
    item_count: Number(obj.item_count || 0),
    is_public: Boolean(obj.is_public),
    cover_url: obj.cover_url ? String(obj.cover_url) : '',
  };
}

export function asPublicBoards(data: unknown): PublicBoardInfo[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.map(asPublicBoard).filter((row): row is PublicBoardInfo => Boolean(row?.is_public));
}

function mediaKind(media: Record<string, unknown>): string {
  return String(media.media_type || media.file_type || media.type || '').toLowerCase();
}

function mediaSrc(media: Record<string, unknown>): string {
  return mediaUrl(
    String(media.media_file || media.url || media.file || media.thumbnail_url || media.thumbnail || ''),
  );
}

export function asBoardPins(items: unknown): BoardPin[] {
  const rows = Array.isArray(items) ? items : [];
  return rows
    .map((row) => {
      const post = (row || {}) as Record<string, unknown>;
      const id = asId(post.id);
      if (!id) return null;
      const media = Array.isArray(post.media) ? post.media : [];
      const imageRow = media.find((item) => {
        const obj = (item || {}) as Record<string, unknown>;
        return mediaKind(obj) === 'image' && mediaSrc(obj);
      }) as Record<string, unknown> | undefined;
      const image = imageRow ? mediaSrc(imageRow) : '';
      if (!image) return null;
      return {
        id,
        text: String(post.text || ''),
        image,
        author: displayName(post.user as User | undefined, ''),
      };
    })
    .filter((row): row is BoardPin => Boolean(row));
}
