'use client';

import './cosmic-chat.css';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import {
  ArchiveBoxIcon,
  ArrowLeftIcon,
  BeakerIcon,
  BellSlashIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  FaceSmileIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PencilSquareIcon,
  PhoneIcon,
  PhotoIcon,
  PlusCircleIcon,
  SpeakerWaveIcon,
  UserMinusIcon,
  UserPlusIcon,
  VideoCameraIcon,
  SparklesIcon,
  MapPinIcon,
  TrashIcon,
  FireIcon,
  ClockIcon,
  ArrowUturnLeftIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { fetchPromptRooms, createOrJoinPromptRoom, fetchRoomRecap, type PromptRoom, type RoomRecap } from '@/lib/roomsApi';
import InspirationPicker from '@/components/posts/InspirationPicker';
import type { InspirationQuestion } from '@/lib/questionsApi';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useLocale } from '@/components/LocaleProvider';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';
import {
  useChatWebSocket,
  type UploadProgress,
  type WsChatMessage,
} from '@/hooks/useChatWebSocket';
import { useRoomWebSocket, type WsRoomMessage } from '@/hooks/useRoomWebSocket';
import { useSignalWebSocket, type SignalPayload } from '@/hooks/useSignalWebSocket';
import { useWebRTCCall } from '@/hooks/useWebRTCCall';
import { useGroupCall } from '@/hooks/useGroupCall';
import CallOverlay from '@/components/chat/CallOverlay';
import GroupCallOverlay from '@/components/chat/GroupCallOverlay';
import MemberPickerModal from '@/components/chat/MemberPickerModal';
import ReactionBurst from '@/components/ReactionBurst';
import { useConfirm } from '@/components/ui/ConfirmDialogProvider';

const QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '✨', '👍', '🎨', '🚀'];
const SWIPE_TRIGGER_PX = 56;

type Friend = {
  id: number;
  username: string;
  name: string;
  avatar: string | null;
  status_message: string;
  mood_icon: string;
  is_online: boolean;
};

type ChatMessage = {
  id: number;
  sender_id: number;
  sender_name?: string;
  text: string;
  message_type?: string;
  attachment_url?: string | null;
  created_at: string;
  is_read?: boolean;
  is_pinned?: boolean;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  edited_at?: string | null;
  is_deleted?: boolean;
  read_count?: number | null;
  member_count?: number | null;
  expires_at?: string | null;
};

const CHAT_REACTS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✨'] as const;

const MOOD_STAMPS = [
  { key: 'sun', emoji: '☀️', labelKey: 'chat.moodSunny' },
  { key: 'cloud', emoji: '☁️', labelKey: 'chat.moodCloudy' },
] as const;

type ReactionBurstState = { id: number; emoji: string; x: number; y: number };

const VANISH_PRESETS: { labelKey: string; seconds: number }[] = [
  { labelKey: 'chat.vanish1Hour', seconds: 3600 },
  { labelKey: 'chat.vanish24Hours', seconds: 86400 },
  { labelKey: 'chat.vanish7Days', seconds: 7 * 86400 },
];

function formatTimeLeft(expiresAt: string, t: (key: string, vars?: Record<string, string>) => string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return t('chat.vanishing');
  const mins = Math.round(ms / 60000);
  if (mins < 60) return t('chat.vanishesInMinutes', { n: String(mins) });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('chat.vanishesInHours', { n: String(hours) });
  return t('chat.vanishesInDays', { n: String(Math.round(hours / 24)) });
}

type ScheduledMessageEntry = {
  id: number;
  conversation: number | null;
  room: number | null;
  text: string;
  send_at: string;
  created_at: string;
};

type ConversationSummary = {
  id: number;
  peer: Friend | null;
  last_message: ChatMessage | null;
  unread_count: number;
  updated_at: string;
  is_archived?: boolean;
  is_muted?: boolean;
  is_request?: boolean;
};

type ChatRoom = {
  id: number;
  name: string;
  member_count: number;
  members: Array<{ id: number; username: string; name: string; avatar: string | null }>;
  created_by_id: number;
  channel_type?: 'text' | 'voice' | 'stage';
};

type StageState = {
  speakers: number[];
  listeners: number[];
  raised_hands: number[];
  host_id: number | null;
};

type SharedChallenge = {
  id: number;
  title: string;
  description: string;
  participants: number;
  progress: number;
  href: string;
};

type SharedStory = {
  id: number;
  title: string;
  subtitle: string;
  words: number;
  href: string;
};

type SharedMedia = { id: number; url: string; post_id: number };

function avatarSrc(f: { name: string; avatar?: string | null }) {
  if (f.avatar) return mediaUrl(f.avatar);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(f.name)}&background=a0563b&color=fff&size=96`;
}

function moodEmoji(icon: string) {
  return icon === 'cloud' ? '☁️' : '☀️';
}

function formatMsgTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractStageIds(list: unknown): number[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => (typeof item === 'number' ? item : (item as { id?: number } | null)?.id))
    .filter((id): id is number => typeof id === 'number');
}

function normalizeStageState(data: Partial<StageState> | null | undefined): StageState {
  return {
    // The API sends {id, username, name, avatar} objects in each bucket, not bare IDs.
    speakers: extractStageIds(data?.speakers),
    listeners: extractStageIds(data?.listeners),
    raised_hands: extractStageIds(data?.raised_hands),
    host_id: typeof data?.host_id === 'number' ? data.host_id : null,
  };
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-vault/30 rounded px-0.5 not-italic">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function normalizeMsg(
  m: WsChatMessage | WsRoomMessage | ChatMessage,
): ChatMessage {
  return {
    id: m.id,
    sender_id: m.sender_id,
    sender_name: 'sender_name' in m ? m.sender_name : undefined,
    text: m.text,
    message_type: m.message_type,
    attachment_url: m.attachment_url,
    created_at: m.created_at,
    is_read: 'is_read' in m ? m.is_read : undefined,
    is_pinned: 'is_pinned' in m ? m.is_pinned : undefined,
    reaction_counts: 'reaction_counts' in m ? m.reaction_counts : undefined,
    my_reaction: 'my_reaction' in m ? m.my_reaction : undefined,
    edited_at: 'edited_at' in m ? m.edited_at : undefined,
    is_deleted: 'is_deleted' in m ? m.is_deleted : undefined,
    read_count: 'read_count' in m ? m.read_count : undefined,
    member_count: 'member_count' in m ? m.member_count : undefined,
    expires_at: 'expires_at' in m ? m.expires_at : undefined,
  };
}

function MessageBody({ m, highlightQuery }: { m: ChatMessage; highlightQuery?: string }) {
  const { t } = useLocale();
  if (m.is_deleted) {
    return <span className="italic opacity-60">{t('chat.deletedMessage')}</span>;
  }
  const url = m.attachment_url ? mediaUrl(m.attachment_url) : null;
  if (m.message_type === 'image' && url) {
    return (
      <>
        <Image src={url} alt={t('chat.sharedImageAlt')} width={320} height={240} className="max-w-full rounded-lg mb-1" unoptimized />
        {m.text ? <HighlightedText text={m.text} query={highlightQuery || ''} /> : null}
      </>
    );
  }
  if (m.message_type === 'voice' && url) {
    return (
      <>
        <audio controls src={url} className="max-w-full mb-1" />
        {m.text ? <HighlightedText text={m.text} query={highlightQuery || ''} /> : null}
      </>
    );
  }
  if (m.message_type === 'file' && url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
        {m.text ? <HighlightedText text={m.text} query={highlightQuery || ''} /> : t('chat.downloadFile')}
      </a>
    );
  }
  return <HighlightedText text={m.text} query={highlightQuery || ''} />;
}

function CosmicChatPageContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const meUser = useAuthUser();
  const meId = meUser?.id ?? 0;
  const confirm = useConfirm();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [me, setMe] = useState<Friend | null>(null);
  const [memberPickerMode, setMemberPickerMode] = useState<'create' | 'invite' | null>(null);
  const [search, setSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearchResults, setMessageSearchResults] = useState<ChatMessage[] | null>(null);
  const [messageSearchLoading, setMessageSearchLoading] = useState(false);
  const [activePeer, setActivePeer] = useState<Friend | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [vanishTick, setVanishTick] = useState(0);
  const hasVanishingMessages = messages.some((m) => !!m.expires_at);
  useEffect(() => {
    if (!hasVanishingMessages) return;
    const id = setInterval(() => setVanishTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [hasVanishingMessages]);
  const visibleMessages = useMemo(() => {
    void vanishTick;
    const now = Date.now();
    return messages.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
  }, [messages, vanishTick]);

  const threadDisplayMessages = useMemo(() => {
    const q = messageSearch.trim();
    if (!q) return visibleMessages;
    if (messageSearchResults !== null) return messageSearchResults;
    const lower = q.toLowerCase();
    return visibleMessages.filter((m) => !m.is_deleted && m.text.toLowerCase().includes(lower));
  }, [messageSearch, visibleMessages, messageSearchResults]);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [swipeState, setSwipeState] = useState<{ id: number; dx: number } | null>(null);
  const swipeStartRef = useRef<{ id: number; x: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [moodMenuOpen, setMoodMenuOpen] = useState(false);
  const [reactionBursts, setReactionBursts] = useState<ReactionBurstState[]>([]);
  const [vanishSeconds, setVanishSeconds] = useState<number | null>(null);
  const [vanishMenuOpen, setVanishMenuOpen] = useState(false);
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessageEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [challenges, setChallenges] = useState<SharedChallenge[]>([]);
  const [stories, setStories] = useState<SharedStory[]>([]);
  const [media, setMedia] = useState<SharedMedia[]>([]);
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [wsChatLive, setWsChatLive] = useState(false);
  const [wsSignalLive, setWsSignalLive] = useState(false);
  const [viewMode, setViewMode] = useState<'dm' | 'room'>('dm');
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [requestConversations, setRequestConversations] = useState<ConversationSummary[]>([]);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [activeRoomName, setActiveRoomName] = useState('');
  const [stageState, setStageState] = useState<StageState | null>(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [stageActionPending, setStageActionPending] = useState<string | null>(null);
  const [promptRooms, setPromptRooms] = useState<PromptRoom[]>([]);
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);
  const [activePromptRoom, setActivePromptRoom] = useState<PromptRoom | null>(null);
  const [roomRecap, setRoomRecap] = useState<RoomRecap | null>(null);
  const [roomRecapLoading, setRoomRecapLoading] = useState(false);
  const [archivedConversationIds, setArchivedConversationIds] = useState<number[]>([]);
  const [mutedConversationIds, setMutedConversationIds] = useState<number[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const seenMsgIds = useRef<Set<number>>(new Set());
  const autoJoinedStageRoomRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const threadScheduledMessages = useMemo(() => {
    if (viewMode === 'room' && activeRoomId) {
      return scheduledMessages.filter((s) => s.room === activeRoomId);
    }
    if (viewMode === 'dm' && conversationId) {
      return scheduledMessages.filter((s) => s.conversation === conversationId);
    }
    return [];
  }, [scheduledMessages, viewMode, activeRoomId, conversationId]);

  const meBarName = me?.name || meUser?.username || 'Cosmic Explorer';
  const meAvatar = me?.avatar ?? meUser?.avatar ?? null;

  const appendMessage = useCallback((msg: WsChatMessage | WsRoomMessage | ChatMessage) => {
    const n = normalizeMsg(msg);
    if (seenMsgIds.current.has(n.id)) return;
    seenMsgIds.current.add(n.id);
    setMessages((prev) => [...prev, n]);
  }, []);

  const markMessageRead = useCallback((messageId: number) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, is_read: true } : message,
      ),
    );
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(''), 2800);
  }, []);

  const spawnReactionBurst = useCallback((emoji: string, clientX: number, clientY: number) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setReactionBursts((prev) => [
      ...prev,
      { id, emoji, x: clientX - rect.left, y: clientY - rect.top },
    ]);
  }, []);

  const clearReactionBurst = useCallback((id: number) => {
    setReactionBursts((prev) => prev.filter((burst) => burst.id !== id));
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const syncConversationPrefs = useCallback((rows: ConversationSummary[]) => {
    setArchivedConversationIds(rows.filter((row) => row.is_archived).map((row) => row.id));
    setMutedConversationIds(rows.filter((row) => row.is_muted).map((row) => row.id));
  }, []);

  const rtcSignalRef = useRef<(p: SignalPayload) => void>(() => {});
  const groupCallSignalRef = useRef<(p: SignalPayload) => void>(() => {});

  const onSignal = useCallback((payload: SignalPayload) => {
    if (payload.type === 'presence.update') {
      const uid = payload.user_id as number;
      setFriends((prev) =>
        prev.map((f) =>
          f.id === uid
            ? {
                ...f,
                is_online: !!payload.is_online,
                status_message: (payload.status_message as string) || f.status_message,
                mood_icon: (payload.mood_icon as string) || f.mood_icon,
              }
            : f,
        ),
      );
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.peer?.id === uid
            ? {
                ...conversation,
                peer: {
                  ...conversation.peer,
                  is_online: !!payload.is_online,
                  status_message:
                    (payload.status_message as string) || conversation.peer.status_message,
                  mood_icon: (payload.mood_icon as string) || conversation.peer.mood_icon,
                },
              }
            : conversation,
        ),
      );
      setActivePeer((p) =>
        p && p.id === uid
          ? {
              ...p,
              is_online: !!payload.is_online,
              status_message: (payload.status_message as string) || p.status_message,
              mood_icon: (payload.mood_icon as string) || p.mood_icon,
            }
          : p,
      );
      return;
    }
    if (payload.type === 'stage.update') {
      if (payload.room_id === activeRoomId) {
        setStageState(normalizeStageState(payload as Partial<StageState>));
      }
      return;
    }
    if (String(payload.type).startsWith('call.room.')) {
      void groupCallSignalRef.current(payload);
      return;
    }
    void rtcSignalRef.current(payload);
  }, [activeRoomId, showToast]);

  const { connected: signalConnected, sendSignal, joinRoom, leaveRoom } =
    useSignalWebSocket({
      enabled: meId > 0,
      onSignal,
    });

  const {
    callActive,
    incoming,
    callKind,
    muted,
    localVideoRef,
    remoteVideoRef,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    handleSignal: callHandleSignal,
    toggleMute,
  } = useWebRTCCall(meId, sendSignal, () => showToast(t('chat.callEnded')));

  const {
    active: groupCallActive,
    callKind: groupCallKind,
    muted: groupCallMuted,
    peers: groupCallPeers,
    localVideoRef: groupCallLocalVideoRef,
    joinGroupCall,
    leaveGroupCall,
    toggleMute: toggleGroupCallMute,
    handleGroupSignal,
  } = useGroupCall(meId, meBarName, sendSignal);

  const groupCallActiveRef = useRef(groupCallActive);
  const leaveGroupCallRef = useRef(leaveGroupCall);
  useEffect(() => {
    groupCallActiveRef.current = groupCallActive;
    leaveGroupCallRef.current = leaveGroupCall;
  }, [groupCallActive, leaveGroupCall]);

  useEffect(() => {
    rtcSignalRef.current = (p) => {
      void callHandleSignal(p);
    };
  }, [callHandleSignal]);

  useEffect(() => {
    groupCallSignalRef.current = (p) => {
      void handleGroupSignal(p);
    };
  }, [handleGroupSignal]);

  useEffect(() => {
    setWsSignalLive(signalConnected);
  }, [signalConnected]);

  const handleMessageEdited = useCallback((msg: { id: number; text: string; edited_at?: string | null }) => {
    setMessages((prev) => prev.map((row) => (row.id === msg.id ? { ...row, text: msg.text, edited_at: msg.edited_at } : row)));
  }, []);

  const handleMessageDeleted = useCallback((messageId: number) => {
    setMessages((prev) => prev.map((row) => (row.id === messageId ? { ...row, is_deleted: true, text: '' } : row)));
  }, []);

  const {
    connected: chatConnected,
    sendMessage: wsSendMessage,
    sendTyping,
    uploadFile,
  } = useChatWebSocket({
    conversationId: viewMode === 'dm' ? conversationId : null,
    onMessage: appendMessage,
    onTyping: (uid, isTyping) => {
      if (viewMode === 'dm' && activePeer && uid === activePeer.id) {
        setPeerTyping(isTyping);
      }
    },
    onReadReceipt: markMessageRead,
    onEdited: handleMessageEdited,
    onDeleted: handleMessageDeleted,
  });

  const {
    connected: roomConnected,
    sendMessage: wsRoomSend,
    sendTyping: roomSendTyping,
    uploadFile: roomUploadFile,
  } = useRoomWebSocket({
    roomId: viewMode === 'room' ? activeRoomId : null,
    onMessage: appendMessage,
    onTyping: (uid, isTyping) => {
      if (viewMode === 'room' && uid !== meId) setPeerTyping(isTyping);
    },
    onEdited: handleMessageEdited,
    onDeleted: handleMessageDeleted,
    onError: (error) => {
      if (error === 'expired') showToast(t('chat.roomExpired'));
      else if (error === 'slowmode') showToast(t('chat.slowmodeActive'));
      else showToast(t('chat.sendMessageFailed'));
    },
  });

  useEffect(() => {
    const live = viewMode === 'dm' ? chatConnected : roomConnected;
    setWsChatLive(live);
  }, [chatConnected, roomConnected, viewMode]);

  useEffect(() => {
    if (viewMode === 'room' && activeRoomId && signalConnected) {
      joinRoom(activeRoomId);
      return () => {
        leaveRoom(activeRoomId);
      };
    }
  }, [viewMode, activeRoomId, signalConnected, joinRoom, leaveRoom]);

  // Independent of signal-socket state: hang up any active group call the
  // moment the user navigates away from the room it belongs to.
  useEffect(() => {
    return () => {
      if (groupCallActiveRef.current) leaveGroupCallRef.current();
    };
  }, [viewMode, activeRoomId]);

  const loadFriends = useCallback(async () => {
    try {
      const res = await apiFetch('chat/friends/');
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
        if (data.me) setMe(data.me);
      }
    } catch {
      showToast(t('chat.loadFriendsFailed'));
    }
  }, [showToast]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch('chat/conversations/?type=primary');
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        setConversations(rows);
        syncConversationPrefs(rows);
      }
    } catch {
      showToast(t('chat.loadConversationsFailed'));
    }
  }, [syncConversationPrefs, showToast]);

  const loadRequests = useCallback(async () => {
    try {
      const res = await apiFetch('chat/conversations/?type=requests');
      if (res.ok) {
        const data = await res.json();
        setRequestConversations(Array.isArray(data) ? data : []);
      }
    } catch {
      showToast(t('chat.loadRequestsFailed'));
    }
  }, [showToast]);

  const loadScheduled = useCallback(async () => {
    try {
      const res = await apiFetch('chat/scheduled/');
      if (res.ok) {
        const data = await res.json();
        setScheduledMessages(Array.isArray(data) ? data : []);
      }
    } catch {
      showToast(t('chat.loadScheduledFailed'));
    }
  }, [showToast]);

  const scheduleMessage = useCallback(
    async (text: string, sendAt: string) => {
      if (!text.trim() || !sendAt) return;
      const isoSendAt = new Date(sendAt).toISOString();
      const path =
        viewMode === 'room' && activeRoomId
          ? `chat/rooms/${activeRoomId}/schedule/`
          : viewMode === 'dm' && conversationId
            ? `chat/conversations/${conversationId}/schedule/`
            : null;
      if (!path) return;
      const res = await apiFetchJson(path, {
        method: 'POST',
        json: { text: text.trim(), send_at: isoSendAt },
      });
      if (res.ok) {
        showToast(t('chat.messageScheduled'));
        setDraft('');
        setScheduleDraft('');
        setScheduleMenuOpen(false);
        await loadScheduled();
      } else {
        showToast(t('chat.scheduleFailed'));
      }
    },
    [viewMode, activeRoomId, conversationId, showToast, loadScheduled],
  );

  const cancelScheduled = useCallback(
    async (id: number) => {
      const res = await apiFetch(`chat/scheduled/${id}/`, { method: 'DELETE' });
      if (res.ok) {
        setScheduledMessages((prev) => prev.filter((s) => s.id !== id));
      }
    },
    [],
  );

  const acceptRequest = useCallback(
    async (conversation: ConversationSummary) => {
      try {
        const res = await apiFetch(`chat/conversations/${conversation.id}/accept/`, { method: 'POST' });
        if (res.ok) {
          setRequestConversations((prev) => prev.filter((c) => c.id !== conversation.id));
          setConversations((prev) => (prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]));
        }
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const loadShared = useCallback(async () => {
    try {
      const res = await apiFetch('chat/shared_space/');
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges || []);
        setStories(data.stories || []);
        setMedia(data.media || []);
      }
    } catch {
      showToast(t('chat.loadSharedSpaceFailed'));
    }
  }, [showToast]);

  const loadRooms = useCallback(async () => {
    try {
      const res = await apiFetch('chat/rooms/');
      if (res.ok) {
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
      }
    } catch {
      showToast(t('chat.loadRoomsFailed'));
    }
  }, [showToast]);

  const loadPromptRooms = useCallback(async () => {
    const list = await fetchPromptRooms();
    setPromptRooms(list);
  }, []);

  useEffect(() => {
    if (searchParams.get('tab') === 'prompt') {
      void loadPromptRooms();
    }
  }, [searchParams, loadPromptRooms]);

  const openRoom = useCallback(
    async (room: ChatRoom, promptMeta?: PromptRoom | null) => {
      setViewMode('room');
      setActivePeer(null);
      setConversationId(null);
      setActiveRoomId(room.id);
      setActiveRoomName(room.name);
      setActivePromptRoom(promptMeta ?? null);
      setPeerTyping(false);
      setMessageSearch('');
      setMessageSearchOpen(false);
      setMessageSearchResults(null);
      try {
        const res = await apiFetch(`chat/rooms/${room.id}/messages/`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.messages || []).map(normalizeMsg);
          seenMsgIds.current = new Set(list.map((m: ChatMessage) => m.id));
          setMessages(list);
        }
      } catch {
        showToast(t('chat.loadRoomFailed'));
      }
    },
    [showToast],
  );

  const openPromptRoom = useCallback(
    async (pr: PromptRoom) => {
      let roomMeta = pr;
      if (pr.question) {
        const joined = await createOrJoinPromptRoom(pr.question);
        if (!joined) {
          showToast(t('chat.joinPromptRoomFailed'));
          return;
        }
        roomMeta = joined;
      }
      await openRoom(
        {
          id: roomMeta.id,
          name: roomMeta.question_text || roomMeta.name,
          member_count: roomMeta.member_count,
          members: [],
          created_by_id: roomMeta.created_by_id,
        },
        roomMeta,
      );
    },
    [openRoom, showToast],
  );

  const startPromptRoom = useCallback(async (q: InspirationQuestion) => {
    setPromptPickerOpen(false);
    const room = await createOrJoinPromptRoom(q.id);
    if (!room) {
      showToast(t('chat.openPromptRoomFailed'));
      return;
    }
    await loadPromptRooms();
    await openPromptRoom(room);
  }, [loadPromptRooms, openPromptRoom, showToast]);

  const togglePinMessage = useCallback(async (m: ChatMessage) => {
    const path = viewMode === 'room'
      ? `chat/room-messages/${m.id}/pin/`
      : `chat/messages/${m.id}/pin/`;
    try {
      const res = await apiFetchJson(path, { method: 'POST', json: {} });
      if (res.ok) {
        if (viewMode === 'room' && activeRoomId) {
          const r = await apiFetch(`chat/rooms/${activeRoomId}/messages/`);
          if (r.ok) {
            const data = await r.json();
            setMessages((data.messages || []).map(normalizeMsg));
          }
        } else if (conversationId) {
          const r = await apiFetch(`chat/conversations/${conversationId}/messages/`);
          if (r.ok) {
            const data = await r.json();
            setMessages((data.messages || []).map(normalizeMsg));
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [viewMode, activeRoomId, conversationId]);

  const refreshMessages = useCallback(async () => {
    if (viewMode === 'room' && activeRoomId) {
      const r = await apiFetch(`chat/rooms/${activeRoomId}/messages/`);
      if (r.ok) {
        const data = await r.json();
        setMessages((data.messages || []).map(normalizeMsg));
      }
    } else if (conversationId) {
      const r = await apiFetch(`chat/conversations/${conversationId}/messages/`);
      if (r.ok) {
        const data = await r.json();
        setMessages((data.messages || []).map(normalizeMsg));
      }
    }
  }, [viewMode, activeRoomId, conversationId]);

  const saveMessageEdit = useCallback(
    async (m: ChatMessage, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const path = viewMode === 'room' ? `chat/room-messages/${m.id}/` : `chat/messages/${m.id}/`;
      try {
        const res = await apiFetchJson(path, { method: 'PATCH', json: { text: trimmed } });
        if (res.ok) {
          await refreshMessages();
        } else {
          showToast(t('chat.editMessageFailed'));
        }
      } catch {
        showToast(t('chat.editMessageFailed'));
      }
    },
    [viewMode, refreshMessages, showToast],
  );

  const deleteMessage = useCallback(
    async (m: ChatMessage) => {
      if (!(await confirm(t('chat.confirmDeleteMessage'), { danger: true, confirmLabel: t('chat.delete') }))) return;
      const path = viewMode === 'room' ? `chat/room-messages/${m.id}/` : `chat/messages/${m.id}/`;
      try {
        const res = await apiFetch(path, { method: 'DELETE' });
        if (res.ok) {
          setMessages((prev) => prev.map((row) => (row.id === m.id ? { ...row, is_deleted: true, text: '' } : row)));
        } else {
          showToast(t('chat.deleteMessageFailed'));
        }
      } catch {
        showToast(t('chat.deleteMessageFailed'));
      }
    },
    [viewMode, showToast, confirm],
  );

  const reactToMessage = useCallback(async (m: ChatMessage, emoji: string) => {
    const path = viewMode === 'room'
      ? `chat/room-messages/${m.id}/react/`
      : `chat/messages/${m.id}/react/`;
    const next = m.my_reaction === emoji ? null : emoji;
    try {
      const res = await apiFetchJson(path, { method: 'POST', json: { emoji: next } });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((row) => (
          row.id === m.id
            ? { ...row, my_reaction: data.my_reaction, reaction_counts: data.reaction_counts }
            : row
        )));
      }
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const sendMoodStamp = useCallback(async (moodKey: 'sun' | 'cloud', e: React.MouseEvent) => {
    spawnReactionBurst(moodEmoji(moodKey), e.clientX, e.clientY);
    setMoodMenuOpen(false);
    try {
      const res = await apiFetchJson('chat/presence/', { method: 'POST', json: { mood_icon: moodKey } });
      if (res.ok) {
        const data = await res.json();
        setMe((prev) => (prev ? { ...prev, mood_icon: data.mood_icon } : prev));
      }
    } catch {
      /* ignore */
    }
  }, [spawnReactionBurst]);

  const createRoom = useCallback(async (memberIds: number[], name: string) => {
    if (!name.trim()) return;
    try {
      const res = await apiFetch('chat/rooms/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), member_ids: memberIds }),
      });
      if (res.ok) {
        const room = await res.json();
        await loadRooms();
        openRoom(room);
      }
    } catch {
      showToast(t('chat.createRoomFailed'));
    }
  }, [loadRooms, openRoom, showToast]);

  const openChat = useCallback(
    async (peer: Friend) => {
      setViewMode('dm');
      setActiveRoomId(null);
      setActivePromptRoom(null);
      setActivePeer(peer);
      setMessageSearch('');
      setMessageSearchOpen(false);
      setMessageSearchResults(null);
      try {
        const startRes = await apiFetch('chat/conversations/start/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ peer_id: peer.id }),
        });
        if (!startRes.ok) throw new Error('start failed');
        const conv = await startRes.json();
        const cid = conv.id as number;
        setConversationId(cid);
        const msgRes = await apiFetch(`chat/conversations/${cid}/messages/`);
        if (msgRes.ok) {
          const data = await msgRes.json();
          const list = (data.messages || []).map(normalizeMsg);
          seenMsgIds.current = new Set(list.map((m: ChatMessage) => m.id));
          setMessages(list);
          if (data.peer) setActivePeer(data.peer);
        }
        await loadConversations();
      } catch {
        showToast(t('chat.loadConversationFailed'));
      }
    },
    [loadConversations, showToast],
  );

  useEffect(() => {
    void loadFriends();
    void loadRooms();
    void loadConversations();
    void loadRequests();
    void loadPromptRooms();
    void loadScheduled();
  }, [loadFriends, loadRooms, loadConversations, loadRequests, loadPromptRooms, loadScheduled]);

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (!roomParam) return;
    const rid = Number(roomParam);
    if (!Number.isFinite(rid)) return;
    if (viewMode === 'room' && activeRoomId === rid) return;
    const room = rooms.find((r) => r.id === rid);
    if (room) {
      void openRoom(room);
      return;
    }
    const pr = promptRooms.find((r) => r.id === rid);
    if (pr) void openPromptRoom(pr);
  }, [searchParams, rooms, promptRooms, viewMode, activeRoomId, openRoom, openPromptRoom]);

  useEffect(() => {
    void loadShared();
  }, [loadShared]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [threadDisplayMessages]);

  useEffect(() => {
    const q = messageSearch.trim();
    if (!q) {
      setMessageSearchResults(null);
      setMessageSearchLoading(false);
      return;
    }
    if (viewMode === 'dm' && !conversationId) return;
    if (viewMode === 'room' && !activeRoomId) return;

    const timer = setTimeout(async () => {
      setMessageSearchLoading(true);
      try {
        if (viewMode === 'dm' && conversationId) {
          const res = await apiFetch(
            `chat/conversations/${conversationId}/messages/?q=${encodeURIComponent(q)}`,
          );
          if (res.ok) {
            const data = await res.json();
            setMessageSearchResults((data.messages || []).map(normalizeMsg));
          }
        } else if (viewMode === 'room') {
          const lower = q.toLowerCase();
          setMessageSearchResults(
            visibleMessages.filter((m) => !m.is_deleted && m.text.toLowerCase().includes(lower)),
          );
        }
      } catch {
        /* ignore */
      } finally {
        setMessageSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [messageSearch, conversationId, activeRoomId, viewMode, visibleMessages]);

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q) ||
        f.status_message.toLowerCase().includes(q),
    );
  }, [friends, search]);

  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => !archivedConversationIds.includes(conversation.id)),
    [archivedConversationIds, conversations],
  );

  const activeRoom = useMemo(
    () => rooms.find((room) => room.id === activeRoomId) || null,
    [activeRoomId, rooms],
  );
  const isStageLikeRoom =
    viewMode === 'room' &&
    !!activeRoom &&
    (activeRoom.channel_type === 'voice' || activeRoom.channel_type === 'stage');
  const myStageRole = stageState?.speakers.includes(meId)
    ? 'speaker'
    : stageState?.listeners.includes(meId)
      ? 'listener'
      : 'none';
  const myHandRaised = !!stageState?.raised_hands.includes(meId);

  const stageMemberName = useCallback(
    (userId: number) => {
      if (userId === meId) return `${meBarName} (you)`;
      const member = activeRoom?.members.find((row) => row.id === userId);
      return member?.name || member?.username || `User ${userId}`;
    },
    [activeRoom?.members, meBarName, meId],
  );

  useEffect(() => {
    if (!activePromptRoom?.is_expired) {
      setRoomRecap(null);
      return;
    }
    let cancelled = false;
    setRoomRecapLoading(true);
    void fetchRoomRecap(activePromptRoom.id).then((recap) => {
      if (!cancelled) {
        setRoomRecap(recap);
        setRoomRecapLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activePromptRoom]);

  const fetchStageState = useCallback(
    async (silent = false) => {
      if (!activeRoomId || !isStageLikeRoom) return;
      if (!silent) setStageLoading(true);
      try {
        const res = await apiFetch(`chat/rooms/${activeRoomId}/stage/`);
        if (res.ok) {
          setStageState(normalizeStageState(await res.json()));
        } else if (!silent) {
          showToast(t('chat.loadStageFailed'));
        }
      } catch {
        if (!silent) showToast(t('chat.loadStageFailed'));
      } finally {
        if (!silent) setStageLoading(false);
      }
    },
    [activeRoomId, isStageLikeRoom, showToast],
  );

  useEffect(() => {
    if (!activeRoomId || !isStageLikeRoom) {
      setStageState(null);
      autoJoinedStageRoomRef.current = null;
      return;
    }
    void fetchStageState();
    const id = setInterval(() => void fetchStageState(true), 5000);
    return () => clearInterval(id);
  }, [activeRoomId, fetchStageState, isStageLikeRoom]);

  useEffect(() => {
    if (!activeRoomId || !stageState?.speakers.includes(meId) || groupCallActive) return;
    if (autoJoinedStageRoomRef.current === activeRoomId) return;
    autoJoinedStageRoomRef.current = activeRoomId;
    showToast(t('chat.autoJoinStageAudio'));
    void handleGroupCall('audio');
  }, [activeRoomId, groupCallActive, meId, showToast, stageState?.speakers]);

  function insertEmoji(emoji: string) {
    setDraft((prev) => `${prev}${emoji}`);
    setEmojiOpen(false);
  }

  function buildReplyQuote(target: ChatMessage) {
    const senderLabel = target.sender_id === meId ? 'yourself' : target.sender_name || activePeer?.name || 'them';
    const snippet = target.text.length > 80 ? `${target.text.slice(0, 80)}…` : target.text;
    return `↪ Replying to ${senderLabel}: "${snippet}"\n`;
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    const text = replyingTo ? `${buildReplyQuote(replyingTo)}${trimmed}` : trimmed;
    if (viewMode === 'dm' && (!activePeer || !conversationId)) return;
    if (viewMode === 'room' && !activeRoomId) return;
    setSending(true);
    const typingFn = viewMode === 'room' ? roomSendTyping : sendTyping;
    void typingFn(false);
    try {
      const sent = viewMode === 'room' ? wsRoomSend(text, vanishSeconds) : wsSendMessage(text, vanishSeconds);
      if (sent) {
        setDraft('');
        setReplyingTo(null);
      } else if (viewMode === 'dm' && conversationId) {
        const res = await apiFetch(`chat/conversations/${conversationId}/messages/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, expires_in_seconds: vanishSeconds || undefined }),
        });
        if (res.ok) {
          appendMessage(await res.json());
          setDraft('');
          setReplyingTo(null);
        } else {
          showToast(t('chat.sendMessageFailed'));
        }
      } else if (viewMode === 'room' && activeRoomId) {
        const res = await apiFetch(`chat/rooms/${activeRoomId}/messages/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, expires_in_seconds: vanishSeconds || undefined }),
        });
        if (res.ok) {
          appendMessage(await res.json());
          setDraft('');
          setReplyingTo(null);
        } else {
          showToast(t('chat.sendMessageFailed'));
        }
      }
      await loadConversations();
      await loadRequests();
      await loadRooms();
    } catch {
      showToast(t('chat.sendMessageFailed'));
    } finally {
      setSending(false);
    }
  }

  function handleBubbleTouchStart(m: ChatMessage, e: React.TouchEvent) {
    swipeStartRef.current = { id: m.id, x: e.touches[0].clientX };
    setSwipeState({ id: m.id, dx: 0 });
  }

  function handleBubbleTouchMove(m: ChatMessage, e: React.TouchEvent) {
    if (!swipeStartRef.current || swipeStartRef.current.id !== m.id) return;
    const dx = e.touches[0].clientX - swipeStartRef.current.x;
    const clamped = Math.max(-90, Math.min(90, dx));
    setSwipeState({ id: m.id, dx: clamped });
  }

  function handleBubbleTouchEnd(m: ChatMessage) {
    const dx = swipeState?.id === m.id ? swipeState.dx : 0;
    swipeStartRef.current = null;
    setSwipeState(null);
    if (m.is_deleted) return;
    if (dx <= -SWIPE_TRIGGER_PX) {
      setReplyingTo(m);
    } else if (dx >= SWIPE_TRIGGER_PX) {
      void togglePinMessage(m);
    }
  }

  async function handleFilePick(file: File) {
    if (viewMode === 'dm' && !conversationId) return;
    if (viewMode === 'room' && !activeRoomId) return;
    setSending(true);
    setUploadProgress({ loaded: 0, total: file.size, percent: 0 });
    try {
      const msg =
        viewMode === 'room'
          ? await roomUploadFile(file, undefined, setUploadProgress)
          : await uploadFile(file, undefined, setUploadProgress);
      if (msg) appendMessage(msg);
      else showToast(t('chat.uploadFailed'));
    } catch {
      showToast(t('chat.uploadFailed'));
    } finally {
      setSending(false);
      setTimeout(() => setUploadProgress(null), 1200);
    }
  }

  async function handleVoiceCall() {
    if (viewMode !== 'dm' || !activePeer) {
      showToast(t('chat.selectFriendForCall'));
      return;
    }
    try {
      await startCall(activePeer.id, 'audio', meBarName, meAvatar);
    } catch {
      showToast(t('chat.micPermissionNeeded'));
    }
  }

  async function handleVideoCall() {
    if (!activePeer) return;
    try {
      await startCall(activePeer.id, 'video', meBarName, meAvatar);
    } catch {
      showToast(t('chat.cameraPermissionNeeded'));
    }
  }

  async function handleGroupCall(kind: 'audio' | 'video') {
    if (viewMode !== 'room' || !activeRoomId) return;
    try {
      await joinGroupCall(activeRoomId, kind);
    } catch {
      showToast(kind === 'video' ? 'Allow camera & microphone to video call' : 'Allow microphone access to call');
    }
  }

  async function sendStageAction(action: 'join' | 'leave' | 'raise_hand' | 'speak') {
    if (!activeRoomId || !isStageLikeRoom) return;
    setStageActionPending(action);
    try {
      const res = await apiFetchJson(`chat/rooms/${activeRoomId}/stage/`, {
        method: 'POST',
        json: { action },
      });
      if (res.ok) {
        const next = normalizeStageState(await res.json());
        setStageState(next);
        if (action === 'speak' && next.speakers.includes(meId) && !groupCallActive) {
          await handleGroupCall('audio');
        }
      } else {
        showToast(t('chat.stageActionFailed'));
      }
    } catch {
      showToast(t('chat.stageActionFailed'));
    } finally {
      setStageActionPending(null);
    }
  }

  function renameRoom() {
    if (!activeRoomId || !activeRoom) return;
    setRenameDraft(activeRoom.name);
    setRenameOpen(true);
  }

  async function submitRename() {
    const name = renameDraft.trim();
    if (!activeRoomId || !name) return;
    const res = await apiFetchJson(`chat/rooms/${activeRoomId}/`, {
      method: 'PATCH',
      json: { name },
    });
    if (res.ok) {
      await loadRooms();
      setActiveRoomName(name);
      showToast(t('chat.roomRenamed'));
    } else {
      showToast(t('chat.renameRoomFailed'));
    }
    setRenameOpen(false);
  }

  async function inviteMembers(memberIds: number[]) {
    if (!activeRoomId || memberIds.length === 0) return;
    const res = await apiFetchJson(`chat/rooms/${activeRoomId}/members/`, {
      method: 'POST',
      json: { member_ids: memberIds },
    });
    if (res.ok) {
      await loadRooms();
      showToast(t('chat.membersInvited'));
    } else {
      showToast(t('chat.inviteMembersFailed'));
    }
  }

  async function removeMember(memberId: number) {
    if (!activeRoomId) return;
    const res = await apiFetchJson(`chat/rooms/${activeRoomId}/members/`, {
      method: 'DELETE',
      json: { member_id: memberId },
    });
    if (res.ok) {
      await loadRooms();
      showToast(t('chat.memberRemoved'));
    } else {
      showToast(t('chat.removeMemberFailed'));
    }
  }

  async function leaveActiveRoom() {
    if (!activeRoomId) return;
    const res = await apiFetchJson(`chat/rooms/${activeRoomId}/leave/`, { method: 'POST' });
    if (res.ok) {
      setActiveRoomId(null);
      setActiveRoomName('');
      setMessages([]);
      await loadRooms();
      showToast(t('chat.leftRoom'));
    } else {
      showToast(t('chat.leaveRoomFailed'));
    }
  }

  async function toggleArchiveConversation() {
    if (!conversationId) return;
    const wasArchived = archivedConversationIds.includes(conversationId);
    const nextArchived = !wasArchived;
    const next = nextArchived
      ? [...archivedConversationIds, conversationId]
      : archivedConversationIds.filter((id) => id !== conversationId);
    setArchivedConversationIds(next);
    setConversations((prev) =>
      prev.map((row) => (row.id === conversationId ? { ...row, is_archived: nextArchived } : row)),
    );
    const res = await apiFetch(`chat/conversations/${conversationId}/state/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_archived: nextArchived }),
    });
    if (!res.ok) {
      setArchivedConversationIds(archivedConversationIds);
      showToast(t('chat.archiveStateFailed'));
      return;
    }
    showToast(nextArchived ? 'Conversation archived' : 'Conversation restored');
  }

  async function toggleMuteConversation() {
    if (!conversationId) return;
    const wasMuted = mutedConversationIds.includes(conversationId);
    const nextMuted = !wasMuted;
    const next = nextMuted
      ? [...mutedConversationIds, conversationId]
      : mutedConversationIds.filter((id) => id !== conversationId);
    setMutedConversationIds(next);
    setConversations((prev) =>
      prev.map((row) => (row.id === conversationId ? { ...row, is_muted: nextMuted } : row)),
    );
    const res = await apiFetch(`chat/conversations/${conversationId}/state/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_muted: nextMuted }),
    });
    if (!res.ok) {
      setMutedConversationIds(mutedConversationIds);
      showToast(t('chat.muteStateFailed'));
      return;
    }
    showToast(nextMuted ? 'Conversation muted' : 'Conversation unmuted');
  }

  const mobileThreadOpen = (viewMode === 'dm' && !!activePeer) || (viewMode === 'room' && !!activeRoomId);

  function closeActiveChat() {
    setActivePeer(null);
    setConversationId(null);
    setActiveRoomId(null);
    setActiveRoomName('');
    setActivePromptRoom(null);
    setMessageSearch('');
    setMessageSearchOpen(false);
    setMessageSearchResults(null);
  }

  return (
    <div className="cosmic-chat-root">
      <header className="cosmic-chat-header">
        <h1 className="cosmic-chat-title">{t('chat.title')}</h1>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--cc-text-2)' }}>
          <span
            className={`cosmic-chat-live-dot${
              wsSignalLive &&
              (viewMode === 'room' ? !activeRoomId || wsChatLive : !conversationId || wsChatLive)
                ? ''
                : ' cosmic-chat-live-dot--off'
            }`}
          />
          <span className="hidden sm:inline">
            {wsSignalLive &&
            (viewMode === 'room' ? !activeRoomId || wsChatLive : !conversationId || wsChatLive)
              ? 'Live'
              : 'Offline'}
          </span>
        </div>
      </header>

      <div className="cosmic-chat-grid" data-mobile-view={mobileThreadOpen ? 'thread' : 'list'}>
        <aside className="cosmic-chat-col cosmic-chat-col--list">
          <div className="cosmic-chat-col-head">{t('chat.friends')}</div>
          <div className="relative px-1 shrink-0">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--cc-text-2)]" />
            <input
              className="cosmic-chat-search"
              placeholder={t('chat.searchFriends')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="cosmic-chat-col-scroll">
          {requestConversations.length > 0 && (
            <div className="px-2 pt-2">
              <button
                type="button"
                onClick={() => setRequestsOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold"
                style={{ background: 'var(--cc-panel)', color: 'var(--cc-text-2)' }}
              >
                <span>
                  {t('chat.requests')} ({requestConversations.length})
                </span>
                <span>{requestsOpen ? '▲' : '▼'}</span>
              </button>
              {requestsOpen && (
                <div className="mt-1 space-y-1">
                  {requestConversations.map((conversation) => (
                    <div key={conversation.id} className="cosmic-chat-friend items-center">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => conversation.peer && void openChat(conversation.peer)}
                      >
                        <div className="cosmic-chat-friend-avatar">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={avatarSrc({ name: conversation.peer?.name || 'Friend', avatar: conversation.peer?.avatar })} alt="" />
                        </div>
                        <div className="cosmic-chat-friend-meta min-w-0">
                          <div className="name">{conversation.peer?.name || t('chat.unknownUser')}</div>
                          <div className="status truncate">
                            {conversation.last_message?.text || ''}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void acceptRequest(conversation)}
                        className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                        style={{ background: 'var(--cc-accent, #7C3AED)' }}
                      >
                        {t('chat.acceptRequest')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
            {t('chat.conversationsLabel')}
          </p>
          <div className="px-2 space-y-1">
            {visibleConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`cosmic-chat-friend${conversationId === conversation.id ? ' cosmic-chat-friend--active' : ''}`}
                onClick={() => conversation.peer && void openChat(conversation.peer)}
              >
                <div className="cosmic-chat-friend-avatar">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={avatarSrc({ name: conversation.peer?.name || 'Friend', avatar: conversation.peer?.avatar })} alt="" />
                  {conversation.peer?.is_online && <span className="cosmic-chat-online-dot" />}
                </div>
                <div className="cosmic-chat-friend-meta min-w-0">
                  <div className="name">{conversation.peer?.name || t('chat.unknownUser')}</div>
                  <div className="status truncate">
                    {conversation.last_message?.text || t('chat.noMessagesYet')}
                  </div>
                </div>
                {conversation.unread_count > 0 && (
                  <span className="rounded-full bg-vault px-2 py-0.5 text-[10px] text-white">
                    {conversation.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
            {t('chat.promptRooms')}
          </p>
          <div className="px-2 pb-2 flex gap-1">
            <button
              type="button"
              className="text-xs font-semibold px-2 py-1 rounded-lg flex-1 inline-flex items-center justify-center gap-1"
              style={{ background: 'var(--cc-panel)' }}
              onClick={() => setPromptPickerOpen(true)}
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              {t('chat.newPrompt')}
            </button>
          </div>
          {promptRooms.length === 0 ? (
            <p className="text-[10px] px-3 pb-2" style={{ color: 'var(--cc-text-2)' }}>
              {t('chat.startPromptHint')}
            </p>
          ) : (
            promptRooms.map((pr) => (
              <button
                key={pr.id}
                type="button"
                className={`cosmic-chat-friend${viewMode === 'room' && activeRoomId === pr.id ? ' cosmic-chat-friend--active' : ''}`}
                onClick={() => void openPromptRoom(pr)}
              >
                <div className="cosmic-chat-friend-avatar flex items-center justify-center text-lg">✨</div>
                <div className="cosmic-chat-friend-meta min-w-0">
                  <div className="name truncate">{pr.question_text || pr.name}</div>
                  <div className="status">{t('chat.explorersCount', { count: String(pr.member_count) })}</div>
                </div>
              </button>
            ))
          )}
          <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
            {t('chat.groupRooms')}
          </p>
          <div className="px-2 pb-2 flex gap-1">
            <button
              type="button"
              className="text-xs font-semibold px-2 py-1 rounded-lg flex-1"
              style={{ background: 'var(--cc-panel)' }}
              onClick={() => setMemberPickerMode('create')}
            >
              + {t('chat.newRoom')}
            </button>
          </div>
          {rooms.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`cosmic-chat-friend${viewMode === 'room' && activeRoomId === r.id ? ' cosmic-chat-friend--active' : ''}`}
              onClick={() => void openRoom(r)}
            >
              <div className="cosmic-chat-friend-avatar flex items-center justify-center text-lg">👥</div>
              <div className="cosmic-chat-friend-meta hidden sm:block">
                <div className="name">{r.name}</div>
                <div className="status">{t('chat.membersCount', { count: String(r.member_count) })}</div>
              </div>
            </button>
          ))}
          <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
            {t('chat.friendsLabel')}
          </p>
          <div className="pb-2">
            {filteredFriends.length === 0 ? (
              <p className="text-xs text-center py-6 px-2" style={{ color: 'var(--cc-text-2)' }}>
                {t('chat.followToChat')}
              </p>
            ) : (
              filteredFriends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`cosmic-chat-friend${activePeer?.id === f.id ? ' cosmic-chat-friend--active' : ''}`}
                  onClick={() => void openChat(f)}
                >
                  <div className="cosmic-chat-friend-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarSrc(f)} alt="" />
                    {f.is_online && <span className="cosmic-chat-online-dot" />}
                  </div>
                  <div className="cosmic-chat-friend-meta min-w-0">
                    <div className="name">{f.name}</div>
                    <div className="status">{f.status_message}</div>
                  </div>
                  <span className="cosmic-chat-mood-icon">{moodEmoji(f.mood_icon)}</span>
                </button>
              ))
            )}
          </div>
          </div>
          <div className="cosmic-chat-me-bar">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarSrc({ name: meBarName, avatar: me?.avatar })}
              alt=""
              className="w-9 h-9 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1 hidden md:block">
              <div className="text-sm font-semibold truncate">{meBarName}</div>
              <div className="text-xs" style={{ color: 'var(--cc-text-2)' }}>
                Online
              </div>
            </div>
            <Link href="/settings" className="cosmic-chat-icon-btn">
              <Cog6ToothIcon className="h-5 w-5" />
            </Link>
          </div>
        </aside>

        <section className="cosmic-chat-col cosmic-chat-col--thread">
          {(viewMode === 'dm' && activePeer) || (viewMode === 'room' && activeRoomId) ? (
            <>
              <div className="cosmic-chat-chat-head">
                <button
                  type="button"
                  className="cosmic-chat-icon-btn md:hidden"
                  title={t('chat.backToConversations')}
                  onClick={closeActiveChat}
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
                {viewMode === 'dm' && activePeer ? (
                  <div className="cosmic-chat-friend-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarSrc(activePeer)} alt="" className="w-9 h-9 rounded-full" />
                    {activePeer.is_online && <span className="cosmic-chat-online-dot" />}
                  </div>
                ) : (
                  <div className="cosmic-chat-friend-avatar flex items-center justify-center text-lg w-9 h-9">👥</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">
                    {viewMode === 'room' ? activeRoomName : activePeer?.name}
                  </div>
                  <div className="text-xs flex items-center gap-1" style={{ color: 'var(--cc-text-2)' }}>
                    {viewMode === 'room'
                      ? activePromptRoom
                        ? t('chat.promptRoomOrbit')
                        : t('chat.groupRoom')
                      : activePeer?.is_online
                        ? t('chat.online')
                        : t('chat.away')}
                    {viewMode === 'dm' && activePeer && <span>{moodEmoji(activePeer.mood_icon)}</span>}
                  </div>
                </div>
                {viewMode === 'dm' && activePeer && (
                  <>
                    <button type="button" className="cosmic-chat-icon-btn" title={t('chat.voiceCall')} onClick={() => void handleVoiceCall()}>
                      <PhoneIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn hidden sm:inline-flex" title={t('chat.videoCall')} onClick={() => void handleVideoCall()}>
                      <VideoCameraIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title={t('chat.archive')} onClick={toggleArchiveConversation}>
                      <ArchiveBoxIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title={t('chat.muteConversation')} onClick={toggleMuteConversation}>
                      <BellSlashIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
                {viewMode === 'room' && activeRoomId && !groupCallActive && (
                  <>
                    <button type="button" className="cosmic-chat-icon-btn" title={t('chat.voiceCall')} onClick={() => void handleGroupCall('audio')}>
                      <PhoneIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn hidden sm:inline-flex" title={t('chat.videoCall')} onClick={() => void handleGroupCall('video')}>
                      <VideoCameraIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
                {viewMode === 'room' && activeRoom && !activePromptRoom && (
                  <div className="flex items-center gap-1">
                    <button type="button" className="cosmic-chat-icon-btn" title={t('chat.renameRoom')} onClick={() => void renameRoom()}>
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title={t('chat.inviteMembers')} onClick={() => setMemberPickerMode('invite')}>
                      <UserPlusIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title={t('chat.leaveRoom')} onClick={() => void leaveActiveRoom()}>
                      <UserMinusIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="cosmic-chat-icon-btn"
                  title={t('chat.searchInConversation')}
                  aria-pressed={messageSearchOpen}
                  style={messageSearchOpen || messageSearch ? { color: 'var(--cc-brown)' } : undefined}
                  onClick={() => {
                    setMessageSearchOpen((v) => {
                      if (v) {
                        setMessageSearch('');
                        setMessageSearchResults(null);
                      }
                      return !v;
                    });
                  }}
                >
                  <MagnifyingGlassIcon className="h-5 w-5" />
                </button>
              </div>

              {messageSearchOpen && (
                <div className="cosmic-chat-thread-search">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--cc-text-2)]" />
                    <input
                      className="cosmic-chat-search w-full pl-9 pr-8"
                      style={{ margin: 0, width: '100%' }}
                      placeholder={t('chat.searchInConversationPlaceholder')}
                      value={messageSearch}
                      autoFocus
                      onChange={(e) => setMessageSearch(e.target.value)}
                    />
                    {messageSearchLoading ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--cc-text-2)' }}>
                        …
                      </span>
                    ) : messageSearch ? (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-black/10"
                        title={t('chat.clearSearch')}
                        onClick={() => setMessageSearch('')}
                      >
                        <XMarkIcon className="h-4 w-4" style={{ color: 'var(--cc-text-2)' }} />
                      </button>
                    ) : null}
                  </div>
                  {messageSearch.trim() && (
                    <p className="text-[10px] mt-1 px-1" style={{ color: 'var(--cc-text-2)' }}>
                      {threadDisplayMessages.length === 1
                        ? t('chat.matchCount', { count: String(threadDisplayMessages.length) })
                        : t('chat.matchesCount', { count: String(threadDisplayMessages.length) })}
                    </p>
                  )}
                </div>
              )}

              {viewMode === 'room' && activePromptRoom && (
                <div className="px-4 py-2 border-b border-surface text-xs" style={{ color: 'var(--cc-text-2)' }}>
                  <p className="font-medium text-sm" style={{ color: 'var(--cc-text)' }}>
                    {activePromptRoom.question_text}
                  </p>
                  {activePromptRoom.question_category && (
                    <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide" style={{ background: 'var(--cc-panel)' }}>
                      {activePromptRoom.question_category}
                    </span>
                  )}
                </div>
              )}

              {viewMode === 'room' && activePromptRoom?.is_expired && (
                <div className="px-4 py-3 border-b border-surface text-xs" style={{ background: 'var(--cc-panel)' }}>
                  <p className="font-semibold mb-1" style={{ color: 'var(--cc-text)' }}>{t('chat.roomExpiredRecapHint')}</p>
                  {roomRecapLoading ? (
                    <p style={{ color: 'var(--cc-text-2)' }}>{t('chat.recapLoading')}</p>
                  ) : roomRecap ? (
                    <>
                      <p style={{ color: 'var(--cc-text-2)' }}>
                        {t('chat.recapParticipants', { count: String(roomRecap.participant_count) })}
                        {' · '}
                        {t('chat.recapMessages', { count: String(roomRecap.message_count) })}
                        {' · '}
                        {t('chat.recapDuration', { minutes: String(roomRecap.duration_minutes) })}
                      </p>
                      {roomRecap.summary && (
                        <p className="mt-1" style={{ color: 'var(--cc-text)' }}>{roomRecap.summary}</p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: 'var(--cc-text-2)' }}>{t('chat.recapUnavailable')}</p>
                  )}
                </div>
              )}

              {isStageLikeRoom && activeRoom && (
                <div className="border-b px-4 py-3" style={{ borderColor: 'var(--cc-line)', background: 'var(--cc-panel)' }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-vault/15 px-2.5 py-1 text-xs font-bold text-vault">
                          <MicrophoneIcon className="h-3.5 w-3.5" />
                          {activeRoom.channel_type === 'stage' ? t('chat.stage') : t('chat.voiceRoom')}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--cc-text-2)' }}>
                          {stageLoading ? t('chat.syncing') : t('chat.stageSummary', { speakers: String(stageState?.speakers.length ?? 0), listeners: String(stageState?.listeners.length ?? 0), hands: String(stageState?.raised_hands.length ?? 0) })}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3" style={{ color: 'var(--cc-text-2)' }}>
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--cc-text)' }}>{t('chat.speakers')}</p>
                          <p className="truncate">
                            {stageState?.speakers.length
                              ? stageState.speakers.map(stageMemberName).join(', ')
                              : t('chat.noSpeakersYet')}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--cc-text)' }}>{t('chat.listeners')}</p>
                          <p className="truncate">
                            {stageState?.listeners.length
                              ? stageState.listeners.slice(0, 5).map(stageMemberName).join(', ')
                              : t('chat.noListenersYet')}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: 'var(--cc-text)' }}>{t('chat.raisedHands')}</p>
                          <p className="truncate">
                            {stageState?.raised_hands.length
                              ? stageState.raised_hands.slice(0, 5).map(stageMemberName).join(', ')
                              : t('chat.noHandsRaised')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full bg-vault px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        disabled={myStageRole !== 'none' || stageActionPending !== null}
                        onClick={() => void sendStageAction('join')}
                      >
                        {stageActionPending === 'join' ? t('chat.stageJoining') : t('chat.stageJoin')}
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                        disabled={myStageRole === 'none' || stageActionPending !== null}
                        onClick={() => void sendStageAction('leave')}
                      >
                        {stageActionPending === 'leave' ? t('chat.stageLeaving') : t('chat.stageLeave')}
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-surface px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                        disabled={myHandRaised || myStageRole === 'speaker' || stageActionPending !== null}
                        onClick={() => void sendStageAction('raise_hand')}
                      >
                        {stageActionPending === 'raise_hand' ? t('chat.stageRaisingHand') : myHandRaised ? t('chat.stageHandRaised') : t('chat.stageRaiseHand')}
                      </button>
                      <button
                        type="button"
                        className="rounded-full bg-bazaar px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        disabled={myStageRole === 'speaker' || stageActionPending !== null}
                        onClick={() => void sendStageAction('speak')}
                      >
                        {stageActionPending === 'speak' ? t('chat.stageOpeningMic') : t('chat.stageSpeak')}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {viewMode === 'room' && activeRoom && !activePromptRoom && (
                <div className="px-4 py-2 border-b border-surface">
                  <div className="flex flex-wrap gap-2">
                    {activeRoom.members.map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs"
                      >
                        {member.name}
                        {activeRoom.created_by_id === meId && member.id !== meId && (
                          <button type="button" onClick={() => void removeMember(member.id)}>
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {threadScheduledMessages.length > 0 && (
                <div className="px-4 py-2 flex flex-col gap-1 border-b" style={{ borderColor: 'var(--cc-line)' }}>
                  {threadScheduledMessages.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1 opacity-80">
                        <ClockIcon className="h-3.5 w-3.5" />
                        &quot;{s.text}&quot; — sends {new Date(s.send_at).toLocaleString()}
                      </span>
                      <button type="button" className="p-0.5 rounded hover:bg-black/10" title={t('chat.cancelScheduled')} onClick={() => void cancelScheduled(s.id)}>
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="cosmic-chat-messages" ref={messagesContainerRef}>
                {threadDisplayMessages.length === 0 && (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--cc-text-2)' }}>
                    {messageSearch.trim() ? t('chat.noSearchMatches') : t('chat.startConversation')}
                  </p>
                )}
                {threadDisplayMessages.map((m) => {
                  const out = m.sender_id === meId;
                  const swipeDx = swipeState?.id === m.id ? swipeState.dx : 0;
                  return (
                    <div key={m.id} className="relative">
                      {swipeDx !== 0 && (
                        <div
                          className={`absolute inset-y-0 flex items-center px-3 text-xs font-semibold ${swipeDx < 0 ? 'right-0' : 'left-0'}`}
                          style={{ color: 'var(--cc-brown)', opacity: Math.min(1, Math.abs(swipeDx) / SWIPE_TRIGGER_PX) }}
                        >
                          {swipeDx < 0 ? (
                            <span className="flex items-center gap-1"><ArrowUturnLeftIcon className="h-4 w-4" /> {t('chat.reply')}</span>
                          ) : (
                            <span className="flex items-center gap-1"><MapPinIcon className="h-4 w-4" /> {m.is_pinned ? t('chat.unpin') : t('chat.pin')}</span>
                          )}
                        </div>
                      )}
                    <div
                      className={`cosmic-chat-bubble ${out ? 'cosmic-chat-bubble--out' : 'cosmic-chat-bubble--in'}${m.is_pinned ? ' ring-1 ring-vault/40' : ''}`}
                      style={{ transform: swipeDx ? `translateX(${swipeDx}px)` : undefined, transition: swipeDx ? 'none' : 'transform 0.2s ease' }}
                      onTouchStart={(e) => handleBubbleTouchStart(m, e)}
                      onTouchMove={(e) => handleBubbleTouchMove(m, e)}
                      onTouchEnd={() => handleBubbleTouchEnd(m)}
                    >
                      {m.is_pinned && (
                        <span className="text-[10px] flex items-center gap-1 opacity-80 mb-1">
                          <MapPinIcon className="h-3 w-3" />
                          {t('chat.pinned')}
                        </span>
                      )}
                      {viewMode === 'room' && !out && m.sender_name && (
                        <div className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender_name}</div>
                      )}
                      {editingMessageId === m.id ? (
                        <div className="flex flex-col gap-1">
                          <textarea
                            autoFocus
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void saveMessageEdit(m, editDraft).then(() => setEditingMessageId(null));
                              } else if (e.key === 'Escape') {
                                setEditingMessageId(null);
                              }
                            }}
                            className="w-full rounded-lg bg-black/10 px-2 py-1 text-sm"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2 text-xs">
                            <button type="button" onClick={() => setEditingMessageId(null)}>
                              {t('common.cancel')}
                            </button>
                            <button
                              type="button"
                              className="font-semibold"
                              onClick={() => void saveMessageEdit(m, editDraft).then(() => setEditingMessageId(null))}
                            >
                              {t('common.save')}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <MessageBody m={m} highlightQuery={messageSearch.trim()} />
                      )}
                      {!m.is_deleted && m.edited_at && (
                        <span className="text-[10px] opacity-60 italic ml-1">{t('chat.edited')}</span>
                      )}
                      {!m.is_deleted && m.expires_at && (
                        <span className="text-[10px] opacity-60 italic ml-1 inline-flex items-center gap-0.5" title={new Date(m.expires_at).toLocaleString()}>
                          <FireIcon className="h-3 w-3" />
                          {formatTimeLeft(m.expires_at, t)}
                        </span>
                      )}
                      {m.reaction_counts && Object.keys(m.reaction_counts).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(m.reaction_counts).map(([emoji, count]) => (
                            <span
                              key={emoji}
                              className={`text-[11px] rounded-full px-1.5 py-0.5 ${m.my_reaction === emoji ? 'bg-vault/20' : 'bg-black/10'}`}
                            >
                              {emoji} {count}
                            </span>
                          ))}
                        </div>
                      )}
                      {!m.is_deleted && (
                        <div className="flex flex-wrap items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [.cosmic-chat-bubble:hover_&]:opacity-100">
                          {CHAT_REACTS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`text-xs px-1 rounded hover:bg-black/10 ${m.my_reaction === emoji ? 'bg-vault/20' : ''}`}
                              title={t('chat.react')}
                              onClick={(e) => {
                                spawnReactionBurst(emoji, e.clientX, e.clientY);
                                void reactToMessage(m, emoji);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="p-0.5 rounded hover:bg-black/10"
                            title={m.is_pinned ? t('chat.unpin') : t('chat.pin')}
                            onClick={() => void togglePinMessage(m)}
                          >
                            <MapPinIcon className={`h-3.5 w-3.5 ${m.is_pinned ? 'text-vault' : ''}`} />
                          </button>
                          {out && (
                            <>
                              <button
                                type="button"
                                className="p-0.5 rounded hover:bg-black/10"
                                title={t('chat.edit')}
                                onClick={() => {
                                  setEditingMessageId(m.id);
                                  setEditDraft(m.text);
                                }}
                              >
                                <PencilSquareIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-0.5 rounded hover:bg-black/10"
                                title={t('chat.delete')}
                                onClick={() => void deleteMessage(m)}
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <time>{formatMsgTime(m.created_at)}</time>
                        {out && viewMode === 'dm' && (
                          <span className="text-[10px] opacity-80 inline-flex items-center gap-1">
                            {m.is_read ? (
                              <>
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                {t('chat.seen')}
                              </>
                            ) : (
                              <>
                                <SpeakerWaveIcon className="h-3.5 w-3.5" />
                                {t('chat.delivered')}
                              </>
                            )}
                          </span>
                        )}
                        {out && viewMode === 'room' && typeof m.read_count === 'number' && typeof m.member_count === 'number' && (
                          <span className="text-[10px] opacity-80 inline-flex items-center gap-1">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            {m.member_count > 0 ? t('chat.seenByCount', { seen: String(m.read_count), total: String(m.member_count) }) : t('chat.sent')}
                          </span>
                        )}
                      </div>
                    </div>
                    </div>
                  );
                })}
                {peerTyping && (
                  <p className="text-xs italic px-1" style={{ color: 'var(--cc-text-2)' }}>
                    {viewMode === 'room' ? t('chat.someoneTyping') : t('chat.nameTyping', { name: activePeer?.name || '' })}
                  </p>
                )}
                <div ref={messagesEndRef} />
                {reactionBursts.map((burst) => (
                  <ReactionBurst
                    key={burst.id}
                    emoji={burst.emoji}
                    x={burst.x}
                    y={burst.y}
                    onDone={() => clearReactionBurst(burst.id)}
                  />
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFilePick(f);
                  e.target.value = '';
                }}
              />
              <div className="cosmic-chat-composer-dock">
              {uploadProgress && (
                <div className="px-4 pt-3">
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full bg-vault transition-all"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {t('chat.uploadingAttachment', { percent: String(uploadProgress.percent) })}
                  </p>
                </div>
              )}
              {replyingTo && (
                <div
                  className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs border-l-2"
                  style={{ background: 'var(--cc-panel)', borderColor: 'var(--cc-brown)' }}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <ArrowUturnLeftIcon className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--cc-brown)' }} />
                    <span className="truncate">
                      {t('chat.replyingToQuote', {
                        name: replyingTo.sender_id === meId ? t('chat.you') : replyingTo.sender_name || activePeer?.name || t('chat.them'),
                        text: `${replyingTo.text.slice(0, 60)}${replyingTo.text.length > 60 ? '…' : ''}`,
                      })}
                    </span>
                  </span>
                  <button type="button" className="shrink-0 p-0.5 rounded hover:bg-black/10" title={t('chat.cancelReply')} onClick={() => setReplyingTo(null)}>
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              )}
              <form className="cosmic-chat-input-row relative" onSubmit={handleSend}>
                <button
                  type="button"
                  className="cosmic-chat-icon-btn"
                  aria-label={t('chat.insertEmoji')}
                  onClick={() => {
                    setEmojiOpen((v) => !v);
                    setMoodMenuOpen(false);
                  }}
                >
                  <FaceSmileIcon className="h-5 w-5" />
                </button>
                {emojiOpen ? (
                  <div className="absolute bottom-full left-0 mb-2 flex flex-wrap gap-1 rounded-xl border p-2 shadow-lg z-20" style={{ background: 'var(--cc-panel)', borderColor: 'var(--cc-line)' }}>
                    {QUICK_EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" className="text-lg p-1" onClick={() => insertEmoji(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="cosmic-chat-icon-btn"
                  aria-label={t('chat.moodStamp')}
                  title={t('chat.moodStamp')}
                  onClick={() => {
                    setMoodMenuOpen((v) => !v);
                    setEmojiOpen(false);
                  }}
                >
                  <span className="text-lg leading-none">{moodEmoji(me?.mood_icon || 'sun')}</span>
                </button>
                {moodMenuOpen ? (
                  <div
                    className="absolute bottom-full left-10 mb-2 flex gap-1 rounded-xl border p-2 shadow-lg z-20"
                    style={{ background: 'var(--cc-panel)', borderColor: 'var(--cc-line)' }}
                  >
                    {MOOD_STAMPS.map((stamp) => (
                      <button
                        key={stamp.key}
                        type="button"
                        className="text-xl p-1.5 rounded-lg hover:bg-black/10"
                        title={t(stamp.labelKey as never)}
                        aria-label={t(stamp.labelKey as never)}
                        onClick={(e) => void sendMoodStamp(stamp.key, e)}
                      >
                        {stamp.emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="cosmic-chat-icon-btn hidden md:inline-flex"
                  title={t('chat.attachFile')}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PaperClipIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="cosmic-chat-icon-btn"
                  title={vanishSeconds ? t('chat.vanishModeLabel', { label: VANISH_PRESETS.find((p) => p.seconds === vanishSeconds)?.labelKey ? t(VANISH_PRESETS.find((p) => p.seconds === vanishSeconds)!.labelKey as never) : '' }) : t('chat.vanishModeOff')}
                  style={vanishSeconds ? { color: 'var(--cc-brown)' } : undefined}
                  onClick={() => setVanishMenuOpen((v) => !v)}
                >
                  <FireIcon className="h-5 w-5" />
                </button>
                {vanishMenuOpen ? (
                  <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-1 rounded-xl border p-2 shadow-lg z-20 min-w-[9rem]" style={{ background: 'var(--cc-panel)', borderColor: 'var(--cc-line)' }}>
                    <button
                      type="button"
                      className="text-xs text-left px-2 py-1 rounded hover:bg-black/10"
                      style={!vanishSeconds ? { fontWeight: 700 } : undefined}
                      onClick={() => {
                        setVanishSeconds(null);
                        setVanishMenuOpen(false);
                      }}
                    >
                      {t('chat.vanishOff')}
                    </button>
                    {VANISH_PRESETS.map((preset) => (
                      <button
                        key={preset.seconds}
                        type="button"
                        className="text-xs text-left px-2 py-1 rounded hover:bg-black/10"
                        style={vanishSeconds === preset.seconds ? { fontWeight: 700 } : undefined}
                        onClick={() => {
                          setVanishSeconds(preset.seconds);
                          setVanishMenuOpen(false);
                        }}
                      >
                        {t('chat.vanishAfter', { label: t(preset.labelKey as never) })}
                      </button>
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="cosmic-chat-icon-btn"
                  title={t('chat.scheduleMessage')}
                  onClick={() => {
                    setScheduleDraft('');
                    setScheduleMenuOpen((v) => !v);
                  }}
                >
                  <ClockIcon className="h-5 w-5" />
                </button>
                {scheduleMenuOpen ? (
                  <div className="absolute bottom-full left-0 mb-2 flex flex-col gap-2 rounded-xl border p-3 shadow-lg z-20 min-w-[16rem]" style={{ background: 'var(--cc-panel)', borderColor: 'var(--cc-line)' }}>
                    <span className="text-xs font-semibold">{t('chat.sendAt')}</span>
                    <input
                      type="datetime-local"
                      className="cosmic-modal-input"
                      value={scheduleDraft}
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                      onChange={(e) => setScheduleDraft(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded hover:bg-black/10"
                        onClick={() => setScheduleMenuOpen(false)}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold px-2 py-1 rounded"
                        style={{ background: 'var(--cc-brown)', color: '#fff' }}
                        disabled={!draft.trim() || !scheduleDraft}
                        onClick={() => void scheduleMessage(draft, scheduleDraft)}
                      >
                        {t('chat.schedule')}
                      </button>
                    </div>
                  </div>
                ) : null}
                <input
                  className="cosmic-chat-input"
                  placeholder={t('chat.messagePlaceholder')}
                  value={draft}
                  disabled={!!activePromptRoom?.is_expired}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    const fn = viewMode === 'room' ? roomSendTyping : sendTyping;
                    void fn(e.target.value.length > 0);
                  }}
                  onBlur={() => {
                    const fn = viewMode === 'room' ? roomSendTyping : sendTyping;
                    void fn(false);
                  }}
                />
                <button type="submit" className="cosmic-chat-send" disabled={sending || !!activePromptRoom?.is_expired}>
                  <PaperAirplaneIcon className="h-4 w-4 inline sm:mr-1" />
                  <span className="hidden sm:inline">{t('chat.send')}</span>
                </button>
              </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--cc-text-2)' }}>
              {t('chat.selectFriendToChat')}
            </div>
          )}
        </section>

        <aside className="cosmic-chat-col cosmic-chat-col--shared">
          <div className="cosmic-chat-col-head">{t('chat.sharedSpace')}</div>
          <div className="cosmic-chat-col-scroll">
            <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
              {t('chat.jointChallenges')}
            </p>
            {challenges.map((c) => (
              <Link key={c.id} href={c.href} className="cosmic-chat-shared-card block hover:opacity-90">
                <div className="font-semibold text-sm">{c.title}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-2)' }}>
                  {t('chat.participantsCount', { count: String(c.participants) })}
                </div>
                <div className="cosmic-chat-progress">
                  <span style={{ width: `${c.progress}%` }} />
                </div>
              </Link>
            ))}

            <p className="text-[10px] uppercase tracking-wide px-3 pt-3 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
              {t('chat.collaborativeStories')}
            </p>
            {stories.map((s) => (
              <Link key={s.id} href={s.href} className="cosmic-chat-shared-card block hover:opacity-90">
                <div className="font-semibold text-sm">{s.title}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-2)' }}>
                  {s.subtitle} · {t('chat.wordsCount', { count: String(s.words) })}
                </div>
              </Link>
            ))}

            <p className="text-[10px] uppercase tracking-wide px-3 pt-3 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
              {t('chat.sharedMedia')}
            </p>
            <div className="cosmic-chat-media-grid">
              {media.length === 0
                ? [1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg flex items-center justify-center"
                      style={{ background: 'var(--cc-panel)' }}
                    >
                      <PhotoIcon className="h-8 w-8 opacity-30" />
                    </div>
                  ))
                : media.map((m) => (
                    <Link key={m.id} href={`/post/${m.post_id}`}>
                      <Image src={mediaUrl(m.url)} alt={t('chat.sharedMediaAlt')} width={160} height={160} unoptimized />
                    </Link>
                  ))}
            </div>

            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
              <Link href="/bottles" className="cosmic-chat-shared-card text-center py-3 text-xs font-semibold">
                <ArchiveBoxIcon className="h-6 w-6 mx-auto mb-1" />
                {t('chat.sendBottle')}
              </Link>
              <Link href="/lab" className="cosmic-chat-shared-card text-center py-3 text-xs font-semibold">
                <BeakerIcon className="h-6 w-6 mx-auto mb-1" />
                {t('chat.dailyChallenge')}
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <nav className="cosmic-chat-bottom-nav" aria-label={t('chat.chatShortcuts')}>
        <Link href="/bottles" title={t('chat.bottle')}>
          <ArchiveBoxIcon className="h-5 w-5" />
          {t('chat.bottle')}
        </Link>
        <Link href="/" title={t('chat.gallery')}>
          <PhotoIcon className="h-5 w-5" />
          {t('chat.gallery')}
        </Link>
        <Link href="/#create-post" title={t('chat.createPost')}>
          <PlusCircleIcon className="h-6 w-6" />
          {t('chat.createPostShort')}
        </Link>
        <button
          type="button"
          title={t('chat.voiceCall')}
          className={viewMode === 'dm' && activePeer ? '' : 'opacity-40'}
          disabled={viewMode !== 'dm' || !activePeer}
          onClick={() => void handleVoiceCall()}
        >
          <MicrophoneIcon className="h-5 w-5" />
          {t('chat.voiceCallShort')}
        </button>
        <Link href="/settings" title={t('chat.moodSettings')}>
          <FaceSmileIcon className="h-5 w-5" />
          {t('chat.moodShort')}
        </Link>
      </nav>

      {(incoming || callActive) && (
        <CallOverlay
          mode={incoming ? 'incoming' : 'active'}
          callKind={callKind}
          peerName={viewMode === 'room' ? activeRoomName || t('chat.roomFallback') : activePeer?.name || t('chat.friendFallback')}
          peerAvatar={viewMode === 'dm' ? activePeer?.avatar ?? null : null}
          incoming={incoming}
          muted={muted}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          onAccept={() => void acceptCall()}
          onReject={rejectCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
        />
      )}

      {groupCallActive && (
        <GroupCallOverlay
          roomName={activeRoomName || t('chat.groupCallFallback')}
          callKind={groupCallKind}
          muted={groupCallMuted}
          peers={groupCallPeers}
          localVideoRef={groupCallLocalVideoRef}
          onHangUp={leaveGroupCall}
          onToggleMute={toggleGroupCallMute}
        />
      )}

      {memberPickerMode && (
        <MemberPickerModal
          title={memberPickerMode === 'create' ? t('chat.newGroupRoom') : t('chat.inviteMembers')}
          confirmLabel={memberPickerMode === 'create' ? t('chat.createRoomLabel') : t('chat.inviteLabel')}
          showNameField={memberPickerMode === 'create'}
          candidates={
            memberPickerMode === 'invite'
              ? friends.filter((friend) => !activeRoom?.members.some((member) => member.id === friend.id))
              : friends
          }
          onClose={() => setMemberPickerMode(null)}
          onConfirm={(memberIds, name) => {
            if (memberPickerMode === 'create') {
              void createRoom(memberIds, name);
            } else {
              void inviteMembers(memberIds);
            }
            setMemberPickerMode(null);
          }}
        />
      )}

      {renameOpen && (
        <div className="cosmic-modal-overlay" onClick={() => setRenameOpen(false)}>
          <div className="cosmic-modal-panel" onClick={(e) => e.stopPropagation()}>
            <h2 className="cosmic-modal-title">{t('chat.renameRoomTitle')}</h2>
            <input
              type="text"
              className="cosmic-modal-input"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submitRename();
              }}
              autoFocus
            />
            <div className="cosmic-modal-actions">
              <button type="button" className="cosmic-modal-btn cosmic-modal-btn--ghost" onClick={() => setRenameOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="cosmic-modal-btn cosmic-modal-btn--primary"
                onClick={() => void submitRename()}
                disabled={!renameDraft.trim()}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2 rounded-xl text-sm text-white shadow-lg"
          style={{ background: 'var(--cc-brown-dk)' }}
        >
          {toast}
        </div>
      )}

      {promptPickerOpen && (
        <InspirationPicker
          open={promptPickerOpen}
          onClose={() => setPromptPickerOpen(false)}
          onUse={(q) => void startPromptRoom(q)}
        />
      )}
    </div>
  );
}

export default function CosmicChatPage() {
  const { t } = useLocale();
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center text-sm" style={{ color: 'var(--cc-text-2)' }}>
          {t('chat.loadingChat')}
        </div>
      }
    >
      <CosmicChatPageContent />
    </Suspense>
  );
}