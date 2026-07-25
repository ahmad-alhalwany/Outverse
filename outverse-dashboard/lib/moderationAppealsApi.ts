import { apiFetch, apiFetchJson } from './api';

export type ContentAppeal = {
  id: number;
  user: number;
  flagged_content: number | null;
  content_type: string;
  object_id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  staff_note: string;
};

export async function fetchMyAppeals(): Promise<ContentAppeal[]> {
  const res = await apiFetch('moderation/appeals/');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function submitContentAppeal(payload: {
  content_type: string;
  object_id: number;
  reason: string;
  flagged_content?: number;
}): Promise<ContentAppeal | null> {
  const res = await apiFetchJson('moderation/appeals/', {
    method: 'POST',
    json: payload,
  });
  if (!res.ok) return null;
  return res.json();
}
