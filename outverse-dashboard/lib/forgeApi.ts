import { apiFetch, apiUrl } from '@/lib/api';
import { wsUrl } from '@/lib/ws';

export const FORGE_BASE = apiUrl('forge/stories');

export type ForgeUser = {
  id?: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};

export type ForgeSegment = {
  id: number;
  content: string;
  order: number;
  status?: 'pending' | 'approved' | 'rejected';
  author: ForgeUser | null;
  dialogues_count?: number;
  dialogues?: ForgeDialogue[];
  created_at?: string;
};

export type ForgeDialogue = {
  id: number;
  text: string;
  author: ForgeUser | null;
  parent?: number | null;
  replies?: ForgeDialogue[];
  created_at: string;
};

export type ForgeCollaborator = {
  id: number;
  user: ForgeUser;
  role: 'writer' | 'editor' | 'narrator';
  status: 'invited' | 'requested' | 'accepted' | 'removed';
};

export type ForgeOutlineBeat = {
  act?: number;
  title?: string;
  beats?: string[];
};

export type ForgeCharacter = {
  name?: string;
  role?: string;
  traits?: string[];
  voice?: string;
  notes?: string;
};

export type ForgeStory = {
  id: number;
  title: string;
  premise: string;
  cover_url: string;
  cover_prompt?: string;
  genre: string;
  genre_display: string;
  status: string;
  visibility?: 'public' | 'invite_only';
  studio_mode?: 'solo' | 'collab';
  require_approval?: boolean;
  tone?: string;
  pov?: string;
  content_rules?: string;
  outline?: ForgeOutlineBeat[];
  characters?: ForgeCharacter[];
  world_notes?: string;
  writing_goal?: number | null;
  max_segments: number;
  target_words?: number | null;
  is_featured: boolean;
  owner: ForgeUser | null;
  segment_count: number;
  approved_segment_count?: number;
  pending_segment_count?: number;
  contributors_count: number;
  word_count?: number;
  can_contribute?: boolean;
  can_edit_bible?: boolean;
  can_approve?: boolean;
  can_revise?: boolean;
  is_owner?: boolean;
  is_studio_member?: boolean;
  can_request_join?: boolean;
  my_collab_status?: 'owner' | 'invited' | 'requested' | 'accepted' | 'removed' | null;
  my_role?: string | null;
  is_saved?: boolean;
  segments?: ForgeSegment[];
  pending_segments?: ForgeSegment[];
  collaborators?: ForgeCollaborator[];
  cover_source?: string;
  cover_preview?: string;
};

export function displayName(user: ForgeUser | null | undefined) {
  if (!user) return 'Anonymous';
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username || 'Anonymous';
}

export async function fetchForgeStory(id: number | string): Promise<ForgeStory> {
  const res = await apiFetch(`forge/stories/${id}/`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load story (${res.status})`);
  }
  return res.json();
}

export async function fetchMyForge(kind: 'all' | 'owned' | 'saved' | 'collaborating' = 'all') {
  const res = await apiFetch(`forge/stories/my/?kind=${kind}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results || [];
}

export async function postSegment(id: number, content: string) {
  const res = await apiFetch(`forge/stories/${id}/segments/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not add part');
  return data as ForgeSegment;
}

export async function reviseSegment(storyId: number, segmentId: number, content: string) {
  const res = await apiFetch(`forge/stories/${storyId}/segments/${segmentId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Revise failed');
  return data as ForgeSegment;
}

export async function approveSegment(storyId: number, segmentId: number) {
  const res = await apiFetch(`forge/stories/${storyId}/segments/${segmentId}/approve/`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Approve failed');
  }
  return res.json();
}

export async function rejectSegment(storyId: number, segmentId: number) {
  const res = await apiFetch(`forge/stories/${storyId}/segments/${segmentId}/reject/`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Reject failed');
  }
  return res.json();
}

export async function inviteCollaborator(
  storyId: number,
  payload: { username?: string; user_id?: number; role?: string },
) {
  const res = await apiFetch(`forge/stories/${storyId}/invite/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Invite failed');
  return data as ForgeCollaborator;
}

export async function respondInvite(storyId: number, accept: boolean) {
  const res = await apiFetch(`forge/stories/${storyId}/collaborators/respond/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accept }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not respond');
  return data;
}

export async function requestJoinStory(storyId: number, role = 'writer') {
  const res = await apiFetch(`forge/stories/${storyId}/join/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not request join');
  return data as ForgeCollaborator;
}

export async function reviewJoinRequest(
  storyId: number,
  userId: number,
  accept: boolean,
  role = 'writer',
) {
  const res = await apiFetch(`forge/stories/${storyId}/collaborators/${userId}/review/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accept, role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not review request');
  return data as ForgeCollaborator;
}

export async function postDialogue(storyId: number, segmentId: number, text: string, parent?: number) {
  const res = await apiFetch(`forge/stories/${storyId}/segments/${segmentId}/dialogues/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, parent }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not post dialogue');
  return data as ForgeDialogue;
}

export async function generateCover(storyId: number, prompt?: string) {
  const res = await apiFetch(`forge/stories/${storyId}/generate_cover/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: prompt || '' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Cover generation failed');
  return data as ForgeStory;
}

export async function updateStory(storyId: number, payload: Partial<ForgeStory>) {
  const res = await apiFetch(`forge/stories/${storyId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Update failed');
  return data as ForgeStory;
}

export async function patchBible(storyId: number, payload: Record<string, unknown>) {
  const res = await apiFetch(`forge/stories/${storyId}/bible/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Bible update failed');
  return data as ForgeStory;
}

export async function toggleSaveStory(storyId: number) {
  const res = await apiFetch(`forge/stories/${storyId}/toggle_save/`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Save failed');
  return data as { saved: boolean };
}

export async function buddyContinue(storyId: number) {
  const res = await apiFetch(`forge/stories/${storyId}/ai/continue/`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Buddy failed');
  return data as { text: string; source: string };
}

export async function buddyRewrite(storyId: number, draft: string, style = 'stronger') {
  const res = await apiFetch(`forge/stories/${storyId}/ai/rewrite/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft, style }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Rewrite failed');
  return data as { text: string; source: string; style: string };
}

export async function buddyOutline(storyId: number, apply = false) {
  const res = await apiFetch(`forge/stories/${storyId}/ai/outline/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Outline failed');
  return data as { outline: ForgeOutlineBeat[]; source: string; applied?: boolean };
}

export async function buddyCharacter(storyId: number, apply = false) {
  const res = await apiFetch(`forge/stories/${storyId}/ai/character/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apply }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Character failed');
  return data as { character: ForgeCharacter; source: string; applied?: boolean };
}

export async function buddyCritique(storyId: number, draft = '') {
  const res = await apiFetch(`forge/stories/${storyId}/ai/critique/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Critique failed');
  return data as { text: string; source: string };
}

export async function buddyInspire(
  storyId: number,
  mode: 'spark' | 'twist' | 'sensory' | 'dialogue' = 'spark',
  draft = '',
) {
  const res = await apiFetch(`forge/stories/${storyId}/ai/inspire/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, draft }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Inspire failed');
  return data as { text: string; mode: string; source: string };
}

export function pdfExportUrl(storyId: number) {
  return apiUrl(`forge/stories/${storyId}/export_pdf/`);
}

export function forgeStoryWsUrl(storyId: number) {
  return wsUrl(`/ws/forge/story/${storyId}/`);
}
