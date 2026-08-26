import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { createReconnectingWebSocket, resolveWsUrl, type WsChatPayload } from '@/api/ws';
import { mediaUrl } from '@/api/config';
import { User } from '@/types';
import { GroupCallOverlay } from '@/components/GroupCallOverlay';
import { useGroupCall } from '@/hooks/useGroupCall';
import { useSignalWebSocket, type SignalPayload } from '@/hooks/useSignalWebSocket';

interface RoomScreenProps {
  route: {
    params?: {
      roomId?: string | number;
      roomName?: string;
      channelType?: 'text' | 'voice' | 'stage';
      stage?: boolean;
    };
  };
  navigation: any;
}

interface RoomMessageItem {
  id: string | number;
  sender: User;
  text: string;
  content: string;
  is_pinned?: boolean;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  created_at: string;
}

type StageState = {
  speakers_count?: number;
  listeners_count?: number;
  speakers?: unknown[];
  listeners?: unknown[];
  hand_raised?: boolean;
  is_speaker?: boolean;
  joined?: boolean;
};

function normalizeRoomMessage(raw: Record<string, unknown>, self?: User | null): RoomMessageItem {
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
    text: String(raw.text ?? raw.content ?? ''),
    content: String(raw.text ?? raw.content ?? ''),
    is_pinned: Boolean(raw.is_pinned),
    reaction_counts: (raw.reaction_counts as Record<string, number> | undefined) ?? undefined,
    my_reaction: (raw.my_reaction as string | null | undefined) ?? null,
    created_at: String(raw.created_at),
  };
}

function wsPayloadToRoomMessage(data: WsChatPayload, self?: User | null): RoomMessageItem {
  return normalizeRoomMessage(data as unknown as Record<string, unknown>, self);
}

export default function RoomScreen({ route, navigation }: RoomScreenProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { roomId, roomName: paramRoomName, channelType, stage } = route.params || {};
  const isStageRoom = channelType === 'voice' || channelType === 'stage' || !!stage;

  const [messages, setMessages] = useState<RoomMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [roomName, setRoomName] = useState(paramRoomName || '');
  const [wsConnected, setWsConnected] = useState(false);
  const [stageState, setStageState] = useState<StageState | null>(null);
  const [stageBusy, setStageBusy] = useState(false);

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

  const appendMessage = useCallback((msg: RoomMessageItem) => {
    setMessages((prev) => {
      if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
      return [...prev, msg];
    });
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

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !roomId) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const sentViaWs = wsRef.current?.send({ type: 'room.send', text: content });
      if (!sentViaWs) {
        const created = await api.sendRoomMessage(roomId, content);
        appendMessage(normalizeRoomMessage(created, user));
      }
    } catch (error) {
      console.error('Failed to send room message:', error);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
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

  const startRoomCall = async () => {
    if (!roomId) return;
    if (!signalConnected) {
      Alert.alert('Call unavailable', 'Realtime signaling is still connecting.');
      return;
    }
    try {
      await groupCall.joinGroupCall(Number(roomId), 'audio');
    } catch (error: any) {
      Alert.alert('Call unavailable', error?.message || 'Could not start this room call.');
    }
  };

  useEffect(() => {
    if (roomId) fetchMessages();
  }, [roomId, fetchMessages]);

  useEffect(() => {
    if (paramRoomName) setRoomName(paramRoomName);
  }, [paramRoomName]);

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
          setMessages((prev) =>
            prev.map((m) => (String(m.id) === String(updated.id) ? updated : m)),
          );
        } else if (data.type === 'room.message_deleted' && data.id != null) {
          setMessages((prev) => prev.filter((m) => String(m.id) !== String(data.id)));
        }
      },
    });

    wsRef.current = socket;
    return () => {
      wsRef.current = null;
      socket.close();
      setWsConnected(false);
    };
  }, [roomId, appendMessage]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / 86400000);

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const speakersCount = stageState?.speakers_count ?? stageState?.speakers?.length ?? 0;
  const listenersCount = stageState?.listeners_count ?? stageState?.listeners?.length ?? 0;
  const joinedStage = !!stageState?.joined;

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={{ flex: 1, flexDirection: 'column' }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {roomName || 'Room'}
            </Text>
            <Text style={[styles.headerStatus, { color: wsConnected ? colors.primary : colors.textSecondary }]}>
              {wsConnected ? 'Connected' : 'Reconnecting…'}
            </Text>
          </View>
        </View>

        {isStageRoom ? (
          <View style={[styles.stageBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.stageStats}>
              <Text style={[styles.stageTitle, { color: colors.text }]}>
                {channelType === 'voice' ? 'Voice room' : 'Stage room'}
              </Text>
              <Text style={[styles.stageMeta, { color: colors.textSecondary }]}>
                {speakersCount} speakers · {listenersCount} listeners
              </Text>
            </View>
            <View style={styles.stageActions}>
              {channelType === 'voice' ? (
                <TouchableOpacity
                  disabled={stageBusy}
                  onPress={() => void openStageVoiceCall()}
                  style={[styles.stageCallButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.stageCallButtonText}>Voice call — open Stage channel</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                disabled={stageBusy}
                onPress={() => void updateStage(joinedStage ? 'leave' : 'join')}
                style={[styles.stageButton, { backgroundColor: joinedStage ? colors.surfaceSecondary : colors.primary }]}
              >
                <Text style={[styles.stageButtonText, { color: joinedStage ? colors.text : '#fff' }]}>
                  {joinedStage ? 'Leave' : 'Join'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={stageBusy}
                onPress={() => void updateStage('raise_hand')}
                style={[styles.stageButton, { backgroundColor: stageState?.hand_raised ? colors.primaryLight : colors.surfaceSecondary }]}
              >
                <Text style={[styles.stageButtonText, { color: colors.text }]}>Raise hand</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={stageBusy}
                onPress={() => void updateStage('speak')}
                style={[styles.stageButton, { backgroundColor: stageState?.is_speaker ? colors.primary : colors.surfaceSecondary }]}
              >
                <Text style={[styles.stageButtonText, { color: stageState?.is_speaker ? '#fff' : colors.text }]}>Speak</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.stageBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={styles.stageStats}>
              <Text style={[styles.stageTitle, { color: colors.text }]}>Room call</Text>
              <Text style={[styles.stageMeta, { color: signalConnected ? colors.primary : colors.textSecondary }]}>
                {signalConnected ? 'Signal ready' : 'Connecting signal'}
              </Text>
            </View>
            <TouchableOpacity
              disabled={!signalConnected || groupCall.active}
              onPress={() => void startRoomCall()}
              style={[
                styles.stageCallButton,
                { backgroundColor: colors.primary, opacity: !signalConnected || groupCall.active ? 0.6 : 1 },
              ]}
            >
              <Text style={styles.stageCallButtonText}>
                {groupCall.active ? 'Call active' : 'Start call'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => {
            const isOwn = item.sender.id === user?.id;
            const showDate =
              index === 0 || formatDate(messages[index - 1]?.created_at) !== formatDate(item.created_at);

            return (
              <View style={styles.messageContainer}>
                {showDate && (
                  <View style={styles.dateSeparator}>
                    <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
                    <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
                  </View>
                )}
                <View style={[styles.messageWrapper, isOwn && styles.messageOwn]}>
                  {!isOwn && (
                    <View style={styles.avatarSpacer}>
                      {item.sender.avatar ? (
                        <Image source={{ uri: item.sender.avatar }} style={styles.messageAvatar} />
                      ) : (
                        <View style={[styles.messageAvatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                          <Text style={styles.avatarText}>{item.sender.username?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={{ maxWidth: '75%' }}>
                    {!isOwn && (
                      <Text style={[styles.senderName, { color: colors.textSecondary }]}>
                        {item.sender.display_name || item.sender.username}
                      </Text>
                    )}
                    <Pressable
                      style={[
                        styles.messageBubble,
                        isOwn ? styles.messageOwnBubble : styles.messageOtherBubble,
                        { backgroundColor: isOwn ? colors.primary : colors.surfaceSecondary },
                      ]}
                    >
                      {item.is_pinned && (
                        <Text style={[styles.pinnedBadge, { color: isOwn ? '#fff' : colors.textSecondary }]}>📌 Pinned</Text>
                      )}
                      <Text style={[styles.messageText, { color: isOwn ? '#fff' : colors.text }]}>{item.text}</Text>
                    </Pressable>
                    <View style={[styles.messageMeta, isOwn && styles.messageMetaOwn]}>
                      <Text style={[styles.messageTime, { color: colors.textSecondary }]}>{formatTime(item.created_at)}</Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          inverted
        />

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
              placeholder="Message"
              placeholderTextColor={colors.textSecondary}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={2000}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendButton, sending && styles.sendButtonDisabled, { backgroundColor: colors.primary }]}
              onPress={sendMessage}
              disabled={sending || !newMessage.trim()}
            >
              <Text style={styles.sendButtonText}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {groupCall.active ? (
          <GroupCallOverlay
            roomName={roomName || 'Room call'}
            callKind={groupCall.callKind}
            muted={groupCall.muted}
            peers={groupCall.peers}
            localStreamUrl={groupCall.localStreamUrl}
            onHangUp={groupCall.leaveGroupCall}
            onToggleMute={groupCall.toggleMute}
          />
        ) : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBack: { padding: 8 },
  headerInfo: { flex: 1, paddingHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerStatus: { fontSize: 12, fontWeight: '500' },
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
  listContent: { paddingHorizontal: 12, paddingVertical: 16 },
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
  senderName: { fontSize: 11, fontWeight: '600', marginBottom: 2, marginLeft: 4 },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  messageOwnBubble: { borderBottomRightRadius: 4 },
  messageOtherBubble: { borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  pinnedBadge: { fontSize: 10, fontWeight: '600', marginBottom: 4, opacity: 0.85 },
  messageMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 4 },
  messageMetaOwn: { justifyContent: 'flex-end' },
  messageTime: { fontSize: 11, fontWeight: '500' },
  inputContainer: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end' },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginRight: 8,
  },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
