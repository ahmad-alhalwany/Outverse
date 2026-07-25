import { apiFetch, apiFetchJson } from '@/lib/api';

export type Note = {
  id: number;
  user: { id: number; username: string; first_name?: string; last_name?: string; avatar?: string | null };
  text: string;
  theme: string;
  created_at: string;
  expires_at: string;
  is_expired: boolean;
};

export async function fetchFollowingNotes(): Promise<Note[]> {
  const res = await apiFetch('notes/following/');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createNote(text: string, expires_in: '24h' | '7d' = '24h'): Promise<Note | null> {
  const res = await apiFetchJson('notes/', {
    method: 'POST',
    json: { text: text.trim(), expires_in },
  });
  if (!res.ok) return null;
  return res.json() as Promise<Note>;
}
