import { apiFetchJson } from './api';

export type PostDraft = {
  id: number;
  text: string;
  mood: string;
  tags: string[];
  updated_at: string;
  created_at: string;
};

/** List the current user's auto-saved drafts. */
export async function fetchDrafts(): Promise<PostDraft[]> {
  const res = await apiFetchJson('drafts/', { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const list = Array.isArray(data) ? data : data?.results;
  return Array.isArray(list) ? (list as PostDraft[]) : [];
}

/** Create a new draft. Returns the created draft with its id. */
export async function createDraft(input: {
  text: string;
  mood?: string;
  tags?: string[];
}): Promise<PostDraft | null> {
  const res = await apiFetchJson('drafts/', {
    method: 'POST',
    json: {
      text: input.text,
      mood: input.mood ?? '',
      tags: input.tags ?? [],
    },
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

/** Update an existing draft (used by debounced auto-save). */
export async function updateDraft(
  id: number,
  input: { text: string; mood?: string; tags?: string[] },
): Promise<PostDraft | null> {
  const res = await apiFetchJson(`drafts/${id}/`, {
    method: 'PATCH',
    json: {
      text: input.text,
      mood: input.mood ?? '',
      tags: input.tags ?? [],
    },
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

/** Discard a draft — called after a successful publish or explicit discard. */
export async function deleteDraft(id: number): Promise<void> {
  try {
    await apiFetchJson(`drafts/${id}/`, { method: 'DELETE' });
  } catch {
    /* best-effort */
  }
}
