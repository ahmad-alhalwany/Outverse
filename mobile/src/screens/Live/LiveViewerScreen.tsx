import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Video from 'react-native-video';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { createReconnectingWebSocket, resolveWsUrl } from '@/api/ws';
import { isWhipAvailable, publishWhipFromCamera, stopWhip, type WhipSession } from '@/lib/whip';
import type { LiveChatMessage, LiveSession } from '@/types';

const REACTIONS = ['❤️', '🔥', '✨', '👏', '👍'];
const REACTION_MAP: Record<string, string> = {
  '❤️': 'heart',
  '🔥': 'fire',
  '✨': 'spark',
  '👏': 'clap',
  '👍': 'thumbs_up',
};

export default function LiveViewerScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const sessionId = route.params?.sessionId as string | number;
  const isHost = Boolean(route.params?.isHost);

  const [session, setSession] = useState<LiveSession | null>(null);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);
  const [publishState, setPublishState] = useState<'idle' | 'connecting' | 'live' | 'unavailable' | 'failed'>('idle');
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistQuestions, setAssistQuestions] = useState<string[]>([]);
  const [recapBusy, setRecapBusy] = useState(false);
  const [recap, setRecap] = useState('');
  const chatRef = useRef<FlatList<LiveChatMessage>>(null);
  const joinedRef = useRef(false);
  const whipRef = useRef<WhipSession | null>(null);
  const wsConnectedRef = useRef(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = (await api.getLiveSession(sessionId)) as LiveSession;
      setSession(data);
      if (data.is_live && !joinedRef.current && !isHost) {
        joinedRef.current = true;
        try {
          await api.joinLiveSession(sessionId);
        } catch {
          // join may fail if not authenticated or session ended
        }
      }
    } catch (error) {
      console.error('Failed to load live session:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId, isHost]);

  const loadChat = useCallback(async () => {
    if (!sessionId) return;
    try {
      const rows = (await api.getLiveChat(sessionId)) as LiveChatMessage[];
      setMessages(rows);
    } catch {
      // chat may be disabled
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Prefer WebSocket for chat + viewer counts; poll as fallback.
  useEffect(() => {
    if (!sessionId || !session?.chat_enabled) return;
    loadChat();
    const socket = createReconnectingWebSocket({
      url: () => resolveWsUrl('live', { session_id: sessionId }),
      onOpen: () => {
        wsConnectedRef.current = true;
      },
      onClose: () => {
        wsConnectedRef.current = false;
      },
      onMessage: (data: any) => {
        if (data?.type === 'live.chat' && data.message) {
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(data.message.id))) return prev;
            return [...prev, data.message as LiveChatMessage];
          });
        }
        if (data?.type === 'live.viewers' && typeof data.current_viewers === 'number') {
          setSession((prev) => (prev ? { ...prev, current_viewers: data.current_viewers } : prev));
        }
        if (data?.type === 'live.ended') {
          setSession((prev) => (prev ? { ...prev, is_live: false, status: 'ended' as const } : prev));
        }
      },
    });
    const interval = setInterval(() => {
      if (!wsConnectedRef.current) loadChat();
    }, 8000);
    return () => {
      socket.close();
      clearInterval(interval);
    };
  }, [sessionId, session?.chat_enabled, loadChat]);

  // Host WHIP publish when webrtc URL is present
  useEffect(() => {
    if (!isHost || !session?.webrtc_publish_url || session.status === 'ended') {
      return;
    }
    if (!isWhipAvailable()) {
      setPublishState('unavailable');
      return;
    }
    let cancelled = false;
    setPublishState('connecting');
    publishWhipFromCamera(session.webrtc_publish_url)
      .then((whip) => {
        if (cancelled) {
          void stopWhip(whip);
          return;
        }
        whipRef.current = whip;
        setPublishState('live');
      })
      .catch(() => {
        if (!cancelled) setPublishState('failed');
      });
    return () => {
      cancelled = true;
      void stopWhip(whipRef.current);
      whipRef.current = null;
    };
  }, [isHost, session?.webrtc_publish_url, session?.status]);

  useEffect(() => {
    return () => {
      if (joinedRef.current && sessionId) {
        api.leaveLiveSession(sessionId).catch(() => {});
      }
      void stopWhip(whipRef.current);
    };
  }, [sessionId]);

  const handleSend = async () => {
    const text = chatText.trim();
    if (!text || !sessionId || sending) return;
    setSending(true);
    try {
      const msg = (await api.sendLiveMessage(sessionId, text)) as LiveChatMessage;
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
        return [...prev, msg];
      });
      setChatText('');
      setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!sessionId) return;
    const type = REACTION_MAP[emoji] || 'heart';
    try {
      await api.reactLive(sessionId, type);
    } catch {
      // ignore reaction errors
    }
  };

  const handleEnd = async () => {
    if (!sessionId || !isHost) return;
    try {
      await api.endLiveSession(sessionId);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to end live:', error);
    }
  };

  const handleHostAssist = async () => {
    if (!sessionId) return;
    setAssistBusy(true);
    try {
      const result = await api.liveHostAssist(sessionId);
      if (result.questions?.length) {
        setAssistQuestions(result.questions);
        Alert.alert(t('mobile.hostAssist'), result.questions.join('\n\n'));
      }
    } catch {
      Alert.alert(t('mobile.hostAssist'), t('mobile.hostAssistFail'));
    } finally {
      setAssistBusy(false);
    }
  };

  const handleRecap = async () => {
    if (!sessionId) return;
    setRecapBusy(true);
    try {
      const result = await api.liveHostRecap(sessionId);
      if (result.summary) {
        setRecap(result.summary);
        Alert.alert(t('mobile.sessionRecap'), result.summary);
      }
    } catch {
      Alert.alert(t('mobile.sessionRecap'), t('mobile.recapFail'));
    } finally {
      setRecapBusy(false);
    }
  };

  const hostName =
    typeof session?.user === 'string'
      ? session.user
      : session?.user?.username || t('live.host');

  const playbackUrl = session?.playback_url ? mediaUrl(session.playback_url) : null;
  const chatEnabled = session?.chat_enabled !== false;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('live.title')}</Text>
          <View style={styles.backBtn} />
        </View>
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>{t('live.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.videoWrap}>
          {playbackUrl && !isHost ? (
            <Video
              source={{ uri: playbackUrl }}
              style={styles.video}
              resizeMode="contain"
              controls={false}
              paused={false}
              playInBackground={false}
            />
          ) : (
            <View style={[styles.video, styles.videoPlaceholder]}>
              <Text style={{ fontSize: 48 }}>📡</Text>
              <Text style={styles.placeholderText}>
                {isHost
                  ? publishState === 'live'
                    ? t('mobile.broadcastingWhip')
                    : publishState === 'connecting'
                      ? t('mobile.connectingCamera')
                      : publishState === 'unavailable'
                        ? t('mobile.useObs')
                        : session.is_live
                          ? t('mobile.streamStarting')
                          : t('mobile.noPlayback')
                  : session.is_live
                    ? t('mobile.streamStarting')
                    : t('mobile.noPlayback')}
              </Text>
            </View>
          )}

          <View style={styles.overlayHeader}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.overlayBack}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.overlayInfo}>
              {session.is_live ? (
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>{t('live.statusLive')}</Text>
                </View>
              ) : null}
              <Text style={styles.overlayTitle} numberOfLines={1}>
                {session.title || t('mobile.untitledStream')}
              </Text>
              <Text style={styles.overlayHost} numberOfLines={1}>
                {hostName} · {t('mobile.watchingCount', { count: session.current_viewers ?? 0 })}
                {isHost ? ` · ${t('mobile.youAreHosting')}` : ''}
              </Text>
            </View>
            {isHost ? (
              <View style={{ gap: 6 }}>
                {session?.is_live && (
                  <TouchableOpacity
                    onPress={handleHostAssist}
                    disabled={assistBusy}
                    style={[styles.endBtn, { backgroundColor: '#7C3AED' }]}
                  >
                    <Text style={styles.endBtnText}>{assistBusy ? '…' : `✨ ${t('mobile.assist')}`}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={handleEnd} style={styles.endBtn}>
                  <Text style={styles.endBtnText}>{t('live.endStream')}</Text>
                </TouchableOpacity>
                {!session?.is_live && session?.status === 'ended' && (
                  <TouchableOpacity
                    onPress={handleRecap}
                    disabled={recapBusy}
                    style={[styles.endBtn, { backgroundColor: '#7C3AED' }]}
                  >
                    <Text style={styles.endBtnText}>{recapBusy ? '…' : `✨ ${t('mobile.recap')}`}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>

          {isHost && (session.stream_key || session.rtmp_url) ? (
            <View style={styles.hostPanel}>
              <Text style={styles.hostPanelTitle}>
                {t('mobile.hostWhip', { state: publishState === 'live' ? t('live.statusLive') : publishState })}
              </Text>
              {session.rtmp_url ? (
                <Text style={styles.hostPanelMeta} numberOfLines={2}>
                  RTMP: {session.rtmp_url}
                </Text>
              ) : null}
              {session.stream_key ? (
                <Text style={styles.hostPanelKey} selectable>
                  {session.stream_key}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.reactions}>
            {REACTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionBtn}
                onPress={() => handleReact(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {chatEnabled ? (
          <View style={[styles.chatPanel, { backgroundColor: colors.surface }]}>
            <Text style={[styles.chatTitle, { color: colors.text }]}>{t('nav.chat')}</Text>
            <FlatList
              ref={chatRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              style={styles.chatList}
              contentContainerStyle={styles.chatListContent}
              onContentSizeChange={() => chatRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item }) => (
                <View style={styles.chatRow}>
                  <Text style={[styles.chatUser, { color: colors.primary }]}>
                    {typeof item.user === 'string' ? item.user : (item as any).user?.username || 'user'}
                  </Text>
                  <Text style={[styles.chatText, { color: colors.text }]}>{item.text}</Text>
                </View>
              )}
            />
            <View style={[styles.chatInputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.chatInput, { color: colors.text, backgroundColor: colors.inputBg || colors.background }]}
                placeholder={t('mobile.saySomething')}
                placeholderTextColor={colors.textMuted}
                value={chatText}
                onChangeText={setChatText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={handleSend} disabled={sending} style={styles.sendBtn}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('reels.send')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  videoWrap: { flex: 1.2, position: 'relative', backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: 'rgba(255,255,255,0.7)', marginTop: 10, textAlign: 'center', paddingHorizontal: 24 },
  overlayHeader: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  overlayBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayBackText: { color: '#fff', fontSize: 18 },
  overlayInfo: { flex: 1 },
  liveBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  overlayTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  overlayHost: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  endBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  endBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  hostPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 64,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    padding: 10,
  },
  hostPanelTitle: { color: '#C4B5FD', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  hostPanelKey: { color: '#fff', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  hostPanelMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: 4 },
  reactions: {
    position: 'absolute',
    right: 10,
    bottom: 12,
    gap: 8,
  },
  reactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 18 },
  chatPanel: { flex: 1, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 10 },
  chatTitle: { fontSize: 14, fontWeight: '800', paddingHorizontal: 14, marginBottom: 6 },
  chatList: { flex: 1 },
  chatListContent: { paddingHorizontal: 14, paddingBottom: 8 },
  chatRow: { marginBottom: 8 },
  chatUser: { fontSize: 12, fontWeight: '800' },
  chatText: { fontSize: 14, lineHeight: 20 },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  chatInput: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendBtn: { paddingHorizontal: 8, paddingVertical: 8 },
});
