export type ChatPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  overlay: string;
  bubbleIn: string;
  bubbleOut: string;
  online: string;
};

export type ChatFriend = {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  status_message: string;
  mood_icon: string;
  is_online: boolean;
};

export type ChatLastMessage = {
  id?: number;
  text?: string;
  content?: string;
  sender_id?: number;
  created_at: string;
};

export type ChatConversation = {
  id: number;
  peer: ChatFriend | null;
  last_message: ChatLastMessage | null;
  unread_count: number;
  updated_at: string;
  is_archived?: boolean;
  is_muted?: boolean;
  is_request?: boolean;
};

export type ChatRoomRow = {
  id: number;
  name: string;
  member_count: number;
  members?: Array<{ id: number; username: string; name: string; avatar: string | null }>;
  created_by_id?: number;
  last_message?: ChatLastMessage | null;
  created_at: string;
  question?: number | null;
  question_text?: string | null;
  question_category?: string | null;
  expires_at?: string | null;
  is_expired?: boolean;
  channel_type?: 'text' | 'voice' | 'stage';
};

export type ChatSender = {
  id: string | number;
  username: string;
  display_name?: string;
  avatar?: string;
};

export type ChatThreadMessage = {
  id: string | number;
  sender: ChatSender;
  sender_id?: number;
  sender_name?: string;
  text: string;
  content: string;
  message_type?: string;
  attachment_url?: string | null;
  is_read: boolean;
  is_pinned?: boolean;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean;
  expires_at?: string | null;
  created_at: string;
  read_count?: number | null;
  member_count?: number | null;
};

export const QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '✨', '👍', '🎨', '🚀'] as const;
export const CHAT_REACTS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✨'] as const;
export const VANISH_PRESETS = [
  { labelKey: 'chat.vanish1Hour', seconds: 3600 },
  { labelKey: 'chat.vanish24Hours', seconds: 86400 },
  { labelKey: 'chat.vanish7Days', seconds: 7 * 86400 },
] as const;

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function useChatPalette(isDark: boolean): ChatPalette {
  if (isDark) {
    return {
      cream: '#14102A',
      card: '#1E1740',
      card2: '#251B4D',
      white: '#2A2154',
      brown: '#C4B5FD',
      brownDk: '#A78BFA',
      text: '#F5F3FF',
      text2: '#B0A6D9',
      line: 'rgba(167,139,250,0.20)',
      overlay: 'rgba(10,8,24,0.65)',
      bubbleIn: '#251B4D',
      bubbleOut: '#5B21B6',
      online: '#34D399',
    };
  }
  return {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
    bubbleIn: '#E9E1FA',
    bubbleOut: '#5B21B6',
    online: '#2f8f6b',
  };
}

export function asChatList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.friends)) return obj.friends as T[];
  }
  return [];
}

export function moodEmoji(icon?: string) {
  return icon === 'cloud' ? '☁️' : '☀️';
}

export function previewText(msg?: ChatLastMessage | null) {
  if (!msg) return '';
  return String(msg.text || msg.content || '').trim();
}

export function relativeChatTime(
  iso: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return t('chat.justNow');
  if (mins < 60) return t('chat.minutesShort', { n: mins });
  if (hours < 24) return t('chat.hoursShort', { n: hours });
  if (days < 7) return t('chat.daysShort', { n: days });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTimeLeft(expiresAt: string, t: TFn): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return t('chat.vanishing');
  const mins = Math.round(ms / 60000);
  if (mins < 60) return t('chat.vanishesInMinutes', { n: String(mins) });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('chat.vanishesInHours', { n: String(hours) });
  return t('chat.vanishesInDays', { n: String(Math.round(hours / 24)) });
}

export function buildReplyQuote(target: ChatThreadMessage, isOwn: boolean, peerName: string, t: TFn) {
  const name = isOwn ? t('chat.you') : target.sender.display_name || target.sender.username || peerName || t('chat.them');
  const snippet = (target.text || '').length > 80 ? `${(target.text || '').slice(0, 80)}…` : target.text || '';
  return `${t('chat.replyingToQuote', { name, text: snippet })}\n`;
}
