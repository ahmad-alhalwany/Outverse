'use client';

import './cosmic-chat.css';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArchiveBoxIcon,
  BeakerIcon,
  BellSlashIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  EllipsisVerticalIcon,
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
} from '@heroicons/react/24/outline';
import { getUser } from '@/lib/auth';
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
import CallOverlay from '@/components/chat/CallOverlay';

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
};

type ConversationSummary = {
  id: number;
  peer: Friend | null;
  last_message: ChatMessage | null;
  unread_count: number;
  updated_at: string;
};

type ChatRoom = {
  id: number;
  name: string;
  member_count: number;
  members: Array<{ id: number; username: string; name: string; avatar: string | null }>;
  created_by_id: number;
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
  };
}

function MessageBody({ m }: { m: ChatMessage }) {
  const url = m.attachment_url ? mediaUrl(m.attachment_url) : null;
  if (m.message_type === 'image' && url) {
    return (
      <>
        <Image src={url} alt="Shared chat image" width={320} height={240} className="max-w-full rounded-lg mb-1" unoptimized />
        {m.text ? <span>{m.text}</span> : null}
      </>
    );
  }
  if (m.message_type === 'voice' && url) {
    return (
      <>
        <audio controls src={url} className="max-w-full mb-1" />
        {m.text ? <span>{m.text}</span> : null}
      </>
    );
  }
  if (m.message_type === 'file' && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="underline">
        {m.text || 'Download file'}
      </a>
    );
  }
  return <>{m.text}</>;
}

export default function CosmicChatPage() {
  const { t } = useLocale();
  const meUser = getUser();
  const meId = meUser?.id ?? 0;
  const [friends, setFriends] = useState<Friend[]>([]);
  const [me, setMe] = useState<Friend | null>(null);
  const [search, setSearch] = useState('');
  const [activePeer, setActivePeer] = useState<Friend | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
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
  const [activeRoomId, setActiveRoomId] = useState<number | null>(null);
  const [activeRoomName, setActiveRoomName] = useState('');
  const [archivedConversationIds, setArchivedConversationIds] = useState<number[]>([]);
  const [mutedConversationIds, setMutedConversationIds] = useState<number[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const seenMsgIds = useRef<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    try {
      setArchivedConversationIds(JSON.parse(localStorage.getItem('chat.archived') || '[]'));
      setMutedConversationIds(JSON.parse(localStorage.getItem('chat.muted') || '[]'));
    } catch {
      setArchivedConversationIds([]);
      setMutedConversationIds([]);
    }
  }, []);

  const persistLocalConversationState = useCallback((key: string, ids: number[]) => {
    localStorage.setItem(key, JSON.stringify(ids));
  }, []);

  const rtcSignalRef = useRef<(p: SignalPayload) => void>(() => {});

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
    if (String(payload.type).startsWith('call.room.')) {
      showToast('Group call signal received (join a room first)');
      return;
    }
    void rtcSignalRef.current(payload);
  }, [showToast]);

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
  } = useWebRTCCall(meId, sendSignal, () => showToast('Call ended'));

  useEffect(() => {
    rtcSignalRef.current = (p) => {
      void callHandleSignal(p);
    };
  }, [callHandleSignal]);

  useEffect(() => {
    setWsSignalLive(signalConnected);
  }, [signalConnected]);

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

  const loadFriends = useCallback(async () => {
    try {
      const res = await apiFetch('chat/friends/');
      if (res.ok) {
        const data = await res.json();
        setFriends(data.friends || []);
        if (data.me) setMe(data.me);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiFetch('chat/conversations/');
      if (res.ok) {
        const data = await res.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

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
      /* ignore */
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const res = await apiFetch('chat/rooms/');
      if (res.ok) {
        const data = await res.json();
        setRooms(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const openRoom = useCallback(
    async (room: ChatRoom) => {
      setViewMode('room');
      setActivePeer(null);
      setConversationId(null);
      setActiveRoomId(room.id);
      setActiveRoomName(room.name);
      setPeerTyping(false);
      try {
        const res = await apiFetch(`chat/rooms/${room.id}/messages/`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.messages || []).map(normalizeMsg);
          seenMsgIds.current = new Set(list.map((m: ChatMessage) => m.id));
          setMessages(list);
        }
      } catch {
        showToast('Could not load room');
      }
    },
    [showToast],
  );

  const createRoom = useCallback(async () => {
    const name = window.prompt('Room name');
    if (!name?.trim()) return;
    try {
      const res = await apiFetch('chat/rooms/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const room = await res.json();
        await loadRooms();
        openRoom(room);
      }
    } catch {
      showToast('Could not create room');
    }
  }, [loadRooms, openRoom, showToast]);

  const openChat = useCallback(
    async (peer: Friend) => {
      setViewMode('dm');
      setActiveRoomId(null);
      setActivePeer(peer);
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
        showToast('Could not load conversation');
      }
    },
    [loadConversations, showToast],
  );

  useEffect(() => {
    void loadFriends();
    void loadRooms();
    void loadConversations();
  }, [loadFriends, loadRooms, loadConversations]);

  useEffect(() => {
    void loadShared();
  }, [loadShared]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (viewMode === 'dm' && (!activePeer || !conversationId)) return;
    if (viewMode === 'room' && !activeRoomId) return;
    setSending(true);
    const typingFn = viewMode === 'room' ? roomSendTyping : sendTyping;
    void typingFn(false);
    try {
      const sent = viewMode === 'room' ? wsRoomSend(text) : wsSendMessage(text);
      if (sent) {
        setDraft('');
      } else if (viewMode === 'dm' && conversationId) {
        const res = await apiFetch(`chat/conversations/${conversationId}/messages/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          appendMessage(await res.json());
          setDraft('');
        } else {
          showToast('Message not sent — start backend with runserver or daphne');
        }
      } else if (viewMode === 'room' && activeRoomId) {
        const res = await apiFetch(`chat/rooms/${activeRoomId}/messages/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          appendMessage(await res.json());
          setDraft('');
        } else {
          showToast('Message not sent');
        }
      }
      await loadConversations();
      await loadRooms();
    } catch {
      showToast('Message not sent');
    } finally {
      setSending(false);
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
      else showToast('Upload failed');
    } catch {
      showToast('Upload failed');
    } finally {
      setSending(false);
      setTimeout(() => setUploadProgress(null), 1200);
    }
  }

  async function handleVoiceCall() {
    if (viewMode !== 'dm' || !activePeer) {
      showToast('Select a friend for a voice call');
      return;
    }
    try {
      await startCall(activePeer.id, 'audio', meBarName, meAvatar);
    } catch {
      showToast('Allow microphone access to call');
    }
  }

  async function handleVideoCall() {
    if (!activePeer) return;
    try {
      await startCall(activePeer.id, 'video', meBarName, meAvatar);
    } catch {
      showToast('Allow camera & microphone to video call');
    }
  }

  async function renameRoom() {
    if (!activeRoomId || !activeRoom) return;
    const name = window.prompt('Rename room', activeRoom.name);
    if (!name?.trim()) return;
    const res = await apiFetchJson(`chat/rooms/${activeRoomId}/`, {
      method: 'PATCH',
      json: { name: name.trim() },
    });
    if (res.ok) {
      await loadRooms();
      setActiveRoomName(name.trim());
      showToast('Room renamed');
    } else {
      showToast('Could not rename room');
    }
  }

  async function inviteMembers() {
    if (!activeRoomId) return;
    const available = friends.filter(
      (friend) => !activeRoom?.members.some((member) => member.id === friend.id),
    );
    const input = window.prompt(
      `Invite member IDs: ${available.map((friend) => `${friend.id}:${friend.username}`).join(', ')}`,
    );
    if (!input?.trim()) return;
    const memberIds = input
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value));
    const res = await apiFetchJson(`chat/rooms/${activeRoomId}/members/`, {
      method: 'POST',
      json: { member_ids: memberIds },
    });
    if (res.ok) {
      await loadRooms();
      showToast('Members invited');
    } else {
      showToast('Could not invite members');
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
      showToast('Member removed');
    } else {
      showToast('Could not remove member');
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
      showToast('Left room');
    } else {
      showToast('Could not leave room');
    }
  }

  function toggleArchiveConversation() {
    if (!conversationId) return;
    const next = archivedConversationIds.includes(conversationId)
      ? archivedConversationIds.filter((id) => id !== conversationId)
      : [...archivedConversationIds, conversationId];
    setArchivedConversationIds(next);
    persistLocalConversationState('chat.archived', next);
    showToast(
      archivedConversationIds.includes(conversationId)
        ? 'Conversation restored'
        : 'Conversation archived',
    );
  }

  function toggleMuteConversation() {
    if (!conversationId) return;
    const next = mutedConversationIds.includes(conversationId)
      ? mutedConversationIds.filter((id) => id !== conversationId)
      : [...mutedConversationIds, conversationId];
    setMutedConversationIds(next);
    persistLocalConversationState('chat.muted', next);
    showToast(
      mutedConversationIds.includes(conversationId)
        ? 'Conversation unmuted'
        : 'Conversation muted',
    );
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

      <div className="cosmic-chat-grid">
        <aside className="cosmic-chat-col">
          <div className="cosmic-chat-col-head">{t('chat.friends')}</div>
          <div className="relative px-1">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--cc-text-2)]" />
            <input
              className="cosmic-chat-search"
              placeholder={t('chat.searchFriends')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
            Conversations
          </p>
          <div className="flex-1 overflow-y-auto min-h-0 px-2 space-y-1">
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
                <div className="cosmic-chat-friend-meta hidden sm:block">
                  <div className="name">{conversation.peer?.name || 'Unknown'}</div>
                  <div className="status truncate">
                    {conversation.last_message?.text || 'No messages yet'}
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
            Group rooms
          </p>
          <div className="px-2 pb-2 flex gap-1">
            <button
              type="button"
              className="text-xs font-semibold px-2 py-1 rounded-lg flex-1"
              style={{ background: 'var(--cc-panel)' }}
              onClick={() => void createRoom()}
            >
              + New room
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
                <div className="status">{r.member_count} members</div>
              </div>
            </button>
          ))}
          <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
            Friends
          </p>
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredFriends.length === 0 ? (
              <p className="text-xs text-center py-6 px-2" style={{ color: 'var(--cc-text-2)' }}>
                Follow creators to chat with them.
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
                  <div className="cosmic-chat-friend-meta hidden sm:block">
                    <div className="name">{f.name}</div>
                    <div className="status">{f.status_message}</div>
                  </div>
                  <span className="cosmic-chat-mood-icon">{moodEmoji(f.mood_icon)}</span>
                </button>
              ))
            )}
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

        <section className="cosmic-chat-col">
          {(viewMode === 'dm' && activePeer) || (viewMode === 'room' && activeRoomId) ? (
            <>
              <div className="cosmic-chat-chat-head">
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
                    {viewMode === 'room' ? 'Group room' : activePeer?.is_online ? 'Online' : 'Away'}
                    {viewMode === 'dm' && activePeer && <span>{moodEmoji(activePeer.mood_icon)}</span>}
                  </div>
                </div>
                {viewMode === 'dm' && activePeer && (
                  <>
                    <button type="button" className="cosmic-chat-icon-btn" title="Voice call" onClick={() => void handleVoiceCall()}>
                      <PhoneIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn hidden sm:inline-flex" title="Video call" onClick={() => void handleVideoCall()}>
                      <VideoCameraIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title="Archive conversation" onClick={toggleArchiveConversation}>
                      <ArchiveBoxIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title="Mute conversation" onClick={toggleMuteConversation}>
                      <BellSlashIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
                {viewMode === 'room' && activeRoom && (
                  <div className="flex items-center gap-1">
                    <button type="button" className="cosmic-chat-icon-btn" title="Rename room" onClick={() => void renameRoom()}>
                      <PencilSquareIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title="Invite members" onClick={() => void inviteMembers()}>
                      <UserPlusIcon className="h-5 w-5" />
                    </button>
                    <button type="button" className="cosmic-chat-icon-btn" title="Leave room" onClick={() => void leaveActiveRoom()}>
                      <UserMinusIcon className="h-5 w-5" />
                    </button>
                  </div>
                )}
                <button type="button" className="cosmic-chat-icon-btn">
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </button>
              </div>

              {viewMode === 'room' && activeRoom && (
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

              <div className="cosmic-chat-messages">
                {messages.length === 0 && (
                  <p className="text-center text-sm py-8" style={{ color: 'var(--cc-text-2)' }}>
                    {t('chat.startConversation')}
                  </p>
                )}
                {messages.map((m) => {
                  const out = m.sender_id === meId;
                  return (
                    <div
                      key={m.id}
                      className={`cosmic-chat-bubble ${out ? 'cosmic-chat-bubble--out' : 'cosmic-chat-bubble--in'}`}
                    >
                      <MessageBody m={m} />
                      <div className="flex items-center justify-end gap-2">
                        <time>{formatMsgTime(m.created_at)}</time>
                        {out && (
                          <span className="text-[10px] opacity-80 inline-flex items-center gap-1">
                            {m.is_read ? (
                              <>
                                <CheckCircleIcon className="h-3.5 w-3.5" />
                                Seen
                              </>
                            ) : (
                              <>
                                <SpeakerWaveIcon className="h-3.5 w-3.5" />
                                Delivered
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {peerTyping && (
                  <p className="text-xs italic px-1" style={{ color: 'var(--cc-text-2)' }}>
                    {viewMode === 'room' ? 'Someone is typing…' : `${activePeer?.name} is typing…`}
                  </p>
                )}
                <div ref={messagesEndRef} />
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
              {uploadProgress && (
                <div className="px-4 pt-3">
                  <div className="h-2 rounded-full bg-surface overflow-hidden">
                    <div
                      className="h-full bg-vault transition-all"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    Uploading attachment… {uploadProgress.percent}%
                  </p>
                </div>
              )}
              <form className="cosmic-chat-input-row" onSubmit={handleSend}>
                <button type="button" className="cosmic-chat-icon-btn hidden md:inline-flex">
                  <FaceSmileIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="cosmic-chat-icon-btn hidden md:inline-flex"
                  title="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <PaperClipIcon className="h-5 w-5" />
                </button>
                <input
                  className="cosmic-chat-input"
                  placeholder={t('chat.messagePlaceholder')}
                  value={draft}
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
                <button type="submit" className="cosmic-chat-send" disabled={sending}>
                  <PaperAirplaneIcon className="h-4 w-4 inline sm:mr-1" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--cc-text-2)' }}>
              Select a friend to chat
            </div>
          )}
        </section>

        <aside className="cosmic-chat-col">
          <div className="cosmic-chat-col-head">{t('chat.sharedSpace')}</div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <p className="text-[10px] uppercase tracking-wide px-3 pt-2 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
              Joint challenges
            </p>
            {challenges.map((c) => (
              <Link key={c.id} href={c.href} className="cosmic-chat-shared-card block hover:opacity-90">
                <div className="font-semibold text-sm">{c.title}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-2)' }}>
                  {c.participants} participants
                </div>
                <div className="cosmic-chat-progress">
                  <span style={{ width: `${c.progress}%` }} />
                </div>
              </Link>
            ))}

            <p className="text-[10px] uppercase tracking-wide px-3 pt-3 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
              Collaborative stories
            </p>
            {stories.map((s) => (
              <Link key={s.id} href={s.href} className="cosmic-chat-shared-card block hover:opacity-90">
                <div className="font-semibold text-sm">{s.title}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-2)' }}>
                  {s.subtitle} · {s.words} words
                </div>
              </Link>
            ))}

            <p className="text-[10px] uppercase tracking-wide px-3 pt-3 font-semibold" style={{ color: 'var(--cc-text-2)' }}>
              Shared media
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
                      <Image src={mediaUrl(m.url)} alt="Shared media preview" width={160} height={160} unoptimized />
                    </Link>
                  ))}
            </div>

            <div className="px-3 pb-3 grid grid-cols-2 gap-2">
              <Link href="/bottles" className="cosmic-chat-shared-card text-center py-3 text-xs font-semibold">
                <ArchiveBoxIcon className="h-6 w-6 mx-auto mb-1" />
                Send a Bottle
              </Link>
              <Link href="/lab" className="cosmic-chat-shared-card text-center py-3 text-xs font-semibold">
                <BeakerIcon className="h-6 w-6 mx-auto mb-1" />
                Daily Challenge
              </Link>
            </div>
          </div>
        </aside>
      </div>

      <nav className="cosmic-chat-bottom-nav" aria-label="Chat shortcuts">
        <Link href="/bottles" title="Bottle">
          <ArchiveBoxIcon className="h-5 w-5" />
          Bottle
        </Link>
        <Link href="/" title="Gallery">
          <PhotoIcon className="h-5 w-5" />
          Gallery
        </Link>
        <Link href="/#create-post" title="Create post">
          <PlusCircleIcon className="h-6 w-6" />
          Create
        </Link>
        <button
          type="button"
          title="Voice call"
          className={viewMode === 'dm' && activePeer ? '' : 'opacity-40'}
          disabled={viewMode !== 'dm' || !activePeer}
          onClick={() => void handleVoiceCall()}
        >
          <MicrophoneIcon className="h-5 w-5" />
          Voice
        </button>
        <Link href="/settings" title="Mood & settings">
          <FaceSmileIcon className="h-5 w-5" />
          Mood
        </Link>
      </nav>

      {(incoming || callActive) && (
        <CallOverlay
          mode={incoming ? 'incoming' : 'active'}
          callKind={callKind}
          peerName={viewMode === 'room' ? activeRoomName || 'Room' : activePeer?.name || 'Friend'}
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

      {toast && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2 rounded-xl text-sm text-white shadow-lg"
          style={{ background: 'var(--cc-brown-dk)' }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}