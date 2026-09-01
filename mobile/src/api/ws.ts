import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_ORIGIN } from './config';

const TOKEN_KEY = 'auth_token';

export type WsChatPayload = {
  type: string;
  id?: number;
  sender_id?: number;
  sender_name?: string;
  sender_avatar?: string | null;
  text?: string;
  message_type?: string;
  attachment_url?: string | null;
  created_at?: string;
  is_read?: boolean;
  is_pinned?: boolean;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean;
  expires_at?: string | null;
  conversation_id?: number;
  user_id?: number;
  is_typing?: boolean;
  message_id?: number;
};

function appendAuthToken(url: string, token: string | null): string {
  if (!token) return url;
  if (url.includes('token=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}

/** Build a WebSocket URL on the Django host (http→ws, https→wss). */
export function wsUrl(path: string, token?: string | null): string {
  const segment = path.startsWith('/') ? path : `/${path}`;
  const base = API_ORIGIN.replace(/\/$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  return appendAuthToken(`${wsBase}${segment}`, token ?? null);
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

let runtimeConfigPromise: Promise<ChatRuntimeConfig | null> | null = null;

export async function getChatRuntimeConfig(): Promise<ChatRuntimeConfig | null> {
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch(`${API_BASE_URL}/chat/config/`)
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return runtimeConfigPromise;
}

export async function getWsToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function resolveWsUrl(
  kind: 'chat' | 'room' | 'signal' | 'notifications' | 'live',
  params: Record<string, string | number> = {},
): Promise<string> {
  const token = await getWsToken();
  const config = await getChatRuntimeConfig();
  const template =
    kind !== 'live'
      ? config?.websocket?.[kind as 'chat' | 'room' | 'signal' | 'notifications']
      : undefined;
  if (template) {
    const resolvedPath = Object.entries(params).reduce(
      (value, [key, param]) => value.replace(`{${key}}`, String(param)),
      template,
    );
    return wsUrl(resolvedPath, token);
  }
  if (kind === 'chat') {
    return wsUrl(`/ws/chat/${params.conversation_id}/`, token);
  }
  if (kind === 'room') {
    return wsUrl(`/ws/room/${params.room_id}/`, token);
  }
  if (kind === 'notifications') {
    return wsUrl('/ws/notifications/', token);
  }
  if (kind === 'live') {
    return wsUrl(`/ws/live/${params.session_id}/`, token);
  }
  return wsUrl('/ws/signal/', token);
}

export type ReconnectingSocketOptions = {
  url: string | (() => Promise<string>);
  onMessage: (data: WsChatPayload) => void;
  onOpen?: () => void;
  onClose?: () => void;
  minDelayMs?: number;
  maxDelayMs?: number;
};

/** WebSocket with exponential backoff reconnect; call `close()` on unmount. */
export function createReconnectingWebSocket(options: ReconnectingSocketOptions) {
  let ws: WebSocket | null = null;
  let closed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const minDelay = options.minDelayMs ?? 1000;
  const maxDelay = options.maxDelayMs ?? 30000;

  const scheduleReconnect = () => {
    if (closed) return;
    const delay = Math.min(maxDelay, minDelay * 1.5 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (closed) return;
    try {
      const url =
        typeof options.url === 'function' ? await options.url() : options.url;
      if (closed) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
        options.onOpen?.();
      };

      ws.onclose = () => {
        options.onClose?.();
        ws = null;
        if (!closed) scheduleReconnect();
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onmessage = (ev) => {
        try {
          options.onMessage(JSON.parse(String(ev.data)) as WsChatPayload);
        } catch {
          /* ignore malformed frames */
        }
      };
    } catch {
      if (!closed) scheduleReconnect();
    }
  };

  void connect();

  return {
    send(data: Record<string, unknown>) {
      if (ws?.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify(data));
      return true;
    },
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
      ws = null;
    },
    isConnected() {
      return ws?.readyState === WebSocket.OPEN;
    },
  };
}
