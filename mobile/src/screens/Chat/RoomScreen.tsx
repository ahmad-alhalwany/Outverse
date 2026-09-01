import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { createReconnectingWebSocket, resolveWsUrl, type WsChatPayload } from '@/api/ws';
import { mediaUrl } from '@/api/config';
import { User } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { GroupCallOverlay } from '@/components/GroupCallOverlay';
import { useGroupCall } from '@/hooks/useGroupCall';
import { useSignalWebSocket, type SignalPayload } from '@/hooks/useSignalWebSocket';
import { useLocale } from '@/i18n/LocaleProvider';
import { offerNativeCallFallback } from '@/lib/nav';
import { hasNativeWebRTC, prepareCallMedia } from '@/lib/webrtc';
import {
  asChatList,
  buildReplyQuote,
  useChatPalette,
  type ChatFriend,
  type ChatThreadMessage,
} from '@/lib/chat';
import { ChatActions, ChatBubble, ChatComposer } from './chatParts';
import * as ImagePicker from 'expo-image-picker';

interface RoomScreenProps {
  route: {
    params?: {
      roomId?: string | number;
      roomName?: string;
      channelType?: 'text' | 'voice' | 'stage';
      stage?: boolean;
      isExpired?: boolean;
      questionText?: string;
      questionCategory?: string;
    };
  };
  navigation: any;
}

type MessageItem = ChatThreadMessage;

type StageState = {
  speakers_count?: number;
  listeners_count?: number;
  speakers?: unknown[];
  listeners?: unknown[];
  hand_raised?: boolean;
  is_speaker?: boolean;
  joined?: boolean;
};

type RoomRecap = {
  participant_count?: number;
  message_count?: number;
  duration_minutes?: number;
  summary?: string;
};

function normalizeRoomMessage(raw: Record<string, unknown>, self?: User | null): MessageItem {
  const senderId = (raw.sender as User | undefined)?.id ?? raw.sender_id;
  let sender: User;
  const existing = raw.sender as User | undefined;
  if (existing?.username) {
    sender = existing;
  } else if (self && String(senderId) === String(self.id)) {
    sender = self;
  } else {
    sender = {
      id: senderId as string | number,
      username: String(raw.sender_name || 'user'),
      display_name: String(raw.sender_name || 'User'),
      avatar: raw.sender_avatar ? mediaUrl(String(raw.sender_avatar)) : undefined,
      email: '',
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
    };
  }
  return {
    id: raw.id as string | number,
    sender,
    sender_id: Number(sender.id),
    sender_name: sender.display_name || sender.username,
    text: String(raw.text ?? raw.content ?? ''),
    content: String(raw.text ?? raw.content ?? ''),
    message_type: raw.message_type ? String(raw.message_type) : undefined,
    attachment_url: raw.attachment_url ? mediaUrl(String(raw.attachment_url)) : null,
    is_read: Boolean(raw.is_read),
    is_pinned: Boolean(raw.is_pinned),
    reaction_counts: (raw.reaction_counts as Record<string, number> | undefined) ?? undefined,
    my_reaction: (raw.my_reaction as string | null | undefined) ?? null,
    edited_at: raw.edited_at ? String(raw.edited_at) : null,
    is_deleted: Boolean(raw.is_deleted),
    expires_at: raw.expires_at ? String(raw.expires_at) : null,
    created_at: String(raw.created_at),
  };
}

function wsPayloadToRoomMessage(data: WsChatPayload, self?: User | null): MessageItem {
  return normalizeRoomMessage(data as unknown as Record<string, unknown>, self);
}

export default function RoomScreen({ route, navigation }: RoomScreenProps) {
  const { isDark } = useTheme();
  const { t } = useLocale();
  const C = useChatPalette(isDark);
  const { user } = useAuth();
  const {
    roomId,
    roomName: paramRoomName,
    channelType,
    stage,
    isExpired: paramExpired,
    questionText: paramQuestion,
    questionCategory: paramCategory,
  } = route.params || {};
  const isStageRoom = channelType === 'voice' || channelType === 'stage' || !!stage;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [roomName, setRoomName] = useState(paramRoomName || '');
  const [wsConnected, setWsConnected] = useState(false);
  const [stageState, setStageState] = useState<StageState | null>(null);
  const [stageBusy, setStageBusy] = useState(false);
  const [vanishSeconds, setVanishSeconds] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [actionMessage, setActionMessage] = useState<MessageItem | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const [isExpired, setIsExpired] = useState(Boolean(paramExpired));
  const [questionText, setQuestionText] = useState(paramQuestion || '');
  const [questionCategory, setQuestionCategory] = useState(paramCategory || '');
  const [recap, setRecap] = useState<RoomRecap | null>(null);
  const [recapLoading, setRecapLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [inviteIds, setInviteIds] = useState<number[]>([]);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [moodIcon, setMoodIcon] = useState<'sun' | 'cloud'>('sun');
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPromptRoom = Boolean(questionText);
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null);
  const userRef = useRef(user);
  const groupSignalHandlerRef = useRef<(payload: SignalPayload) => void>(() => {});

  const { connected: signalConnected, sendSignal, joinRoom, leaveRoom } = useSignalWebSocket({
    enabled: !!user?.id,
    onSignal: (payload) => groupSignalHandlerRef.current(payload),
  });
  const groupCall = useGroupCall(
    Number(user?.id || 0),
    user?.display_name || user?.username || 'Cosonova',
    sendSignal,
  );

  useEffect(() => {
    groupSignalHandlerRef.current = groupCall.handleGroupSignal;
  }, [groupCall.handleGroupSignal]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const appendMessage = useCallback((msg: MessageItem) => {
    setMessages((prev) => {
      if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
      return [...prev, msg];
    });
  }, []);

  const updateMessageMeta = useCallback((messageId: string | number, patch: Partial<MessageItem>) => {
    setMessages((prev) =>
      prev.map((m) => (String(m.id) === String(messageId) ? { ...m, ...patch } : m)),
    );
    setActionMessage((prev) =>
      prev && String(prev.id) === String(messageId) ? { ...prev, ...patch } : prev,
    );
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await api.getRoomMessages(roomId);
      const rows = (response.messages || []).map((m: Record<string, unknown>) =>
        normalizeRoomMessage(m, userRef.current),
      );
      setMessages(rows);
      if (response.name) setRoomName(response.name);
    } catch (error) {
      console.error('Failed to fetch room messages:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const fetchRoomMeta = useCallback(async () => {
    if (!roomId) return;
    try {
      const room = (await api.getChatRoom(roomId)) as {
        name?: string;
        is_expired?: boolean;
        question_text?: string | null;
        question_category?: string | null;
        members?: Array<{ id: number }>;
        channel_type?: string;
      };
      if (room.name) setRoomName(room.name);
      setIsExpired(Boolean(room.is_expired));
      setQuestionText(room.question_text || paramQuestion || '');
      setQuestionCategory(room.question_category || paramCategory || '');
      setMemberIds((room.members || []).map((m) => Number(m.id)));
    } catch {
      /* keep route params */
    }
  }, [roomId, paramQuestion, paramCategory]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !roomId || isExpired) return;
    const content = newMessage.trim();
    const isOwnReply = replyTo ? String(replyTo.sender.id) === String(user?.id) : false;
    const text = replyTo ? `${buildReplyQuote(replyTo, isOwnReply, t('chat.them'), t)}${content}` : content;
    setNewMessage('');
    setReplyTo(null);
    setSending(true);
    try {
      if (editingId) {
        const updated = await api.editRoomMessage(editingId, content);
        setMessages((prev) =>
          prev.map((m) =>
            String(m.id) === String(editingId)
              ? { ...m, text: content, content, edited_at: updated.edited_at || new Date().toISOString() }
              : m,
          ),
        );
        setEditingId(null);
      } else {
        const sentViaWs = wsRef.current?.send({
          type: 'room.send',
          text,
          expires_in_seconds: vanishSeconds || undefined,
        });
        if (!sentViaWs) {
          const created = await api.sendRoomMessage(roomId, text, vanishSeconds);
          appendMessage(normalizeRoomMessage(created, user));
        }
      }
      wsRef.current?.send({ type: 'room.typing', is_typing: false });
    } catch {
      setNewMessage(content);
      Alert.alert(t('chat.title'), t('chat.sendMessageFailed'));
    } finally {
      setSending(false);
    }
  };

  const scheduleMessage = async (hours: number) => {
    if (!newMessage.trim() || scheduleBusy || !roomId || isExpired) return;
    const content = newMessage.trim();
    setScheduleBusy(true);
    try {
      const sendAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await api.scheduleRoomMessage(roomId, { text: content, send_at: sendAt });
      setNewMessage('');
      Alert.alert(t('chat.scheduleMessage'), t('chat.messageScheduled'));
    } catch {
      Alert.alert(t('chat.title'), t('chat.scheduleFailed'));
    } finally {
      setScheduleBusy(false);
    }
  };

  const handlePinMessage = async (item: MessageItem) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const result = await api.pinRoomMessage(item.id);
      updateMessageMeta(item.id, { is_pinned: result.is_pinned });
    } catch {
      /* ignore */
    } finally {
      setActionBusy(false);
    }
  };

  const handleReactMessage = async (item: MessageItem, emoji: string) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const nextEmoji = item.my_reaction === emoji ? null : emoji;
      const result = await api.reactRoomMessage(item.id, nextEmoji);
      updateMessageMeta(item.id, {
        my_reaction: result.my_reaction,
        reaction_counts: result.reaction_counts,
      });
    } catch {
      /* ignore */
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteMessage = (item: MessageItem) => {
    Alert.alert(t('chat.delete'), t('chat.confirmDeleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRoomMessage(item.id);
            updateMessageMeta(item.id, { is_deleted: true, text: '' });
            setActionMessage(null);
          } catch {
            Alert.alert(t('chat.title'), t('chat.deleteMessageFailed'));
          }
        },
      },
    ]);
  };

  const attachImage = async () => {
    if (!roomId || uploading || isExpired) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName || 'photo.jpg',
      type: asset.mimeType || 'image/jpeg',
    } as unknown as Blob);
    form.append('message_type', 'image');
    setUploading(true);
    try {
      const created = await api.uploadRoomFile(roomId, form);
      appendMessage(normalizeRoomMessage(created, user));
    } catch {
      Alert.alert(t('chat.title'), t('chat.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const emitTyping = (text: string) => {
    setNewMessage(text);
    wsRef.current?.send({ type: 'room.typing', is_typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      wsRef.current?.send({ type: 'room.typing', is_typing: false });
    }, 1800);
  };

  const fetchStageState = useCallback(async () => {
    if (!roomId || !isStageRoom) return;
    try {
      const state = await api.getStageState(roomId);
      setStageState(state);
    } catch (error) {
      console.error('Failed to fetch stage state:', error);
    }
  }, [roomId, isStageRoom]);

  const updateStage = async (action: 'join' | 'leave' | 'raise_hand' | 'speak') => {
    if (!roomId || stageBusy) return;
    setStageBusy(true);
    try {
      const state = await api.updateStageState(roomId, action);
      setStageState(state);
    } catch (error) {
      console.error('Failed to update stage state:', error);
    } finally {
      setStageBusy(false);
    }
  };

  const openStageVoiceCall = async () => {
    if (!roomId || stageBusy) return;
    setStageBusy(true);
    try {
      await api.updateStageState(roomId, 'join');
      const state = await api.updateStageState(roomId, 'speak');
      setStageState(state);
    } catch (error) {
      console.error('Failed to open stage voice call:', error);
    } finally {
      setStageBusy(false);
    }
  };

  const startRoomCall = async (kind: 'audio' | 'video' = 'audio') => {
    if (!roomId) return;
    if (!signalConnected) {
      Alert.alert(t('mobile.callUnavailable'), t('chat.connecting'));
      return;
    }
    if (!hasNativeWebRTC()) {
      void prepareCallMedia().then(() =>
        offerNativeCallFallback(navigation, t, roomId ? `/chat?room=${roomId}` : '/chat'),
      );
      return;
    }
    try {
      await groupCall.joinGroupCall(Number(roomId), kind);
    } catch (error: any) {
      if (String(error?.message || '').includes('WEBRTC_NATIVE_BUILD_REQUIRED')) {
        offerNativeCallFallback(navigation, t, '/chat');
        return;
      }
      Alert.alert(t('mobile.callUnavailable'), error?.message || t('mobile.callUnavailable'));
    }
  };

  const renameRoom = async () => {
    const name = renameDraft.trim();
    if (!roomId || !name) return;
    try {
      await api.renameChatRoom(roomId, name);
      setRoomName(name);
      setRenameOpen(false);
      Alert.alert(t('chat.title'), t('chat.roomRenamed'));
    } catch {
      Alert.alert(t('chat.title'), t('chat.renameRoomFailed'));
    }
  };

  const inviteMembers = async () => {
    if (!roomId || inviteIds.length === 0 || inviteBusy) return;
    setInviteBusy(true);
    try {
      await api.inviteRoomMembers(roomId, inviteIds);
      setMemberIds((prev) => [...new Set([...prev, ...inviteIds])]);
      setInviteOpen(false);
      setInviteIds([]);
      Alert.alert(t('chat.title'), t('chat.membersInvited'));
    } catch {
      Alert.alert(t('chat.title'), t('chat.inviteMembersFailed'));
    } finally {
      setInviteBusy(false);
    }
  };

  const leaveActiveRoom = () => {
    Alert.alert(t('chat.leaveRoom'), t('chat.roomFallback'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.leaveRoom'),
        style: 'destructive',
        onPress: async () => {
          if (!roomId) return;
          try {
            await api.leaveChatRoom(roomId);
            navigation.goBack();
          } catch {
            Alert.alert(t('chat.title'), t('chat.leaveRoomFailed'));
          }
        },
      },
    ]);
  };

  const showRoomMenu = () => {
    Alert.alert(roomName || t('chat.roomFallback'), undefined, [
      {
        text: t('chat.renameRoom'),
        onPress: () => {
          setRenameDraft(roomName);
          setRenameOpen(true);
        },
      },
      {
        text: t('chat.inviteMembers'),
        onPress: () => {
          setInviteOpen(true);
          void api.getChatFriends().then((res) => setFriends(asChatList<ChatFriend>(res.friends)));
        },
      },
      { text: t('chat.leaveRoom'), style: 'destructive', onPress: leaveActiveRoom },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  useEffect(() => {
    if (roomId) {
      void fetchMessages();
      void fetchRoomMeta();
    }
  }, [roomId, fetchMessages, fetchRoomMeta]);

  useEffect(() => {
    if (paramRoomName) setRoomName(paramRoomName);
  }, [paramRoomName]);

  useEffect(() => {
    if (!isExpired || !roomId) {
      setRecap(null);
      return;
    }
    let cancelled = false;
    setRecapLoading(true);
    void api
      .getRoomRecap(roomId)
      .then((data) => {
        if (!cancelled) setRecap(data as RoomRecap);
      })
      .catch(() => {
        if (!cancelled) setRecap(null);
      })
      .finally(() => {
        if (!cancelled) setRecapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isExpired, roomId]);

  useEffect(() => {
    if (!isStageRoom || !roomId) return;
    void fetchStageState();
    const timer = setInterval(() => {
      void fetchStageState();
    }, 5000);
    return () => clearInterval(timer);
  }, [isStageRoom, roomId, fetchStageState]);

  useEffect(() => {
    if (!signalConnected || !roomId) return;
    joinRoom(Number(roomId));
    return () => {
      leaveRoom(Number(roomId));
    };
  }, [signalConnected, roomId, joinRoom, leaveRoom]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick((n) => n + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const socket = createReconnectingWebSocket({
      url: () => resolveWsUrl('room', { room_id: roomId }),
      onOpen: () => setWsConnected(true),
      onClose: () => setWsConnected(false),
      onMessage: (data) => {
        if (data.type === 'room.message') {
          appendMessage(wsPayloadToRoomMessage(data, userRef.current));
        } else if (data.type === 'room.message_edited') {
          const updated = wsPayloadToRoomMessage(data, userRef.current);
          setMessages((prev) => prev.map((m) => (String(m.id) === String(updated.id) ? updated : m)));
        } else if (data.type === 'room.message_deleted' && data.id != null) {
          setMessages((prev) =>
            prev.map((m) => (String(m.id) === String(data.id) ? { ...m, is_deleted: true, text: '' } : m)),
          );
        } else if (data.type === 'room.typing') {
          if (String(data.user_id) !== String(userRef.current?.id)) {
            setPeerTyping(Boolean(data.is_typing));
          }
        }
      },
    });

    wsRef.current = socket;
    return () => {
      wsRef.current = null;
      socket.close();
      setWsConnected(false);
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [roomId, appendMessage]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return t('common.today');
    if (days === 1) return t('common.yesterday');
    if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const visibleMessages = useMemo(() => {
    const live = messages.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now());
    const q = searchQuery.trim().toLowerCase();
    if (!q) return live;
    return live.filter((m) => !m.is_deleted && m.text.toLowerCase().includes(q));
  }, [messages, searchQuery, nowTick]);

  const inviteCandidates = friends.filter((f) => !memberIds.includes(Number(f.id)));
  const speakersCount = stageState?.speakers_count ?? stageState?.speakers?.length ?? 0;
  const listenersCount = stageState?.listeners_count ?? stageState?.listeners?.length ?? 0;
  const joinedStage = !!stageState?.joined;

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={C.brownDk} />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.cream }}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={{ flex: 1, flexDirection: 'column' }}>
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.line }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: C.text }]} numberOfLines={1}>
              {roomName || t('chat.roomFallback')}
            </Text>
            <Text style={[styles.headerStatus, { color: peerTyping ? C.brown : wsConnected ? C.online : C.text2 }]}>
              {peerTyping
                ? t('chat.someoneTyping')
                : isPromptRoom
                  ? t('chat.promptRoomOrbit')
                  : wsConnected
                    ? t('chat.groupRoom')
                    : t('chat.reconnecting')}
            </Text>
          </View>
          {!groupCall.active ? (
            <>
              <TouchableOpacity style={styles.headerAction} onPress={() => void startRoomCall('audio')}>
                <Ionicons name="call-outline" size={20} color={C.brownDk} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerAction} onPress={() => void startRoomCall('video')}>
                <Ionicons name="videocam-outline" size={20} color={C.brownDk} />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => {
              setSearchOpen((v) => {
                if (v) setSearchQuery('');
                return !v;
              });
            }}
          >
            <Ionicons name="search" size={20} color={searchOpen || searchQuery ? C.brown : C.text2} />
          </TouchableOpacity>
          {!isPromptRoom ? (
            <TouchableOpacity style={styles.headerAction} onPress={showRoomMenu}>
              <Ionicons name="ellipsis-vertical" size={20} color={C.text2} />
            </TouchableOpacity>
          ) : null}
        </View>

        {searchOpen ? (
          <View style={[styles.searchBar, { backgroundColor: C.card, borderBottomColor: C.line }]}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('chat.searchInConversationPlaceholder')}
              placeholderTextColor={C.text2}
              autoFocus
              style={[styles.searchInput, { color: C.text, backgroundColor: C.card2, borderColor: C.line }]}
            />
            {searchQuery.trim() ? (
              <Text style={[styles.searchMeta, { color: C.text2 }]}>
                {visibleMessages.length === 1
                  ? t('chat.matchCount', { count: visibleMessages.length })
                  : t('chat.matchesCount', { count: visibleMessages.length })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {questionText ? (
          <View style={[styles.promptBanner, { backgroundColor: C.card, borderBottomColor: C.line }]}>
            <Text style={[styles.promptTitle, { color: C.text }]}>{questionText}</Text>
            {questionCategory ? (
              <Text style={[styles.promptCat, { color: C.text2, backgroundColor: C.card2 }]}>{questionCategory}</Text>
            ) : null}
          </View>
        ) : null}

        {isExpired ? (
          <View style={[styles.recapBanner, { backgroundColor: C.card2, borderBottomColor: C.line }]}>
            <Text style={[styles.promptTitle, { color: C.text }]}>{t('chat.roomExpiredRecapHint')}</Text>
            {recapLoading ? (
              <Text style={{ color: C.text2, marginTop: 4 }}>{t('chat.recapLoading')}</Text>
            ) : recap ? (
              <>
                <Text style={{ color: C.text2, marginTop: 4 }}>
                  {t('chat.recapParticipants', { count: recap.participant_count ?? 0 })}
                  {' · '}
                  {t('chat.recapMessages', { count: recap.message_count ?? 0 })}
                  {' · '}
                  {t('chat.recapDuration', { minutes: recap.duration_minutes ?? 0 })}
                </Text>
                {recap.summary ? <Text style={{ color: C.text, marginTop: 6 }}>{recap.summary}</Text> : null}
              </>
            ) : (
              <Text style={{ color: C.text2, marginTop: 4 }}>{t('chat.recapUnavailable')}</Text>
            )}
          </View>
        ) : null}

        {isStageRoom ? (
          <View style={[styles.stageBar, { backgroundColor: C.card, borderBottomColor: C.line }]}>
            <View style={styles.stageStats}>
              <Text style={[styles.stageTitle, { color: C.text }]}>
                {channelType === 'voice' ? t('chat.voiceRoom') : t('chat.stage')}
              </Text>
              <Text style={[styles.stageMeta, { color: C.text2 }]}>
                {t('chat.stageSummary', { speakers: speakersCount, listeners: listenersCount, hands: 0 })}
              </Text>
            </View>
            <View style={styles.stageActions}>
              {channelType === 'voice' ? (
                <TouchableOpacity
                  disabled={stageBusy}
                  onPress={() => void openStageVoiceCall()}
                  style={[styles.stageCallButton, { backgroundColor: C.brownDk }]}
                >
                  <Text style={styles.stageCallButtonText}>{t('chat.voiceCall')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                disabled={stageBusy}
                onPress={() => void updateStage(joinedStage ? 'leave' : 'join')}
                style={[styles.stageButton, { backgroundColor: joinedStage ? C.card2 : C.brownDk }]}
              >
                <Text style={[styles.stageButtonText, { color: joinedStage ? C.text : '#fff' }]}>
                  {joinedStage ? t('chat.stageLeave') : t('chat.stageJoin')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={stageBusy}
                onPress={() => void updateStage('raise_hand')}
                style={[styles.stageButton, { backgroundColor: stageState?.hand_raised ? C.brown : C.card2 }]}
              >
                <Text style={[styles.stageButtonText, { color: C.text }]}>{t('chat.stageRaiseHand')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={stageBusy}
                onPress={() => void updateStage('speak')}
                style={[styles.stageButton, { backgroundColor: stageState?.is_speaker ? C.brownDk : C.card2 }]}
              >
                <Text style={[styles.stageButtonText, { color: stageState?.is_speaker ? '#fff' : C.text }]}>
                  {t('chat.stageSpeak')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => {
            const isOwn = String(item.sender.id) === String(user?.id);
            const showDate =
              index === 0 || formatDate(visibleMessages[index - 1]?.created_at) !== formatDate(item.created_at);
            return (
              <View style={styles.messageContainer}>
                {showDate ? (
                  <View style={styles.dateSeparator}>
                    <View style={[styles.dateLine, { backgroundColor: C.line }]} />
                    <Text style={[styles.dateText, { color: C.text2 }]}>{formatDate(item.created_at)}</Text>
                    <View style={[styles.dateLine, { backgroundColor: C.line }]} />
                  </View>
                ) : null}
                <View style={[styles.messageWrapper, isOwn && styles.messageOwn]}>
                  {!isOwn ? (
                    <View style={styles.avatarSpacer}>
                      {item.sender.avatar ? (
                        <Image source={{ uri: item.sender.avatar }} style={styles.messageAvatar} />
                      ) : (
                        <View style={[styles.messageAvatar, styles.avatarPlaceholder, { backgroundColor: C.brownDk }]}>
                          <Text style={styles.avatarText}>{item.sender.username?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                  <View style={{ maxWidth: '82%' }}>
                    <ChatBubble
                      item={item}
                      isOwn={isOwn}
                      isRoom
                      C={C}
                      t={t}
                      onLongPress={() => setActionMessage(item)}
                    />
                    <View style={[styles.messageMeta, isOwn && styles.messageMetaOwn]}>
                      <Text style={[styles.messageTime, { color: C.text2 }]}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => {
            if (!searchQuery) flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <Text style={[styles.emptyThread, { color: C.text2 }]}>
              {searchQuery.trim() ? t('chat.noSearchMatches') : t('chat.startConversation')}
            </Text>
          }
        />

        {actionMessage ? (
          <ChatActions
            item={actionMessage}
            isOwn={String(actionMessage.sender.id) === String(user?.id)}
            C={C}
            t={t}
            busy={actionBusy}
            onClose={() => setActionMessage(null)}
            onReply={() => {
              setReplyTo(actionMessage);
              setEditingId(null);
              setActionMessage(null);
            }}
            onPin={() => void handlePinMessage(actionMessage)}
            onReact={(emoji) => void handleReactMessage(actionMessage, emoji)}
            onEdit={
              String(actionMessage.sender.id) === String(user?.id)
                ? () => {
                    setEditingId(actionMessage.id);
                    setNewMessage(actionMessage.text);
                    setReplyTo(null);
                    setActionMessage(null);
                  }
                : undefined
            }
            onDelete={
              String(actionMessage.sender.id) === String(user?.id)
                ? () => handleDeleteMessage(actionMessage)
                : undefined
            }
          />
        ) : null}

        {peerTyping && !actionMessage ? (
          <Text style={[styles.typingLine, { color: C.text2 }]}>{t('chat.someoneTyping')}</Text>
        ) : null}

        {isExpired ? (
          <View style={[styles.expiredBar, { backgroundColor: C.card, borderTopColor: C.line }]}>
            <Text style={{ color: C.text2, textAlign: 'center' }}>{t('chat.roomExpired')}</Text>
          </View>
        ) : (
          <ChatComposer
            C={C}
            t={t}
            value={newMessage}
            onChange={emitTyping}
            onSend={() => void sendMessage()}
            sending={sending}
            vanishSeconds={vanishSeconds}
            onVanish={setVanishSeconds}
            onAttach={() => void attachImage()}
            onMood={(key) => {
              setMoodIcon(key);
              void api.pingChatPresence({ mood_icon: key });
            }}
            moodIcon={moodIcon}
            replyName={
              editingId
                ? t('chat.edit')
                : replyTo
                  ? String(replyTo.sender.id) === String(user?.id)
                    ? t('chat.you')
                    : replyTo.sender.display_name || replyTo.sender.username
                  : undefined
            }
            replyText={editingId ? newMessage : replyTo?.text}
            onCancelReply={() => {
              setReplyTo(null);
              if (editingId) {
                setEditingId(null);
                setNewMessage('');
              }
            }}
            onSchedule={(hours) => void scheduleMessage(hours)}
            scheduleBusy={scheduleBusy}
            uploading={uploading}
          />
        )}

        {groupCall.active ? (
          <GroupCallOverlay
            roomName={roomName || t('chat.groupCallFallback')}
            callKind={groupCall.callKind}
            muted={groupCall.muted}
            peers={groupCall.peers}
            localStreamUrl={groupCall.localStreamUrl}
            onHangUp={groupCall.leaveGroupCall}
            onToggleMute={groupCall.toggleMute}
          />
        ) : null}

        <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
            <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={() => setRenameOpen(false)} />
            <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>{t('chat.renameRoomTitle')}</Text>
              <TextInput
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder={t('chat.roomNamePlaceholder')}
                placeholderTextColor={C.text2}
                style={[styles.modalInput, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setRenameOpen(false)} style={[styles.modalBtn, { backgroundColor: C.card }]}>
                  <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void renameRoom()}
                  disabled={!renameDraft.trim()}
                  style={[styles.modalBtn, { backgroundColor: C.brownDk, opacity: renameDraft.trim() ? 1 : 0.55 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{t('chat.renameRoom')}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
            <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={() => setInviteOpen(false)} />
            <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line, maxHeight: '70%' }]}>
              <Text style={[styles.modalTitle, { color: C.text }]}>{t('chat.inviteMembers')}</Text>
              <ScrollView style={{ maxHeight: 280 }}>
                {inviteCandidates.length === 0 ? (
                  <Text style={{ color: C.text2 }}>{t('chat.noFriendsFound')}</Text>
                ) : (
                  inviteCandidates.map((friend) => {
                    const selected = inviteIds.includes(Number(friend.id));
                    return (
                      <Pressable
                        key={friend.id}
                        onPress={() =>
                          setInviteIds((prev) =>
                            selected ? prev.filter((id) => id !== Number(friend.id)) : [...prev, Number(friend.id)],
                          )
                        }
                        style={[styles.inviteRow, { backgroundColor: selected ? C.card : 'transparent' }]}
                      >
                        <Text style={{ color: C.text, flex: 1 }}>{friend.name || friend.username}</Text>
                        <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={20} color={C.brownDk} />
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setInviteOpen(false)} style={[styles.modalBtn, { backgroundColor: C.card }]}>
                  <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void inviteMembers()}
                  disabled={inviteBusy || inviteIds.length === 0}
                  style={[
                    styles.modalBtn,
                    { backgroundColor: C.brownDk, opacity: inviteBusy || inviteIds.length === 0 ? 0.55 : 1 },
                  ]}
                >
                  {inviteBusy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{t('chat.inviteLabel')}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: { padding: 8 },
  headerInfo: { flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerStatus: { fontSize: 12, fontWeight: '500' },
  headerAction: { padding: 8 },
  searchBar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
  searchMeta: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  promptBanner: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  promptTitle: { fontSize: 14, fontWeight: '700' },
  promptCat: {
    alignSelf: 'flex-start',
    marginTop: 6,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recapBanner: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  stageBar: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  stageStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stageTitle: { fontSize: 14, fontWeight: '800' },
  stageMeta: { fontSize: 12, fontWeight: '600' },
  stageActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageCallButton: { width: '100%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center' },
  stageCallButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  stageButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  stageButtonText: { fontSize: 12, fontWeight: '800' },
  listContent: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },
  messageContainer: { marginBottom: 8 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  dateLine: { flex: 1, height: 1 },
  dateText: { paddingHorizontal: 12, fontSize: 12, fontWeight: '600' },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  messageOwn: { flexDirection: 'row-reverse' },
  avatarSpacer: { width: 36, marginRight: 8, marginBottom: 4 },
  messageAvatar: { width: 28, height: 28, borderRadius: 14 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  messageMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 4 },
  messageMetaOwn: { justifyContent: 'flex-end' },
  messageTime: { fontSize: 11, fontWeight: '500' },
  typingLine: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 6 },
  emptyThread: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },
  expiredBar: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  modalBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minWidth: 88, alignItems: 'center' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10 },
});
