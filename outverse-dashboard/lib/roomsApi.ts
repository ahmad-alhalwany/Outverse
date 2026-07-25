import { apiFetch, apiFetchJson, mediaUrl } from './api';
import type { InspirationQuestion } from './questionsApi';

export type PromptRoom = {
  id: number;
  name: string;
  member_count: number;
  created_at: string;
  created_by_id: number;
  question: number | null;
  question_text: string | null;
  question_category: string | null;
  expires_at: string | null;
  is_expired: boolean;
  last_message: {
    id: number;
    text: string;
    sender_name: string;
    created_at: string;
  } | null;
};

export type RoomMessage = {
  id: number;
  room_id: number;
  sender_id: number;
  sender_name: string;
  sender_avatar: string | null;
  text: string;
  message_type: string;
  attachment_url: string | null;
  created_at: string;
};

/** List active prompt rooms (24h, centered on a question). */
export async function fetchPromptRooms(): Promise<PromptRoom[]> {
  const res = await apiFetchJson('chat/prompt-rooms/', { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as PromptRoom[]) : [];
}

/** Create or join a prompt room for a given question (idempotent). */
export async function createOrJoinPromptRoom(questionId: number): Promise<PromptRoom | null> {
  const res = await apiFetchJson('chat/prompt-rooms/', {
    method: 'POST',
    json: { question_id: questionId },
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

/** Fetch recent messages for a room. */
export async function fetchRoomMessages(roomId: number): Promise<RoomMessage[]> {
  const res = await apiFetchJson(`chat/rooms/${roomId}/messages/`, { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const list = Array.isArray(data) ? data : data?.messages;
  return Array.isArray(list) ? (list as RoomMessage[]) : [];
}

/** Post a new message to a room. */
export async function sendRoomMessage(roomId: number, text: string): Promise<RoomMessage | null> {
  const res = await apiFetch(`chat/rooms/${roomId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

export function roomAvatarUrl(url: string | null): string {
  return url ? mediaUrl(url) : '';
}

export type RoomRecapMessage = {
  id: number;
  sender_id: number;
  sender_name: string;
  text: string;
  created_at: string;
  chars: number;
};

export type RoomRecap = {
  room_id: number;
  question_text: string;
  question_category: string | null;
  participant_count: number;
  message_count: number;
  duration_minutes: number;
  top_messages: RoomRecapMessage[];
  summary: string;
  generated_at: string;
};

/** Fetch the sealed recap for an expired room (409 if still live). */
export async function fetchRoomRecap(roomId: number): Promise<RoomRecap | null> {
  const res = await apiFetchJson(`chat/rooms/${roomId}/recap/`, { method: 'GET' });
  if (!res.ok) return null;
  return await res.json().catch(() => null);
}

export type { InspirationQuestion };
