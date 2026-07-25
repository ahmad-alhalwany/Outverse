'use client';

import { getToken } from '@/lib/auth';
import { API_ORIGIN } from './api';

function appendAuthToken(url: string): string {
  const token = getToken();
  if (!token) return url;
  if (url.includes('token=')) {
    return url.endsWith('token=') ? `${url}${encodeURIComponent(token)}` : url;
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

/** WebSocket URL on the Django host (daphne). Appends DRF token when present. */
export function wsUrl(path: string): string {
  const segment = path.startsWith('/') ? path : `/${path}`;
  const base = API_ORIGIN.replace(/\/$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return appendAuthToken(`${wsBase}${segment}`);
}

export type ChatRuntimeConfig = {
  ice_servers?: RTCIceServer[];
  websocket?: {
    chat?: string;
    room?: string;
    signal?: string;
    notifications?: string;
  };
};

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

let runtimeConfigPromise: Promise<ChatRuntimeConfig | null> | null = null;

export async function getChatRuntimeConfig(): Promise<ChatRuntimeConfig | null> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch(`${API_ORIGIN}/api/chat/config/`, {
      credentials: 'include',
    })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return runtimeConfigPromise;
}

export async function resolveWsUrl(
  kind: 'chat' | 'room' | 'signal' | 'notifications' | 'live',
  params: Record<string, string | number> = {},
): Promise<string> {
  const config = await getChatRuntimeConfig();
  const template = kind !== 'live' ? config?.websocket?.[kind as 'chat' | 'room' | 'signal' | 'notifications'] : undefined;
  if (template) {
    const resolvedPath = Object.entries(params).reduce(
      (value, [key, param]) => value.replace(`{${key}}`, String(param)),
      template,
    );
    return wsUrl(resolvedPath);
  }
  if (kind === 'chat') {
    return wsUrl(`/ws/chat/${params.conversation_id}/`);
  }
  if (kind === 'room') {
    return wsUrl(`/ws/room/${params.room_id}/`);
  }
  if (kind === 'notifications') {
    return wsUrl('/ws/notifications/');
  }
  if (kind === 'live') {
    return wsUrl(`/ws/live/${params.session_id}/`);
  }
  return wsUrl('/ws/signal/');
}
