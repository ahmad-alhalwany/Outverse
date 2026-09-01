import { mediaUrl } from '@/api/config';

export type LibraryPalette = {
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

export type ResourceType = 'all' | 'template' | 'toolkit' | 'tutorial';

export type LibraryResource = {
  id: number;
  title: string;
  description: string;
  type: string;
  type_display: string;
  mood: string;
  mood_display: string;
  file_url: string;
  cover_url: string;
  file_size_label: string;
  download_count: number;
};

export const LIBRARY_TABS: { key: ResourceType; labelKey: string; icon: 'apps-outline' | 'document-text-outline' | 'construct-outline' | 'school-outline' }[] = [
  { key: 'all', labelKey: 'library.tabAll', icon: 'apps-outline' },
  { key: 'template', labelKey: 'library.tabTemplate', icon: 'document-text-outline' },
  { key: 'toolkit', labelKey: 'library.tabToolkit', icon: 'construct-outline' },
  { key: 'tutorial', labelKey: 'library.tabTutorial', icon: 'school-outline' },
];

export function useLibraryPalette(isDark: boolean): LibraryPalette {
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

export function asResource(data: unknown): LibraryResource | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  return {
    id,
    title: String(obj.title || ''),
    description: String(obj.description || ''),
    type: String(obj.type || 'template'),
    type_display: String(obj.type_display || obj.type || ''),
    mood: String(obj.mood || ''),
    mood_display: String(obj.mood_display || ''),
    file_url: String(obj.file_url || ''),
    cover_url: String(obj.cover_url || ''),
    file_size_label: String(obj.file_size_label || ''),
    download_count: Number(obj.download_count || 0),
  };
}

export function asResources(data: unknown): LibraryResource[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.map(asResource).filter((row): row is LibraryResource => Boolean(row));
}

export function resourceFileUrl(url: string): string {
  return url ? mediaUrl(url) : '';
}

export function resourceIcon(type: string): 'document-text-outline' | 'construct-outline' | 'school-outline' {
  if (type === 'toolkit') return 'construct-outline';
  if (type === 'tutorial') return 'school-outline';
  return 'document-text-outline';
}
