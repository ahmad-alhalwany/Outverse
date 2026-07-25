import { apiFetch, apiFetchJson } from './api';

export interface LiveSession {
  id: number;
  user: string;
  title: string;
  description: string;
  thumbnail: string | null;
  stream_protocol: 'webrtc' | 'rtmp' | 'srt';
  // Ingest credentials — present only in the host's own response (server strips
  // them for anyone else); absent entirely for viewers, so always optional here.
  stream_key?: string;
  rtmp_url?: string;
  webrtc_publish_url?: string;
  playback_url?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  current_viewers: number;
  peak_viewers: number;
  total_views: number;
  is_public: boolean;
  chat_enabled: boolean;
  recording_enabled: boolean;
  moderation_enabled: boolean;
  auto_moderation: boolean;
  is_live: boolean;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface LiveState {
  id: number;
  is_live: boolean;
  status: LiveSession['status'];
  current_viewers: number;
  peak_viewers: number;
  total_views: number;
  duration_seconds: number;
  playback_url: string;
}

export interface LiveChatMessage {
  id: number;
  session: number;
  user: string;
  text: string;
  created_at: string;
  is_deleted: boolean;
}

export type ReactionType = 'heart' | 'fire' | 'spark' | 'clap' | 'thumbs_up';

export interface LiveReaction {
  id: number;
  session: number;
  user: string;
  type: ReactionType;
  created_at: string;
}

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as { results?: T[] }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

export async function fetchLiveSessions(statusFilter?: LiveSession['status']): Promise<LiveSession[]> {
  try {
    const params = statusFilter ? `?status=${statusFilter}` : '';
    const res = await apiFetch(`live/${params}`);
    if (!res.ok) return [];
    return unwrapList<LiveSession>(await res.json());
  } catch {
    return [];
  }
}

export type SessionFetchResult =
  | { kind: 'ok'; session: LiveSession }
  | { kind: 'not_found' }
  | { kind: 'error' };

export async function fetchSession(id: number): Promise<SessionFetchResult> {
  try {
    const res = await apiFetch(`live/${id}/`);
    if (res.status === 404) return { kind: 'not_found' };
    if (!res.ok) return { kind: 'error' };
    return { kind: 'ok', session: await res.json() };
  } catch {
    return { kind: 'error' };
  }
}

export type CreateSessionPayload = {
  title: string;
  description?: string;
  is_public?: boolean;
  chat_enabled?: boolean;
};

export async function createSession(data: CreateSessionPayload): Promise<{ ok: boolean; data: LiveSession | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson('live/', { method: 'POST', json: data });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

export async function startSession(id: number): Promise<{ ok: boolean; data: LiveSession | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson(`live/${id}/start/`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

export async function endSession(id: number): Promise<{ ok: boolean; data: LiveSession | Record<string, unknown> }> {
  try {
    const res = await apiFetchJson(`live/${id}/end/`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, data: body };
  } catch {
    return { ok: false, data: {} };
  }
}

export async function fetchLiveState(id: number): Promise<LiveState | null> {
  try {
    const res = await apiFetch(`live/${id}/live/`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function joinSession(id: number): Promise<boolean> {
  try {
    const res = await apiFetchJson(`live/${id}/join/`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function leaveSession(id: number): Promise<boolean> {
  try {
    const res = await apiFetchJson(`live/${id}/leave/`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Returns null on failure (network error, rate limit, etc.) so callers can
 * distinguish "no messages" from "the fetch failed" and avoid clobbering
 * already-displayed chat history with an empty list. */
export async function fetchChat(id: number): Promise<LiveChatMessage[] | null> {
  try {
    const res = await apiFetch(`live/${id}/chat/`);
    if (!res.ok) return null;
    return unwrapList<LiveChatMessage>(await res.json());
  } catch {
    return null;
  }
}

export async function sendMessage(id: number, text: string): Promise<LiveChatMessage | null> {
  try {
    const res = await apiFetchJson(`live/${id}/send_message/`, { method: 'POST', json: { text } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendReaction(id: number, type: ReactionType): Promise<LiveReaction | null> {
  try {
    const res = await apiFetchJson(`live/${id}/react/`, { method: 'POST', json: { type } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function deleteMessage(id: number, messageId: number): Promise<boolean> {
  try {
    const res = await apiFetchJson(`live/${id}/delete_message/`, { method: 'POST', json: { message_id: messageId } });
    return res.ok;
  } catch {
    return false;
  }
}
