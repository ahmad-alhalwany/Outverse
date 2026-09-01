import { mediaUrl } from '@/api/config';

export type CapsulesPalette = {
  page: string;
  card: string;
  inputBg: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  chipBg: string;
  danger: string;
  overlay: string;
};

export type TimeCapsule = {
  id: number;
  text: string;
  voice_url: string;
  created_at: string;
  open_at: string;
  opened_at: string | null;
  is_unlocked: boolean;
  is_opened: boolean;
};

export type CapsuleDuration = 'week' | 'month' | 'halfYear' | 'year' | 'custom';

export type CapsuleVoice = {
  uri: string;
  name: string;
  type: string;
};

export const CAPSULE_DURATIONS: { id: Exclude<CapsuleDuration, 'custom'>; days: number }[] = [
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
  { id: 'halfYear', days: 182 },
  { id: 'year', days: 365 },
];

export function useCapsulesPalette(isDark: boolean): CapsulesPalette {
  if (isDark) {
    return {
      page: '#14102A',
      card: '#1E1740',
      inputBg: '#1E1740',
      text: '#F5F3FF',
      muted: '#B0A6D9',
      accent: '#C4B5FD',
      border: 'rgba(255,255,255,0.08)',
      chipBg: 'rgba(255,255,255,0.06)',
      danger: '#E57373',
      overlay: 'rgba(10,8,24,0.65)',
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
    overlay: 'rgba(33,27,61,0.45)',
  };
}

function asId(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function asCapsule(data: unknown): TimeCapsule | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const id = asId(obj.id);
  if (!id) return null;
  return {
    id,
    text: typeof obj.text === 'string' ? obj.text : '',
    voice_url: typeof obj.voice_url === 'string' ? obj.voice_url : '',
    created_at: String(obj.created_at || ''),
    open_at: String(obj.open_at || ''),
    opened_at: obj.opened_at ? String(obj.opened_at) : null,
    is_unlocked: Boolean(obj.is_unlocked),
    is_opened: Boolean(obj.is_opened),
  };
}

export function asCapsules(data: unknown): TimeCapsule[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows.map(asCapsule).filter((row): row is TimeCapsule => Boolean(row));
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDateInputValue(date: Date): string {
  return addDays(date, 0).toISOString().slice(0, 10);
}

export function formatRemaining(openAt: string): string {
  const target = new Date(openAt).getTime();
  if (!Number.isFinite(target)) return '';
  const diff = target - Date.now();
  if (diff <= 0) return '';
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  return `${days}d ${hours}h`;
}

export function progressFraction(capsule: TimeCapsule): number {
  const created = new Date(capsule.created_at).getTime();
  const target = new Date(capsule.open_at).getTime();
  const total = target - created;
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.min(1, Math.max(0, (Date.now() - created) / total));
}

export function formatCapsuleDate(iso?: string | null, locale?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : undefined);
}

export function capsuleVoiceUrl(url: string): string {
  return url ? mediaUrl(url) : '';
}

export function capsuleFieldError(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data.error === 'string') return data.error;
  const first = Object.values(data)[0];
  if (Array.isArray(first) && first[0] != null) return String(first[0]);
  if (typeof first === 'string') return first;
  return fallback;
}
