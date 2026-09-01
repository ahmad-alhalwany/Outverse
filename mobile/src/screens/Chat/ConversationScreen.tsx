import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, TextInput, Image, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { createReconnectingWebSocket, resolveWsUrl, type WsChatPayload } from '@/api/ws';
import { mediaUrl } from '@/api/config';
import { User } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { CallOverlay } from '@/components/CallOverlay';
import { useSignalWebSocket, type SignalPayload } from '@/hooks/useSignalWebSocket';
import { useWebRTCCall, type CallKind } from '@/hooks/useWebRTCCall';
import { useLocale } from '@/i18n/LocaleProvider';
import { offerNativeCallFallback, openProfile } from '@/lib/nav';
import { hasNativeWebRTC, prepareCallMedia } from '@/lib/webrtc';
import { buildReplyQuote, useChatPalette, type ChatThreadMessage } from '@/lib/chat';
import { ChatActions, ChatBubble, ChatComposer } from './chatParts';
import * as ImagePicker from 'expo-image-picker';

interface ConversationScreenProps {
  route: { params?: { conversationId?: string; otherUser?: User } };
  navigation: any;
}

type MessageItem = ChatThreadMessage;

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

function wsPayloadToMessage(data: WsChatPayload, self?: User | null, peer?: User | null): MessageItem {
  return normalizeMessage(data as unknown as Record<string, unknown>, self, peer);
}

export default function ConversationScreen({ route, navigation }: ConversationScreenProps) {
  const { isDark } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  const C = useChatPalette(isDark);
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
  const [vanishSeconds, setVanishSeconds] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [moodIcon, setMoodIcon] = useState<'sun' | 'cloud'>('sun');
  const [nowTick, setNowTick] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<ReturnType<typeof createReconnectingWebSocket> | null>(null);
  const otherUserRef = useRef(otherUser);
  const userRef = useRef(user);
  const callSignalHandlerRef = useRef<(payload: SignalPayload) => void>(() => {});

  const { connected: signalConnected, sendSignal } = useSignalWebSocket({
    enabled: !!user?.id,
    onSignal: (payload) => callSignalHandlerRef.current(payload),
  });
  const call = useWebRTCCall(Number(user?.id || 0), sendSignal, () => {
    Alert.alert(t('chat.callEnded'));
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
    const isOwnReply = replyTo ? String(replyTo.sender.id) === String(user?.id) : false;
    const text = replyTo
      ? `${buildReplyQuote(replyTo, isOwnReply, otherUser?.display_name || otherUser?.username || '', t)}${content}`
      : content;
    setNewMessage('');
    setReplyTo(null);
    setSending(true);
    try {
      if (editingId) {
        const updated = await api.editChatMessage(editingId, content);
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
          type: 'chat.send',
          text,
          expires_in_seconds: vanishSeconds || undefined,
        });
        if (!sentViaWs) {
          const created = await api.sendMessage(conversationId, text, vanishSeconds);
          appendMessage(normalizeMessage(created, user, otherUser));
        }
      }
      wsRef.current?.send({ type: 'chat.typing', is_typing: false });
    } catch {
      setNewMessage(content);
      Alert.alert(t('chat.title'), t('chat.sendMessageFailed'));
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
      Alert.alert(t('chat.scheduleMessage'), t('chat.messageScheduled'));
    } catch (error) {
      console.error('Failed to schedule message:', error);
      Alert.alert(t('chat.title'), t('chat.scheduleFailed'));
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

  const setMood = async (key: 'sun' | 'cloud') => {
    setMoodIcon(key);
    try {
      await api.pingChatPresence({ mood_icon: key });
    } catch {
      /* ignore */
    }
  };

  const handleDeleteMessage = async (item: MessageItem) => {
    Alert.alert(t('chat.delete'), t('chat.confirmDeleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteChatMessage(item.id);
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
    if (!conversationId || uploading) return;
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
      const created = await api.uploadConversationFile(conversationId, form);
      appendMessage(normalizeMessage(created, user, otherUser));
    } catch {
      Alert.alert(t('chat.title'), t('chat.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const searchMessages = async (q: string) => {
    setSearchQuery(q);
  };

  const emitTyping = (text: string) => {
    setNewMessage(text);
    wsRef.current?.send({ type: 'chat.typing', is_typing: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      wsRef.current?.send({ type: 'chat.typing', is_typing: false });
    }, 1800);
  };

  const showHeaderMenu = () => {
    Alert.alert(otherUser?.display_name || otherUser?.username || t('chat.friendFallback'), undefined, [
      {
        text: isMuted ? t('chat.unmute') : t('chat.muteConversation'),
        onPress: () => void handleToggleMute(),
      },
      {
        text: isArchived ? t('chat.unarchive') : t('chat.archive'),
        onPress: () => void handleToggleArchive(),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const startPeerCall = (kind: CallKind) => {
    const peerId = Number(otherUser?.id);
    if (!peerId || !user?.id) {
      Alert.alert(t('mobile.callUnavailable'), t('mobile.peerLoading'));
      return;
    }
    if (!signalConnected) {
      Alert.alert(t('mobile.callUnavailable'), t('mobile.signaling'));
      return;
    }
    if (!hasNativeWebRTC()) {
      void prepareCallMedia().then(() => offerNativeCallFallback(navigation, t, '/chat'));
      return;
    }
    const displayName = user.display_name || user.username || 'Cosonova';
    void call.startCall(peerId, kind, displayName, user.avatar || null).catch((error) => {
      if (String(error?.message || '').includes('WEBRTC_NATIVE_BUILD_REQUIRED')) {
        offerNativeCallFallback(navigation, t, '/chat');
        return;
      }
      Alert.alert(t('mobile.callUnavailable'), error?.message || t('mobile.callUnavailable'));
    });
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
          setMessages((prev) =>
            prev.map((m) => (String(m.id) === String(data.id) ? { ...m, is_deleted: true, text: '' } : m)),
          );
        } else if (data.type === 'chat.read' && data.message_id != null) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id) === String(data.message_id) ? { ...m, is_read: true } : m,
            ),
          );
        } else if (data.type === 'chat.typing') {
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
  }, [conversationId, appendMessage]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick((n) => n + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!conversationId || !searchOpen) return;
    const q = searchQuery.trim();
    const timer = setTimeout(async () => {
      try {
        const response = await api.getMessages(conversationId, q ? { q } : undefined);
        setMessages((response.messages || []).map((m: Record<string, unknown>) => normalizeMessage(m, userRef.current, otherUserRef.current)));
      } catch {
        /* keep */
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [conversationId, searchOpen, searchQuery]);

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

  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now()),
    [messages, nowTick],
  );

  const peerLabel = otherUser?.display_name || otherUser?.username || t('chat.friendFallback');
  const typingLabel = t('chat.nameTyping', { name: peerLabel });

  if (loading && messages.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.cream, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
        <ActivityIndicator size="large" color={C.brown} />
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: C.cream }}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={{ flex: 1, flexDirection: 'column' }} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: C.card, borderBottomColor: C.line }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openProfile(navigation, otherUser?.username)} style={styles.headerUser}>
            {otherUser?.avatar ? (
              <Image source={{ uri: mediaUrl(otherUser.avatar) || otherUser.avatar }} style={styles.headerAvatar} />
            ) : (
              <View style={[styles.headerAvatar, styles.avatarPlaceholder, { backgroundColor: C.brown }]}>
                <Text style={styles.avatarText}>{otherUser?.username?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={styles.headerUserInfo}>
              <Text style={[styles.headerUserName, { color: C.text }]}>{peerLabel}</Text>
              <Text style={[styles.headerUserStatus, { color: peerTyping ? C.brown : wsConnected ? C.online : C.text2 }]}>
                {peerTyping ? typingLabel : wsConnected ? t('chat.connected') : t('chat.reconnecting')}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction} onPress={() => startPeerCall('audio')} accessibilityLabel={t('chat.voiceCall')}>
            <Ionicons name="call-outline" size={20} color={C.brownDk} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction} onPress={() => startPeerCall('video')} accessibilityLabel={t('chat.videoCall')}>
            <Ionicons name="videocam-outline" size={20} color={C.brownDk} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => {
              setSearchOpen((v) => {
                if (v) {
                  setSearchQuery('');
                  void fetchMessages();
                }
                return !v;
              });
            }}
            accessibilityLabel={t('chat.searchInConversation')}
          >
            <Ionicons name="search" size={20} color={searchOpen || searchQuery ? C.brown : C.text2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction} onPress={showHeaderMenu}>
            <Ionicons name="ellipsis-vertical" size={20} color={C.text2} />
          </TouchableOpacity>
        </View>

        {searchOpen ? (
          <View style={[styles.searchBar, { backgroundColor: C.card, borderBottomColor: C.line }]}>
            <TextInput
              value={searchQuery}
              onChangeText={searchMessages}
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

        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, index }) => {
            const isOwn = String(item.sender.id) === String(user?.id);
            const showDate = index === 0 || formatDate(visibleMessages[index - 1]?.created_at) !== formatDate(item.created_at);
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
                      {otherUser?.avatar ? (
                        <Image source={{ uri: mediaUrl(otherUser.avatar) || otherUser.avatar }} style={styles.messageAvatar} />
                      ) : (
                        <View style={[styles.messageAvatar, styles.avatarPlaceholder, { backgroundColor: C.brown }]}>
                          <Text style={styles.avatarText}>{otherUser?.username?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  ) : null}
                  <View style={{ maxWidth: '82%' }}>
                    <ChatBubble item={item} isOwn={isOwn} C={C} t={t} onLongPress={() => setActionMessage(item)} />
                    <View style={styles.messageMeta}>
                      <Text style={[styles.messageTime, { color: C.text2 }]}>{formatTime(item.created_at)}</Text>
                      {isOwn && item.is_read ? <Text style={[styles.readReceipt, { color: C.brown }]}>✓✓</Text> : null}
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          onContentSizeChange={() => {
            if (!searchQuery) flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <Text style={[styles.emptyThread, { color: C.text2 }]}>
              {searchQuery.trim() ? t('chat.noSearchMatches') : t('chat.startConversation')}
            </Text>
          }
          ListFooterComponent={
            hasMore && !loading ? (
              <View style={styles.loadMore}>
                <ActivityIndicator size="small" color={C.brown} />
              </View>
            ) : null
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
                ? () => void handleDeleteMessage(actionMessage)
                : undefined
            }
          />
        ) : null}

        {peerTyping && !actionMessage ? (
          <Text style={[styles.typingLine, { color: C.text2 }]}>{typingLabel}</Text>
        ) : null}

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
          onMood={(key) => void setMood(key)}
          moodIcon={moodIcon}
          replyName={editingId ? t('chat.edit') : replyTo ? (String(replyTo.sender.id) === String(user?.id) ? t('chat.you') : peerLabel) : undefined}
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
            onAccept={() => {
              if (!hasNativeWebRTC()) {
                void prepareCallMedia().then(() => offerNativeCallFallback(navigation, t, '/chat'));
                call.rejectCall();
                return;
              }
              void call.acceptCall().catch((error) => {
                if (String(error?.message || '').includes('WEBRTC_NATIVE_BUILD_REQUIRED')) {
                  offerNativeCallFallback(navigation, t, '/chat');
                  return;
                }
                Alert.alert(t('mobile.callUnavailable'), error?.message || t('mobile.callUnavailable'));
              });
            }}
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
  searchBar: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInput: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
  searchMeta: { fontSize: 10, marginTop: 6, fontWeight: '600' },
  typingLine: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 6 },
  emptyThread: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },
  listContent: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },
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
  input: { flex: 1, fontSize: 16, minHeight: 40, maxHeight: 120, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, marginRight: 8, borderWidth: 1 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  loadMore: { padding: 20, alignItems: 'center' },
});