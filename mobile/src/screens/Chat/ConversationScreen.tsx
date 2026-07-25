import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, TextInput, Image, KeyboardAvoidingView, Platform, Pressable, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { createReconnectingWebSocket, resolveWsUrl, type WsChatPayload } from '@/api/ws';
import { mediaUrl } from '@/api/config';
import { User } from '@/types';
import { CallOverlay } from '@/components/CallOverlay';
import { useSignalWebSocket, type SignalPayload } from '@/hooks/useSignalWebSocket';
import { useWebRTCCall, type CallKind } from '@/hooks/useWebRTCCall';

interface ConversationScreenProps {
  route: { params?: { conversationId?: string; otherUser?: User } };
  navigation: any;
}

const CHAT_REACTS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✨'] as const;

interface MessageItem {
  id: string | number;
  sender: User;
  content: string;
  text: string;
  is_read: boolean;
  is_pinned?: boolean;
  reaction_counts?: Record<string, number>;
  my_reaction?: string | null;
  created_at: string;
}

function normalizeMessage(
  raw: Record<string, unknown>,
  self?: User | null,
  peer?: User | null,
): MessageItem {
  const senderId = (raw.sender as User | undefined)?.id ?? raw.sender_id;
  let sender: User;
  const existing = raw.sender as User | undefined;
  if (existing?.username) {
    sender = existing;
  } else if (self && String(senderId) === String(self.id)) {
    sender = self;
  } else if (peer && String(senderId) === String(peer.id)) {
    sender = peer;
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
    is_read: Boolean(raw.is_read),
    is_pinned: Boolean(raw.is_pinned),
    reaction_counts: (raw.reaction_counts as Record<string, number> | undefined) ?? undefined,
    my_reaction: (raw.my_reaction as string | null | undefined) ?? null,
    created_at: String(raw.created_at),
  };
}

function wsPayloadToMessage(data: WsChatPayload, self?: User | null, peer?: User | null): MessageItem {
  return normalizeMessage(data as unknown as Record<string, unknown>, self, peer);
}

export default function ConversationScreen({ route, navigation }: ConversationScreenProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { conversationId, otherUser: paramUser } = route.params || {};
  
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<User | null>(paramUser || null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [wsConnected, setWsConnected] = useState(false);
  const [actionMessage, setActionMessage] = useState<MessageItem | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null);
  const otherUserRef = useRef(otherUser);
  const userRef = useRef(user);
  const callSignalHandlerRef = useRef<(payload: SignalPayload) => void>(() => {});

  const { connected: signalConnected, sendSignal } = useSignalWebSocket({
    enabled: !!user?.id,
    onSignal: (payload) => callSignalHandlerRef.current(payload),
  });
  const call = useWebRTCCall(Number(user?.id || 0), sendSignal, () => {
    Alert.alert('Call ended');
  });

  useEffect(() => {
    callSignalHandlerRef.current = call.handleSignal;
  }, [call.handleSignal]);

  useEffect(() => {
    otherUserRef.current = otherUser;
  }, [otherUser]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const appendMessage = useCallback((msg: MessageItem) => {
    setMessages((prev) => {
      if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
      return [...prev, msg];
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await api.getMessages(conversationId);
      const newMessages = (response.messages || []).map((m: any) =>
        normalizeMessage(m, userRef.current, otherUserRef.current),
      );
      setMessages(newMessages);
      setHasMore(false);
      if (response.peer) {
        setOtherUser({
          ...(response.peer as User),
          display_name: (response.peer as any).name || (response.peer as User).username,
        });
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !conversationId) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const sentViaWs = wsRef.current?.send({ type: 'chat.send', text: content });
      if (!sentViaWs) {
        const created = await api.sendMessage(conversationId, content);
        appendMessage(normalizeMessage(created, user, otherUser));
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const scheduleMessage = async (hours: number) => {
    if (!newMessage.trim() || scheduleBusy || !conversationId) return;
    const content = newMessage.trim();
    setScheduleBusy(true);
    try {
      const sendAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await api.scheduleConversationMessage(conversationId, { text: content, send_at: sendAt });
      setNewMessage('');
      Alert.alert('Scheduled', `Message will send in ${hours}h.`);
    } catch (error) {
      console.error('Failed to schedule message:', error);
      Alert.alert('Error', 'Could not schedule this message.');
    } finally {
      setScheduleBusy(false);
    }
  };

  const updateMessageMeta = useCallback((messageId: string | number, patch: Partial<MessageItem>) => {
    setMessages((prev) =>
      prev.map((m) => (String(m.id) === String(messageId) ? { ...m, ...patch } : m)),
    );
    setActionMessage((prev) =>
      prev && String(prev.id) === String(messageId) ? { ...prev, ...patch } : prev,
    );
  }, []);

  const handlePinMessage = async (item: MessageItem) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const result = await api.pinMessage(item.id);
      updateMessageMeta(item.id, { is_pinned: result.is_pinned });
    } catch (error) {
      console.error('Failed to pin message:', error);
    } finally {
      setActionBusy(false);
    }
  };

  const handleReactMessage = async (item: MessageItem, emoji: string) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      const nextEmoji = item.my_reaction === emoji ? null : emoji;
      const result = await api.reactMessage(item.id, nextEmoji);
      updateMessageMeta(item.id, {
        my_reaction: result.my_reaction,
        reaction_counts: result.reaction_counts,
      });
    } catch (error) {
      console.error('Failed to react to message:', error);
    } finally {
      setActionBusy(false);
    }
  };

  const showHeaderMenu = () => {
    Alert.alert(otherUser?.display_name || otherUser?.username || 'Conversation', undefined, [
      {
        text: isMuted ? 'Unmute' : 'Mute',
        onPress: () => void handleToggleMute(),
      },
      {
        text: isArchived ? 'Unarchive' : 'Archive',
        onPress: () => void handleToggleArchive(),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const startPeerCall = (kind: CallKind) => {
    const peerId = Number(otherUser?.id);
    if (!peerId || !user?.id) {
      Alert.alert('Call unavailable', 'Peer details are still loading.');
      return;
    }
    if (!signalConnected) {
      Alert.alert('Call unavailable', 'Realtime signaling is still connecting.');
      return;
    }
    const displayName = user.display_name || user.username || 'Cosmory';
    void call.startCall(peerId, kind, displayName, user.avatar || null).catch((error) => {
      Alert.alert('Call unavailable', error?.message || 'Could not start this call.');
    });
  };

  const showCallMenu = () => {
    Alert.alert('Start call', otherUser?.display_name || otherUser?.username || 'Friend', [
      { text: 'Voice call', onPress: () => startPeerCall('audio') },
      { text: 'Video call', onPress: () => startPeerCall('video') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleToggleMute = async () => {
    if (!conversationId) return;
    const next = !isMuted;
    try {
      await api.muteConversation(conversationId, next);
      setIsMuted(next);
    } catch (error) {
      console.error('Failed to mute conversation:', error);
    }
  };

  const handleToggleArchive = async () => {
    if (!conversationId) return;
    const next = !isArchived;
    try {
      await api.archiveConversation(conversationId, next);
      setIsArchived(next);
      if (next) navigation.goBack();
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const handleLoadMore = () => {
    // Conversation messages endpoint returns the full thread in one payload.
  };

  useEffect(() => {
    if (!conversationId) return;
    void (async () => {
      try {
        const rows = (await api.getConversations()) as Array<{
          id?: string | number;
          is_muted?: boolean;
          is_archived?: boolean;
        }>;
        const match = rows.find((c) => String(c.id) === String(conversationId));
        if (match) {
          setIsMuted(Boolean(match.is_muted));
          setIsArchived(Boolean(match.is_archived));
        }
      } catch {
        /* ignore — menu still works with local defaults */
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
    }
  }, [conversationId, fetchMessages]);

  useEffect(() => {
    if (paramUser) setOtherUser(paramUser);
  }, [paramUser]);

  useEffect(() => {
    if (!conversationId) return;

    const socket = createReconnectingWebSocket({
      url: () => resolveWsUrl('chat', { conversation_id: conversationId }),
      onOpen: () => setWsConnected(true),
      onClose: () => setWsConnected(false),
      onMessage: (data) => {
        if (data.type === 'chat.message') {
          appendMessage(wsPayloadToMessage(data, userRef.current, otherUserRef.current));
        } else if (data.type === 'chat.message_edited') {
          const updated = wsPayloadToMessage(data, userRef.current, otherUserRef.current);
          setMessages((prev) =>
            prev.map((m) => (String(m.id) === String(updated.id) ? updated : m)),
          );
        } else if (data.type === 'chat.message_deleted' && data.id != null) {
          setMessages((prev) => prev.filter((m) => String(m.id) !== String(data.id)));
        } else if (data.type === 'chat.read' && data.message_id != null) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id) === String(data.message_id) ? { ...m, is_read: true } : m,
            ),
          );
        }
      },
    });

    wsRef.current = socket;
    return () => {
      wsRef.current = null;
      socket.close();
      setWsConnected(false);
    };
  }, [conversationId, appendMessage]);

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
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile', { username: otherUser?.username })} style={styles.headerUser}>
            {otherUser?.avatar ? (
              <Image source={{ uri: otherUser.avatar }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{otherUser?.username?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={styles.headerUserInfo}>
              <Text style={[styles.headerUserName, { color: colors.text }]}>{otherUser?.display_name || otherUser?.username || 'Loading...'}</Text>
              <Text style={[styles.headerUserStatus, { color: wsConnected ? colors.primary : colors.textSecondary }]}>
                {wsConnected ? 'Connected' : 'Reconnecting…'}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction} onPress={showCallMenu}>
            <Text style={{ fontSize: 19 }}>☎</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction} onPress={showHeaderMenu}>
            <Text style={{ fontSize: 22 }}>⋮</Text>
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item, index }) => {
            const isOwn = item.sender.id === user?.id;
            const showDate = index === 0 || formatDate(messages[index - 1]?.created_at) !== formatDate(item.created_at);
            
            return (
              <View style={styles.messageContainer}>
                {showDate && (
                  <View style={styles.dateSeparator}>
                    <View style={styles.dateLine} />
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
                    <View style={styles.dateLine} />
                  </View>
                )}
                <View style={[styles.messageWrapper, isOwn && styles.messageOwn]}>
                  {!isOwn && (
                    <View style={styles.avatarSpacer}>
                      {otherUser?.avatar ? (
                        <Image source={{ uri: otherUser.avatar }} style={styles.messageAvatar} />
                      ) : (
                        <View style={[styles.messageAvatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                          <Text style={styles.avatarText}>{otherUser?.username?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <Pressable
                    onLongPress={() => setActionMessage(item)}
                    delayLongPress={350}
                    style={[styles.messageBubble, isOwn ? styles.messageOwnBubble : styles.messageOtherBubble, { backgroundColor: isOwn ? colors.primary : colors.surfaceSecondary }]}
                  >
                    {item.is_pinned && (
                      <Text style={[styles.pinnedBadge, { color: isOwn ? '#fff' : colors.textSecondary }]}>📌 Pinned</Text>
                    )}
                    <Text style={[styles.messageText, { color: isOwn ? '#fff' : colors.text }]}>{item.text}</Text>
                    {item.reaction_counts && Object.keys(item.reaction_counts).length > 0 && (
                      <View style={styles.reactionRow}>
                        {Object.entries(item.reaction_counts).map(([emoji, count]) => (
                          <View
                            key={emoji}
                            style={[
                              styles.reactionChip,
                              { backgroundColor: item.my_reaction === emoji ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)' },
                            ]}
                          >
                            <Text style={[styles.reactionChipText, { color: isOwn ? '#fff' : colors.text }]}>
                              {emoji} {Number(count)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </Pressable>
                  <View style={styles.messageMeta}>
                    <Text style={[styles.messageTime, { color: colors.textSecondary }]}>{formatTime(item.created_at)}</Text>
                    {isOwn && item.is_read && <Text style={[styles.readReceipt, { color: colors.primary }]}>✓✓</Text>}
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          inverted={true}
          ListFooterComponent={
            hasMore && !loading ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />

        {/* Message actions (long-press) */}
        {actionMessage && (
          <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={styles.actionBarHeader}>
              <Text style={[styles.actionBarTitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {actionMessage.text.slice(0, 48)}{actionMessage.text.length > 48 ? '…' : ''}
              </Text>
              <TouchableOpacity onPress={() => setActionMessage(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.background }]}
                onPress={() => void handlePinMessage(actionMessage)}
                disabled={actionBusy}
              >
                <Text style={[styles.actionButtonText, { color: colors.text }]}>
                  {actionMessage.is_pinned ? '📌 Unpin' : '📌 Pin'}
                </Text>
              </TouchableOpacity>
              {CHAT_REACTS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[
                    styles.actionEmoji,
                    { backgroundColor: actionMessage.my_reaction === emoji ? colors.primary : colors.background },
                  ]}
                  onPress={() => void handleReactMessage(actionMessage, emoji)}
                  disabled={actionBusy}
                >
                  <Text style={styles.actionEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input */}
        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {newMessage.trim() ? (
            <View style={styles.scheduleRow}>
              <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>Send later</Text>
              {[1, 3, 24].map((hours) => (
                <TouchableOpacity
                  key={hours}
                  onPress={() => void scheduleMessage(hours)}
                  disabled={scheduleBusy || sending}
                  style={[styles.scheduleChip, { borderColor: colors.border, opacity: scheduleBusy || sending ? 0.5 : 1 }]}
                >
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{hours}h</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
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

        {call.incoming ? (
          <CallOverlay
            mode="incoming"
            callKind={call.callKind}
            incoming={call.incoming}
            peerName={otherUser?.display_name || otherUser?.username || 'Friend'}
            peerAvatar={otherUser?.avatar || null}
            muted={call.muted}
            localStreamUrl={call.localStreamUrl}
            remoteStreamUrl={call.remoteStreamUrl}
            onAccept={() => void call.acceptCall()}
            onReject={call.rejectCall}
            onHangUp={call.hangUp}
            onToggleMute={call.toggleMute}
          />
        ) : call.callActive ? (
          <CallOverlay
            mode="active"
            callKind={call.callKind}
            peerName={otherUser?.display_name || otherUser?.username || 'Friend'}
            peerAvatar={otherUser?.avatar || null}
            muted={call.muted}
            localStreamUrl={call.localStreamUrl}
            remoteStreamUrl={call.remoteStreamUrl}
            onAccept={() => {}}
            onReject={call.rejectCall}
            onHangUp={call.hangUp}
            onToggleMute={call.toggleMute}
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
  headerUser: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 8 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  headerUserInfo: { flex: 1 },
  headerUserName: { fontSize: 16, fontWeight: '700' },
  headerUserStatus: { fontSize: 12, fontWeight: '500' },
  headerAction: { padding: 8 },
  listContent: { paddingHorizontal: 12, paddingVertical: 16 },
  messageContainer: { marginBottom: 8 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  dateLine: { flex: 1, height: 1 },
  dateText: { paddingHorizontal: 12, fontSize: 12, fontWeight: '600' },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  messageOwn: { flexDirection: 'row-reverse' },
  avatarSpacer: { width: 36, marginRight: 8, marginBottom: 4 },
  messageAvatar: { width: 28, height: 28, borderRadius: 14 },
  messageBubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  messageOwnBubble: { borderBottomRightRadius: 4 },
  messageOtherBubble: { borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  pinnedBadge: { fontSize: 10, fontWeight: '600', marginBottom: 4, opacity: 0.85 },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactionChip: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  reactionChipText: { fontSize: 12 },
  actionBar: { paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionBarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  actionBarTitle: { flex: 1, fontSize: 12, marginRight: 8 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  actionButtonText: { fontSize: 13, fontWeight: '600' },
  actionEmoji: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  actionEmojiText: { fontSize: 18 },
  messageMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 8 },
  messageTime: { fontSize: 11, fontWeight: '500' },
  readReceipt: { fontSize: 11, marginLeft: 4 },
  inputContainer: { paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  scheduleLabel: { fontSize: 12, fontWeight: '800' },
  scheduleChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, fontSize: 16, minHeight: 40, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 8 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  loadMore: { padding: 20, alignItems: 'center' },
});