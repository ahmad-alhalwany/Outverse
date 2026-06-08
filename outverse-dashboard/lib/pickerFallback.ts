export type PickerMediaItem = {
  id: string;
  preview: string;
  url: string;
  tags?: string[];
};

const FALLBACK_GIFS: PickerMediaItem[] = [
  {
    id: 'g1',
    preview: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/200.gif',
    url: 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    tags: ['happy', 'dance', 'celebrate'],
  },
  {
    id: 'g2',
    preview: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/200.gif',
    url: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    tags: ['cosmic', 'space', 'stars'],
  },
  {
    id: 'g3',
    preview: 'https://media.giphy.com/media/26BRv0FlkhXZ4wQV2/200.gif',
    url: 'https://media.giphy.com/media/26BRv0FlkhXZ4wQV2/giphy.gif',
    tags: ['wow', 'amazing', 'mind'],
  },
  {
    id: 'g4',
    preview: 'https://media.giphy.com/media/13CoXDiaCcGyGE/200.gif',
    url: 'https://media.giphy.com/media/13CoXDiaCcGyGE/giphy.gif',
    tags: ['love', 'heart', 'cute'],
  },
  {
    id: 'g5',
    preview: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/200.gif',
    url: 'https://media.giphy.com/media/l3q2K5jinAlChoCLS/giphy.gif',
    tags: ['yes', 'agree', 'ok'],
  },
  {
    id: 'g6',
    preview: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200.gif',
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    tags: ['think', 'hmm', 'idea'],
  },
  {
    id: 'g7',
    preview: 'https://media.giphy.com/media/5GoVLqeAOo6PK/200.gif',
    url: 'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
    tags: ['laugh', 'funny', 'lol'],
  },
  {
    id: 'g8',
    preview: 'https://media.giphy.com/media/ICOgUNjpvO0WA/200.gif',
    url: 'https://media.giphy.com/media/ICOgUNjpvO0WA/giphy.gif',
    tags: ['fire', 'lit', 'cool'],
  },
];

const FALLBACK_STICKERS: PickerMediaItem[] = [
  {
    id: 's1',
    preview: 'https://media.giphy.com/media/9rtpurjbqthsz6eY4U/200.gif',
    url: 'https://media.giphy.com/media/9rtpurjbqthsz6eY4U/giphy.gif',
    tags: ['sticker', 'sparkle', 'star'],
  },
  {
    id: 's2',
    preview: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/200.gif',
    url: 'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
    tags: ['sticker', 'wave', 'hi'],
  },
  {
    id: 's3',
    preview: 'https://media.giphy.com/media/26BRv0FlkhXZ4wQV2/200.gif',
    url: 'https://media.giphy.com/media/26BRv0FlkhXZ4wQV2/giphy.gif',
    tags: ['sticker', 'cosmic'],
  },
  {
    id: 's4',
    preview: 'https://media.giphy.com/media/3o7TKsQ8MJHyTASOty/200.gif',
    url: 'https://media.giphy.com/media/3o7TKsQ8MJHyTASOty/giphy.gif',
    tags: ['sticker', 'heart'],
  },
  {
    id: 's5',
    preview: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/200.gif',
    url: 'https://media.giphy.com/media/l0HlBO7eyXzSZkJri/giphy.gif',
    tags: ['sticker', 'rocket'],
  },
  {
    id: 's6',
    preview: 'https://media.giphy.com/media/26gscnq29J9aCoK7S/200.gif',
    url: 'https://media.giphy.com/media/26gscnq29J9aCoK7S/giphy.gif',
    tags: ['sticker', 'party'],
  },
];

export function filterFallback(
  query: string,
  type: 'gif' | 'sticker',
): PickerMediaItem[] {
  const pool = type === 'sticker' ? FALLBACK_STICKERS : FALLBACK_GIFS;
  const q = query.trim().toLowerCase();
  if (!q) return pool;
  return pool.filter(
    (item) =>
      item.tags?.some((t) => t.includes(q)) || item.id.includes(q),
  );
}
