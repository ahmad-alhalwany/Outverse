import { apiFetch, apiFetchJson, mediaUrl } from './api';

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

export type CapsuleStats = {
  sealed: number;
  ready: number;
  opened: number;
};

export type CapsuleCreateInput = {
  text: string;
  openAt: Date;
  voiceFile?: File | null;
};

/** List the current user's capsules (locked ones return sealed text/voice). */
export async function fetchMyCapsules(): Promise<TimeCapsule[]> {
  const res = await apiFetchJson('capsules/mine/', { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const list = Array.isArray(data) ? data : data?.results;
  return Array.isArray(list) ? (list as TimeCapsule[]) : [];
}

export async function fetchCapsuleStats(): Promise<CapsuleStats | null> {
  const res = await apiFetchJson('capsules/stats/', { method: 'GET' });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

/** Create a new sealed capsule. */
export async function createCapsule(
  input: CapsuleCreateInput,
): Promise<{ capsule: TimeCapsule | null; error?: string }> {
  const form = new FormData();
  form.append('text', input.text);
  form.append('open_at', input.openAt.toISOString());
  if (input.voiceFile) form.append('voice', input.voiceFile);

  const res = await apiFetch('capsules/', { method: 'POST', body: form });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const fieldError = data ? Object.values(data)[0] : null;
    return { capsule: null, error: data?.detail || (Array.isArray(fieldError) ? fieldError[0] : fieldError) || undefined };
  }
  return { capsule: data as TimeCapsule };
}

/** Reveal a capsule whose open_at has passed. */
export async function openCapsule(id: number): Promise<{ capsule: TimeCapsule | null; error?: string }> {
  const res = await apiFetchJson(`capsules/${id}/open/`, { method: 'POST' });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { capsule: null, error: data?.error || data?.detail || undefined };
  return { capsule: data as TimeCapsule };
}

export function capsuleVoiceUrl(url: string): string {
  return url ? mediaUrl(url) : '';
}
