import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Pressable,
  StatusBar,
  ViewToken,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import ReactionBurst from '../../components/ReactionBurst';
import { useReels, type ReelsFeedMode } from '../../hooks/useReels';
import { API_ORIGIN } from '../../api/config';
import { api } from '../../api/client';
import type { Reel, ReelComment, User } from '../../types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReelsScreen() {
  const navigation = useNavigation<any>();
  const [feed, setFeed] = useState<ReelsFeedMode>('all');
  const {
    reels,
    loading,
    currentIndex,
    setCurrentIndex,
    like,
    toggleSave,
    dimReel,
    viewReel,
    loadComments,
    addComment,
    shareReel,
  } = useReels(feed);
  const flatListRef = useRef<FlatList<Reel>>(null);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [activeReel, setActiveReel] = useState<Reel | null>(null);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Reel>[]; changed: ViewToken<Reel>[] }) => {
      const visible = viewableItems.find((v) => v.isViewable && v.index !== null);
      if (visible && visible.index !== null && reels[visible.index]) {
        setCurrentIndex(visible.index);
        viewReel(String(reels[visible.index].id));
      }
    },
    [setCurrentIndex, viewReel, reels]
  );

  const viewabilityConfig = { itemVisiblePercentThreshold: 80 };

  const openComments = useCallback(
    async (reel: Reel) => {
      setActiveReel(reel);
      setCommentsOpen(true);
      setCommentsLoading(true);
      try {
        const rows = await loadComments(String(reel.id));
        setComments(rows);
      } catch {
        setComments([]);
      } finally {
        setCommentsLoading(false);
      }
    },
    [loadComments]
  );

  const closeComments = () => {
    setCommentsOpen(false);
    setActiveReel(null);
    setCommentText('');
    setComments([]);
  };

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text || !activeReel || postingComment) return;
    setPostingComment(true);
    try {
      const comment = await addComment(String(activeReel.id), text);
      setComments((prev) => [...prev, comment]);
      setCommentText('');
    } catch {
      // ignore
    } finally {
      setPostingComment(false);
    }
  };

  const handleShare = useCallback(
    async (reel: Reel) => {
      const username = reel.user?.username || 'user';
      const url = `${API_ORIGIN}/reels/${reel.id}`;
      Alert.alert('Share signal', 'Choose a channel', [
        {
          text: 'Device share',
          onPress: async () => {
            try {
              await Share.share({
                message: `Check out this signal by @${username}\n${url}`,
                url,
                title: reel.caption || 'Cosonova Signal',
              });
              await shareReel(String(reel.id));
            } catch {
              /* dismissed */
            }
          },
        },
        {
          text: 'Broadcast to Story',
          onPress: async () => {
            const videoUri = reel.video_url || reel.video;
            if (!videoUri) {
              Alert.alert('Missing video', 'Cannot share this reel to story.');
              return;
            }
            try {
              await api.shareReelToStory(reel.id, videoUri, reel.caption);
              Alert.alert('On your story', 'Reel signal is in your orbit.');
            } catch {
              Alert.alert('Error', 'Could not share reel to story.');
            }
          },
        },
        {
          text: 'Dim this signal',
          style: 'destructive',
          onPress: async () => {
            await dimReel(String(reel.id));
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [shareReel, dimReel]
  );

  const goCreate = useCallback(
    (reel: Reel, kind: 'remix' | 'weave') => {
      if (kind === 'remix' && reel.allow_remix === false) {
        Alert.alert('Remix closed', 'This creator disabled Remix on that signal.');
        return;
      }
      if (kind === 'weave' && reel.allow_weave === false) {
        Alert.alert('Weave closed', 'This creator disabled Weave on that signal.');
        return;
      }
      navigation.navigate('Create', {
        mode: 'reel',
        remix_of: kind === 'remix' ? reel.id : undefined,
        stitch_of: kind === 'weave' ? reel.id : undefined,
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Reel; index: number }) => (
      <ReelItem
        reel={item}
        isVisible={index === currentIndex}
        onLike={() => like(String(item.id))}
        onComment={() => openComments(item)}
        onShare={() => handleShare(item)}
        onSave={() => void toggleSave(String(item.id))}
        onRemix={() => goCreate(item, 'remix')}
        onWeave={() => goCreate(item, 'weave')}
      />
    ),
    [currentIndex, like, openComments, handleShare, toggleSave, goCreate]
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topChrome}>
        <View style={styles.tabs}>
          <Pressable onPress={() => setFeed('all')} style={styles.tabBtn}>
            <Text style={[styles.tabText, feed === 'all' && styles.tabTextOn]}>Pulse</Text>
          </Pressable>
          <Pressable onPress={() => setFeed('following')} style={styles.tabBtn}>
            <Text style={[styles.tabText, feed === 'following' && styles.tabTextOn]}>Orbit</Text>
          </Pressable>
        </View>
        <View style={styles.topActions}>
          <Pressable onPress={() => navigation.navigate('ReelsDiscover')} hitSlop={10}>
            <Text style={styles.topActionText}>✧</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Create', { mode: 'reel' })}
            hitSlop={10}
            style={{ marginLeft: 14 }}
          >
            <Text style={styles.topActionText}>＋</Text>
          </Pressable>
        </View>
      </View>

      {loading && reels.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <ActivityIndicator color="#A78BFA" size="large" />
        </View>
      ) : (
        <FlatList<Reel>
          ref={flatListRef}
          data={reels}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <EmptyState
                title={feed === 'following' ? 'Orbit is quiet' : 'No signals yet'}
                subtitle={
                  feed === 'following'
                    ? 'Follow creators to fill your Orbit'
                    : 'Launch the first pulse from +'
                }
                emoji="✦"
              />
            </View>
          }
        />
      )}

      <Modal visible={commentsOpen} animationType="slide" transparent onRequestClose={closeComments}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeComments} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Signal thread</Text>
            {commentsLoading ? (
              <ActivityIndicator style={styles.sheetLoader} color="#7C3AED" />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => String(item.id)}
                style={styles.commentList}
                contentContainerStyle={styles.commentListContent}
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <Avatar user={item.user} size="sm" />
                    <View style={styles.commentBody}>
                      <Text style={styles.commentUser}>{item.user?.username || 'user'}</Text>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.noComments}>No echoes yet — transmit first</Text>
                }
              />
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Echo into the void…"
                placeholderTextColor="#9ca3af"
                value={commentText}
                onChangeText={setCommentText}
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={handlePostComment}
              />
              <TouchableOpacity
                style={[styles.commentSend, !commentText.trim() && styles.commentSendDisabled]}
                onPress={handlePostComment}
                disabled={postingComment || !commentText.trim()}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.commentSendText}>Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

interface ReelItemProps {
  reel: Reel;
  isVisible: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onRemix: () => void;
  onWeave: () => void;
}

function ReelRemixAttribution({
  sourceId,
  kind,
}: {
  sourceId: number;
  kind: 'remix' | 'weave';
}) {
  const [sourceUser, setSourceUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const source = (await api.getReel(sourceId)) as Reel;
        if (!cancelled && source?.user) setSourceUser(source.user);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const username = sourceUser?.username || '…';
  return (
    <View style={styles.remixBadge}>
      <Text style={styles.remixBadgeText}>
        {kind === 'weave' ? '⧉ Weave of' : '↻ Remix of'} @{username}
      </Text>
    </View>
  );
}

function ReelItem({
  reel,
  isVisible,
  onLike,
  onComment,
  onShare,
  onSave,
  onRemix,
  onWeave,
}: ReelItemProps) {
  const videoUrl = reel.video_url || reel.video;
  const [paused, setPaused] = useState(!isVisible);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const [clock, setClock] = useState(0);
  const lastTap = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speeding = useRef(false);
  const dwellSent = useRef<Set<string>>(new Set());
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setPaused(!isVisible);
    if (!isVisible) {
      setRate(1);
      setProgress(0);
      setClock(0);
      dwellSent.current = new Set();
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const mark = clock >= 10 ? '10' : clock >= 3 ? '3' : null;
    if (!mark || dwellSent.current.has(mark)) return;
    dwellSent.current.add(mark);
    void api.reelDwell(reel.id, clock).catch(() => {});
  }, [clock, isVisible, reel.id]);

  const handleTap = (e: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (speeding.current) return;
    const now = Date.now();
    if (now - lastTap.current < 320) {
      const { locationX, locationY } = e.nativeEvent;
      setBurst({ id: now, x: locationX, y: locationY });
      onLike();
      lastTap.current = now;
      return;
    }
    lastTap.current = now;
    setPaused((p) => !p);
  };

  const onHoldStart = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      speeding.current = true;
      setRate(2);
      setPaused(false);
    }, 280);
  };

  const onHoldEnd = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (speeding.current) {
      setRate(1);
      speeding.current = false;
    }
  };

  const soundLabel =
    reel.music_track_detail?.title ||
    reel.music?.title ||
    reel.sound_label ||
    'Original signal';

  const activeCue =
    reel.captions_status === 'ready'
      ? (reel.captions || []).find((c) => clock >= c.start && clock < c.end)
      : null;
  const stickers = reel.effect_meta?.overlays?.length
    ? reel.effect_meta.overlays
    : reel.template_detail?.overlay_stickers || [];
  const overlayText = reel.effect_meta?.overlay_text || reel.template_detail?.overlay_text || '';
  const chromaKey = Boolean(reel.effect_meta?.chroma_key);
  const backdropKey = String(reel.effect_meta?.backdrop || reel.template_detail?.backdrop_preset || '');
  const BACKDROP_COLORS: Record<string, string> = {
    nebula: '#4C1D95',
    orbit: '#0E7490',
    void: '#111827',
    aurora: '#059669',
    sunset: '#C2410C',
  };
  const backdropColor = BACKDROP_COLORS[backdropKey] || '#0A0A0F';

  return (
    <View style={styles.reelContainer}>
      {chromaKey ? (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: backdropColor }]}
          accessibilityLabel={`Cosmic backdrop ${backdropKey || 'void'}`}
        />
      ) : null}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleTap}
        onPressIn={onHoldStart}
        onPressOut={onHoldEnd}
        accessibilityRole="button"
        accessibilityLabel={paused ? 'Play reel' : 'Pause reel'}
      >
        {videoUrl ? (
          <Video
            source={{ uri: videoUrl }}
            style={[styles.video, chromaKey ? { opacity: 0.92 } : null]}
            resizeMode="cover"
            paused={paused}
            muted={muted}
            rate={rate}
            repeat
            playInBackground={false}
            controls={false}
            pointerEvents="none"
            onProgress={({ currentTime, playableDuration }) => {
              setClock(currentTime);
              if (playableDuration > 0) {
                setProgress((currentTime / playableDuration) * 100);
              }
            }}
          />
        ) : (
          <View style={[styles.video, styles.videoPlaceholder]}>
            <Text style={styles.placeholderText}>No video</Text>
          </View>
        )}
      </Pressable>

      {stickers.map((s, i) => (
        <Text
          key={`${s.emoji}-${i}`}
          style={{
            position: 'absolute',
            left: `${s.x}%` as any,
            top: `${s.y}%` as any,
            fontSize: 28 * (s.scale || 1),
            transform: [{ translateX: -14 }, { translateY: -14 }],
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          {s.emoji}
        </Text>
      ))}

      {overlayText ? (
        <View style={styles.overlayTextWrap} pointerEvents="none">
          <Text style={styles.overlayText}>{overlayText}</Text>
        </View>
      ) : null}

      {activeCue ? (
        <View style={styles.captionCue} pointerEvents="none">
          <Text style={styles.captionCueText}>{activeCue.text}</Text>
        </View>
      ) : null}

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      {rate > 1 ? (
        <View style={styles.speedBadge}>
          <Text style={styles.speedBadgeText}>2×</Text>
        </View>
      ) : null}

      {burst ? (
        <ReactionBurst key={burst.id} emoji="✨" x={burst.x} y={burst.y} onDone={() => setBurst(null)} />
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.actionBtn} onPress={onLike}>
          <Text style={styles.actionEmoji}>{reel.is_liked ? '✨' : '◇'}</Text>
          <Text style={styles.actionCount}>{formatCount(reel.likes_count)}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onComment}>
          <Text style={styles.actionEmoji}>💬</Text>
          <Text style={styles.actionCount}>{formatCount(reel.comments_count)}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onSave}>
          <Text style={styles.actionEmoji}>{reel.is_saved ? '★' : '☆'}</Text>
          <Text style={styles.actionCount}>{reel.is_saved ? 'Saved' : 'Save'}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onShare}>
          <Text style={styles.actionEmoji}>↗</Text>
          <Text style={styles.actionCount}>{formatCount(reel.shares_count)}</Text>
        </Pressable>
        {reel.allow_remix !== false ? (
          <Pressable style={styles.actionBtn} onPress={onRemix}>
            <Text style={styles.actionEmoji}>↻</Text>
            <Text style={styles.actionCount}>Remix</Text>
          </Pressable>
        ) : null}
        {reel.allow_weave !== false ? (
          <Pressable style={styles.actionBtn} onPress={onWeave}>
            <Text style={styles.actionEmoji}>⧉</Text>
            <Text style={styles.actionCount}>Weave</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.actionBtn} onPress={() => setMuted((m) => !m)}>
          <Text style={styles.actionEmoji}>{muted ? '🔇' : '🔊'}</Text>
        </Pressable>
      </View>

      <View style={styles.bottomInfo}>
        {reel.remix_of != null && <ReelRemixAttribution sourceId={Number(reel.remix_of)} kind="remix" />}
        {reel.stitch_of != null && <ReelRemixAttribution sourceId={Number(reel.stitch_of)} kind="weave" />}
        <View style={styles.userRow}>
          <Avatar user={reel.user} size="md" />
          <Text style={styles.username}>{reel.user?.username || 'user'}</Text>
        </View>
        {reel.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {reel.caption}
          </Text>
        ) : null}
        <View style={styles.musicRow}>
          <Text style={styles.musicIcon}>♪</Text>
          <Text style={styles.musicText} numberOfLines={1}>
            {soundLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topChrome: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 28,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  tabs: {
    flexDirection: 'row',
    gap: 18,
  },
  tabBtn: {
    paddingVertical: 6,
  },
  tabText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 16,
    fontWeight: '700',
  },
  tabTextOn: {
    color: '#fff',
    textShadowColor: 'rgba(167,139,250,0.8)',
    textShadowRadius: 8,
  },
  topActions: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  topActionText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  placeholderText: {
    color: '#666',
    fontSize: 16,
  },
  progressTrack: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : 22,
    left: 12,
    right: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#A78BFA',
  },
  speedBadge: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 64,
    alignSelf: 'center',
    backgroundColor: 'rgba(124,58,237,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  speedBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  overlayTextWrap: {
    position: 'absolute',
    top: '18%',
    left: 16,
    right: 80,
    zIndex: 6,
  },
  overlayText: {
    alignSelf: 'flex-start',
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    backgroundColor: 'rgba(124,58,237,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  captionCue: {
    position: 'absolute',
    bottom: 150,
    left: 16,
    right: 80,
    zIndex: 8,
    alignItems: 'center',
  },
  captionCueText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    textAlign: 'center',
    backgroundColor: 'rgba(15,10,40,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  actions: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
  },
  actionBtn: {
    alignItems: 'center',
    marginBottom: 16,
  },
  actionEmoji: {
    fontSize: 26,
    color: '#fff',
  },
  actionCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 80,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  remixBadge: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(167, 139, 250, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
  },
  remixBadgeText: {
    color: '#EDE9FE',
    fontSize: 12,
    fontWeight: '700',
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  musicIcon: {
    fontSize: 14,
    marginRight: 6,
    color: '#A78BFA',
  },
  musicText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  emptyWrapper: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: SCREEN_HEIGHT * 0.65,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#211B3D',
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetLoader: {
    paddingVertical: 32,
  },
  commentList: {
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  commentListContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 10,
  },
  commentBody: {
    flex: 1,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  noComments: {
    textAlign: 'center',
    color: '#9ca3af',
    paddingVertical: 24,
    fontSize: 14,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#111827',
  },
  commentSend: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 56,
    alignItems: 'center',
  },
  commentSendDisabled: {
    opacity: 0.5,
  },
  commentSendText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
