import { API_ORIGIN } from './api';

/** WebSocket URL on the Django host (daphne). Auth is handled by cookies. */
export function wsUrl(path: string): string {
  const segment = path.startsWith('/') ? path : `/${path}`;
  const base = API_ORIGIN.replace(/\/$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}${segment}`;
}

export type ChatRuntimeConfig = {
  ice_servers?: RTCIceServer[];
  websocket?: {
    chat?: string;
    room?: string;
    signal?: string;
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
  kind: 'chat' | 'room' | 'signal',
  params: Record<string, string | number> = {},
): Promise<string> {
  const config = await getChatRuntimeConfig();
  const template = config?.websocket?.[kind];
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
  return wsUrl('/ws/signal/');
}
