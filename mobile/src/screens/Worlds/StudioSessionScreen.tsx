import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useStudioSocket, type StudioSocketEvent } from '@/hooks/useStudioSocket';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import {
  STUDIO_CANVAS_H,
  STUDIO_CANVAS_W,
  STUDIO_PALETTE,
  asStudioUsers,
  pointsToSvg,
  useStudioPalette,
  type StudioChatMsg,
  type StudioMedia,
  type StudioSessionDetail,
  type StudioShape,
  type StudioStroke,
  type StudioText,
  type StudioUser,
} from '@/lib/studio';

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

export default function StudioSessionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const sessionId = Number(route.params?.sessionId);
  const { isDark } = useTheme();
  const C = useStudioPalette(isDark);
  const { t } = useLocale();
  const { user } = useAuth();

  const [session, setSession] = useState<StudioSessionDetail | null>(null);
  const [strokes, setStrokes] = useState<StudioStroke[]>([]);
  const [mediaItems, setMediaItems] = useState<StudioMedia[]>([]);
  const [shapes, setShapes] = useState<StudioShape[]>([]);
  const [texts, setTexts] = useState<StudioText[]>([]);
  const [participants, setParticipants] = useState<StudioUser[]>([]);
  const [chatMessages, setChatMessages] = useState<StudioChatMsg[]>([]);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);
  const [color, setColor] = useState(STUDIO_PALETTE[0]);
  const [brushWidth, setBrushWidth] = useState(3);
  const [eraser, setEraser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [following, setFollowing] = useState<StudioUser[] | null>(null);
  const [inviting, setInviting] = useState<number | null>(null);
  const [error, setError] = useState('');

  const scale = Math.min((SCREEN_W - 32) / STUDIO_CANVAS_W, (SCREEN_H * 0.42) / STUDIO_CANVAS_H);
  const displayW = STUDIO_CANVAS_W * scale;
  const displayH = STUDIO_CANVAS_H * scale;

  const isHost = !!(session && user && (session.host?.id === user.id || session.host?.username === user.username));
  const isLive = session?.mode === 'live';

  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const drawingRef = useRef(false);
  const toolRef = useRef({ color, brushWidth, eraser, canvas: C.canvas });
  toolRef.current = { color, brushWidth, eraser, canvas: C.canvas };
  const sendRef = useRef<(type: string, payload?: Record<string, unknown>) => boolean>(() => false);

  const onStudioEvent = useCallback((event: StudioSocketEvent) => {
    switch (event.type) {
      case 'participant.joined': {
        const joined = event.user as StudioUser;
        if (joined?.id) {
          setParticipants((prev) => (prev.some((p) => p.id === joined.id) ? prev : [...prev, joined]));
        }
        break;
      }
      case 'participant.left':
        setParticipants((prev) => prev.filter((p) => p.id !== event.user_id));
        break;
      case 'stroke.added':
        setStrokes((prev) =>
          prev.some((s) => s.id === event.id)
            ? prev
            : [
                ...prev,
                {
                  id: Number(event.id),
                  user: event.user as StudioUser,
                  points: (event.points as StudioStroke['points']) || [],
                  color: String(event.color || '#5B21B6'),
                  width: Number(event.width || 3),
                },
              ],
        );
        break;
      case 'stroke.removed':
        setStrokes((prev) => prev.filter((s) => s.id !== event.id));
        break;
      case 'media.added':
        setMediaItems((prev) =>
          prev.some((m) => m.id === event.id)
            ? prev
            : [
                ...prev,
                {
                  ...(event as unknown as StudioMedia),
                  image: event.image ? mediaUrl(String(event.image)) : null,
                },
              ],
        );
        break;
      case 'media.deleted':
        setMediaItems((prev) => prev.filter((m) => m.id !== event.id));
        break;
      case 'shape.added':
        setShapes((prev) => (prev.some((s) => s.id === event.id) ? prev : [...prev, event as unknown as StudioShape]));
        break;
      case 'shape.deleted':
        setShapes((prev) => prev.filter((s) => s.id !== event.id));
        break;
      case 'text.added':
        setTexts((prev) => (prev.some((tx) => tx.id === event.id) ? prev : [...prev, event as unknown as StudioText]));
        break;
      case 'text.deleted':
        setTexts((prev) => prev.filter((tx) => tx.id !== event.id));
        break;
      case 'chat.message':
        setChatMessages((prev) => [...prev.slice(-49), { user: event.user as StudioUser, text: String(event.text || '') }]);
        break;
      case 'session.cleared':
        setStrokes([]);
        setMediaItems([]);
        setShapes([]);
        setTexts([]);
        break;
      default:
        break;
    }
  }, []);

  const { connected, send } = useStudioSocket({
    sessionId: Number.isFinite(sessionId) ? sessionId : null,
    onEvent: onStudioEvent,
  });
  sendRef.current = send;

  const loadSession = useCallback(async () => {
    if (!Number.isFinite(sessionId)) return;
    setLoading(true);
    setError('');
    try {
      const data = (await api.getStudioSession(sessionId)) as StudioSessionDetail;
      setSession(data);
      setStrokes(data.strokes || []);
      setMediaItems((data.media || []).map((m) => ({ ...m, image: m.image ? mediaUrl(m.image) : null })));
      setShapes(data.shapes || []);
      setTexts(data.texts || []);
      setParticipants((data.participants || []).map((p) => p.user).filter(Boolean));
    } catch {
      setError(t('studio.signInToDraw'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const persistStroke = useCallback(
    async (points: { x: number; y: number }[]) => {
      if (points.length < 2 || !Number.isFinite(sessionId)) return;
      const strokeColor = toolRef.current.eraser ? toolRef.current.canvas : toolRef.current.color;
      const width = toolRef.current.brushWidth;
      if (sendRef.current('stroke.add', { points, color: strokeColor, width })) return;
      try {
        const stroke = (await api.addStudioStroke(sessionId, { points, color: strokeColor, width })) as StudioStroke;
        setStrokes((prev) => [...prev, stroke]);
      } catch {
        /* keep the local stroke if REST fails */
        setStrokes((prev) => [
          ...prev,
          { id: -Date.now(), points, color: strokeColor, width },
        ]);
      }
    },
    [sessionId],
  );

  const persistStrokeRef = useRef(persistStroke);
  persistStrokeRef.current = persistStroke;

  const toCanvas = useCallback(
    (locationX: number, locationY: number) => ({
      x: Math.max(0, Math.min(STUDIO_CANVAS_W, locationX / scale)),
      y: Math.max(0, Math.min(STUDIO_CANVAS_H, locationY / scale)),
    }),
    [scale],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          drawingRef.current = true;
          const point = toCanvas(e.nativeEvent.locationX, e.nativeEvent.locationY);
          currentStrokeRef.current = [point];
          setCurrentStroke([point]);
        },
        onPanResponderMove: (e) => {
          if (!drawingRef.current) return;
          const point = toCanvas(e.nativeEvent.locationX, e.nativeEvent.locationY);
          currentStrokeRef.current = [...currentStrokeRef.current, point];
          setCurrentStroke(currentStrokeRef.current);
        },
        onPanResponderRelease: () => {
          drawingRef.current = false;
          const points = currentStrokeRef.current;
          currentStrokeRef.current = [];
          setCurrentStroke([]);
          void persistStrokeRef.current(points);
        },
        onPanResponderTerminate: () => {
          drawingRef.current = false;
          currentStrokeRef.current = [];
          setCurrentStroke([]);
        },
      }),
    [toCanvas],
  );

  const undoLast = () => {
    if (send('history.undo')) return;
    setStrokes((prev) => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    if (!isHost) {
      Alert.alert(t('studio.title'), t('studio.hostOnly'));
      return;
    }
    if (!send('session.clear')) {
      Alert.alert(t('studio.title'), t('studio.hostOnly'));
    }
  };

  const addPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0] || !Number.isFinite(sessionId)) return;
    const asset = result.assets[0];
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', {
        uri: asset.uri,
        name: asset.fileName || 'studio.jpg',
        type: asset.mimeType || 'image/jpeg',
      } as any);
      form.append('x', '40');
      form.append('y', '40');
      form.append('width', '220');
      form.append('height', '220');
      const media = (await api.addStudioMedia(sessionId, form)) as StudioMedia;
      setMediaItems((prev) => [...prev, { ...media, image: media.image ? mediaUrl(media.image) : asset.uri }]);
    } catch {
      setError(t('studio.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  const openInvite = async () => {
    setInviteOpen(true);
    if (following || !user?.id) return;
    try {
      setFollowing(asStudioUsers(await api.getFollowing(user.id)));
    } catch {
      setFollowing([]);
    }
  };

  const sendInvite = async (toUserId: number) => {
    if (!Number.isFinite(sessionId)) return;
    setInviting(toUserId);
    try {
      const data = (await api.inviteToStudio(sessionId, toUserId)) as StudioSessionDetail;
      setSession((prev) => (prev ? { ...prev, ...data, mode: data.mode || 'live' } : data));
      setInviteOpen(false);
    } catch {
      Alert.alert(t('studio.inviteTitle'), t('studio.inviteFailed'));
    } finally {
      setInviting(null);
    }
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    if (send('chat.send', { text })) setChatInput('');
  };

  const liveStroke =
    currentStroke.length > 1
      ? {
          id: -1,
          points: currentStroke,
          color: eraser ? C.canvas : color,
          width: brushWidth,
        }
      : null;
  const allStrokes = liveStroke ? [...strokes, liveStroke] : strokes;

  const layers = useMemo(() => {
    return [
      ...mediaItems.filter((m) => m.visible !== false).map((m) => ({ kind: 'media' as const, z: m.z_index, item: m })),
      ...shapes.filter((s) => s.visible !== false).map((s) => ({ kind: 'shape' as const, z: s.z_index, item: s })),
      ...texts.filter((tx) => tx.visible !== false).map((tx) => ({ kind: 'text' as const, z: tx.z_index, item: tx })),
    ].sort((a, b) => a.z - b.z);
  }, [mediaItems, shapes, texts]);

  if (!Number.isFinite(sessionId)) {
    return (
      <WorldBackdrop tone="default">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <WorldHeader title={t('studio.title')} onBack={() => navigation.goBack()} />
        </SafeAreaView>
      </WorldBackdrop>
    );
  }

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={session?.title || t('studio.title')}
          subtitle={isLive ? t('studio.live') : t('studio.solo')}
          tone="default"
          onBack={() => navigation.goBack()}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
          </View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.body}>
              <View style={styles.metaRow}>
                <View style={[styles.badge, { backgroundColor: isLive ? '#dc2626' : C.brownDk }]}>
                  {isLive ? <View style={styles.liveDot} /> : null}
                  <Text style={styles.badgeText}>{isLive ? t('studio.live') : t('studio.solo')}</Text>
                </View>
                {connected ? (
                  <Text style={[styles.metaHint, { color: C.text2 }]}>● {t('studio.connected')}</Text>
                ) : null}
                <View style={styles.avatars}>
                  {participants.slice(0, 5).map((p) => (
                    <View key={p.id} style={[styles.miniAvatar, { backgroundColor: C.brownDk, borderColor: C.white }]}>
                      {p.avatar ? (
                        <Image source={{ uri: mediaUrl(p.avatar) }} style={styles.miniAvatarImg} />
                      ) : (
                        <Text style={styles.miniAvatarText}>{(p.username || '?').slice(0, 1).toUpperCase()}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
              {(isHost || isLive) ? (
                <View style={styles.metaRow}>
                  {isHost ? (
                    <Pressable
                      onPress={() => void openInvite()}
                      style={[styles.pillBtn, { backgroundColor: C.card2 }]}
                    >
                      <Ionicons name="person-add-outline" size={14} color={C.brown} />
                      <Text style={[styles.pillBtnText, { color: C.brown }]}>{t('studio.invite')}</Text>
                    </Pressable>
                  ) : null}
                  {isLive ? (
                    <Pressable
                      onPress={() => setChatOpen(true)}
                      style={[styles.pillBtn, { backgroundColor: C.card2 }]}
                    >
                      <Ionicons name="chatbubble-outline" size={14} color={C.brown} />
                      <Text style={[styles.pillBtnText, { color: C.brown }]}>{t('studio.chat')}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.canvasStage}>
              <View
                style={[styles.canvasWrap, { width: displayW, height: displayH, backgroundColor: C.canvas, borderColor: C.line }]}
                {...panResponder.panHandlers}
              >
                <Svg width={displayW} height={displayH} style={StyleSheet.absoluteFill}>
                  {allStrokes.map((stroke) => {
                    const d = pointsToSvg(stroke.points, scale);
                    if (!d) return null;
                    return (
                      <Path
                        key={stroke.id}
                        d={d}
                        stroke={stroke.color}
                        strokeWidth={Math.max(1, stroke.width * scale)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    );
                  })}
                  {shapes
                    .filter((s) => s.visible !== false)
                    .map((shape) => {
                      const x = shape.x * scale;
                      const y = shape.y * scale;
                      const w = shape.width * scale;
                      const h = shape.height * scale;
                      if (shape.kind === 'circle') {
                        return (
                          <Circle
                            key={`sh-${shape.id}`}
                            cx={x + w / 2}
                            cy={y + h / 2}
                            r={Math.min(w, h) / 2}
                            stroke={shape.color}
                            strokeWidth={Math.max(1, (shape.stroke_width || 2) * scale)}
                            fill="none"
                            opacity={shape.opacity ?? 1}
                          />
                        );
                      }
                      if (shape.kind === 'line') {
                        return (
                          <Line
                            key={`sh-${shape.id}`}
                            x1={x}
                            y1={y + h / 2}
                            x2={x + w}
                            y2={y + h / 2}
                            stroke={shape.color}
                            strokeWidth={Math.max(1, (shape.stroke_width || 2) * scale)}
                            opacity={shape.opacity ?? 1}
                          />
                        );
                      }
                      return (
                        <Rect
                          key={`sh-${shape.id}`}
                          x={x}
                          y={y}
                          width={w}
                          height={h}
                          stroke={shape.color}
                          strokeWidth={Math.max(1, (shape.stroke_width || 2) * scale)}
                          fill="none"
                          opacity={shape.opacity ?? 1}
                        />
                      );
                    })}
                </Svg>
                {layers.map((layer) => {
                  if (layer.kind === 'media') {
                    const item = layer.item as StudioMedia;
                    if (!item.image) return null;
                    return (
                      <Image
                        key={`m-${item.id}`}
                        source={{ uri: item.image }}
                        style={{
                          position: 'absolute',
                          left: item.x * scale,
                          top: item.y * scale,
                          width: item.width * scale,
                          height: item.height * scale,
                          opacity: item.opacity ?? 1,
                          transform: [{ rotate: `${item.rotation || 0}deg` }],
                        }}
                      />
                    );
                  }
                  if (layer.kind === 'text') {
                    const item = layer.item as StudioText;
                    return (
                      <Text
                        key={`t-${item.id}`}
                        style={{
                          position: 'absolute',
                          left: item.x * scale,
                          top: item.y * scale,
                          width: item.width * scale,
                          color: item.color,
                          fontSize: Math.max(10, item.font_size * scale),
                          opacity: item.opacity ?? 1,
                        }}
                      >
                        {item.text}
                      </Text>
                    );
                  }
                  return null;
                })}
              </View>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={[styles.tools, { backgroundColor: C.card2 }]}>
                <View style={styles.colors}>
                  {STUDIO_PALETTE.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setColor(c);
                        setEraser(false);
                      }}
                      style={[
                        styles.swatch,
                        { backgroundColor: c, borderColor: !eraser && color === c ? C.brown : 'transparent' },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.widths}>
                  {[2, 5, 9, 14].map((w) => (
                    <Pressable
                      key={w}
                      onPress={() => setBrushWidth(w)}
                      style={[
                        styles.widthBtn,
                        { backgroundColor: brushWidth === w ? C.white : 'transparent', borderColor: C.line },
                      ]}
                    >
                      <View style={[styles.widthDot, { width: w + 4, height: w + 4, backgroundColor: eraser ? C.text2 : color }]} />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.actions}>
                  <ToolBtn
                    icon="backspace-outline"
                    label={t('studio.eraser')}
                    active={eraser}
                    color={C}
                    onPress={() => setEraser((v) => !v)}
                  />
                  <ToolBtn icon="arrow-undo-outline" label={t('studio.undo')} color={C} onPress={undoLast} />
                  <ToolBtn
                    icon="image-outline"
                    label={t('studio.addPhoto')}
                    color={C}
                    loading={uploading}
                    onPress={() => void addPhoto()}
                  />
                  {isHost && connected ? (
                    <ToolBtn icon="trash-outline" label={t('studio.clearView')} color={C} onPress={clearCanvas} />
                  ) : null}
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        <Modal visible={inviteOpen} transparent animationType="fade" onRequestClose={() => setInviteOpen(false)}>
          <Pressable style={styles.modalDim} onPress={() => setInviteOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: C.white }]} onPress={() => {}}>
              <Text style={[styles.sheetTitle, { color: C.text }]}>{t('studio.inviteTitle')}</Text>
              {following === null ? (
                <ActivityIndicator color={C.brown} />
              ) : following.length === 0 ? (
                <Text style={{ color: C.text2, fontSize: 13 }}>{t('studio.inviteEmpty')}</Text>
              ) : (
                following.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => void sendInvite(f.id)}
                    disabled={inviting === f.id}
                    style={styles.inviteRow}
                  >
                    <View style={[styles.inviteAvatar, { backgroundColor: C.card2 }]}>
                      {f.avatar ? <Image source={{ uri: mediaUrl(f.avatar) }} style={styles.miniAvatarImg} /> : null}
                    </View>
                    <Text style={[styles.inviteName, { color: C.text }]}>@{f.username}</Text>
                    {inviting === f.id ? <ActivityIndicator color={C.brown} /> : null}
                  </Pressable>
                ))
              )}
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={chatOpen} transparent animationType="slide" onRequestClose={() => setChatOpen(false)}>
          <Pressable style={styles.modalDim} onPress={() => setChatOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: C.white }]} onPress={() => {}}>
              <Text style={[styles.sheetTitle, { color: C.text }]}>{t('studio.chat')}</Text>
              <ScrollView style={{ maxHeight: 220 }}>
                {chatMessages.length === 0 ? (
                  <Text style={{ color: C.text2, fontSize: 13 }}>{t('studio.chatPlaceholder')}</Text>
                ) : (
                  chatMessages.map((msg, i) => (
                    <Text key={`${msg.user?.id}-${i}`} style={{ color: C.text, fontSize: 13, marginBottom: 8 }}>
                      <Text style={{ fontWeight: '700' }}>@{msg.user?.username}: </Text>
                      {msg.text}
                    </Text>
                  ))
                )}
              </ScrollView>
              <View style={[styles.chatBar, { backgroundColor: C.card2, borderColor: C.line }]}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder={t('studio.chatPlaceholder')}
                  placeholderTextColor={C.text2}
                  style={[styles.chatInput, { color: C.text }]}
                  onSubmitEditing={sendChat}
                />
                <Pressable onPress={sendChat} hitSlop={8}>
                  <Ionicons name="send" size={18} color={C.brown} />
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function ToolBtn({
  icon,
  label,
  onPress,
  active,
  loading,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  loading?: boolean;
  color: ReturnType<typeof useStudioPalette>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[styles.toolBtn, { backgroundColor: active ? color.brownDk : color.white }]}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={active ? '#fff' : color.brown} size="small" />
      ) : (
        <Ionicons name={icon} size={16} color={active ? '#fff' : color.text} />
      )}
      <Text style={[styles.toolLabel, { color: active ? '#fff' : color.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  pillBtnText: { fontSize: 12, fontWeight: '700' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  metaHint: { fontSize: 12, fontWeight: '600' },
  avatars: { flexDirection: 'row', marginStart: 'auto' },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginStart: -6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  miniAvatarImg: { width: '100%', height: '100%' },
  miniAvatarText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  canvasStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  canvasWrap: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    alignSelf: 'center',
  },
  error: { color: '#dc2626', fontSize: 13 },
  tools: { borderRadius: 20, padding: 12, gap: 12 },
  colors: { flexDirection: 'row', gap: 8 },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  widths: { flexDirection: 'row', gap: 8 },
  widthBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthDot: { borderRadius: 99 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  toolLabel: { fontSize: 12, fontWeight: '600' },
  modalDim: {
    flex: 1,
    backgroundColor: 'rgba(12,8,28,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: 16,
    borderRadius: 22,
    padding: 16,
    gap: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  inviteAvatar: { width: 32, height: 32, borderRadius: 16, overflow: 'hidden' },
  inviteName: { flex: 1, fontSize: 14, fontWeight: '600' },
  chatBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chatInput: { flex: 1, fontSize: 14, paddingVertical: 4 },
});
