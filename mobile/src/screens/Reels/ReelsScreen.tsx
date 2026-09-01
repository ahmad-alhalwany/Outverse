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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import ReactionBurst from '../../components/ReactionBurst';
import PostReactions from '../../components/PostReactions';
import { useReels, type ReelsFeedMode } from '../../hooks/useReels';
import { api } from '../../api/client';
import { useTheme } from '../../hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { displayName } from '@/lib/names';
import { openProfile } from '@/lib/nav';
import type { ReactionType } from '@/lib/reactions';
import type { Reel, ReelComment, User } from '../../types';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ReelsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { colors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [feed, setFeed] = useState<ReelsFeedMode>('all');
  const {
    reels,
    loading,
    error,
    currentIndex,
    setCurrentIndex,
    like,
    toggleSave,
    dimReel,
    viewReel,
    loadComments,
    addComment,
    shareReel,
    load,
  } = useReels(feed);
  const flatListRef = useRef<FlatList<Reel>>(null);
  const [listH, setListH] = useState(SCREEN_HEIGHT);
  const focusId = (route.params as { focusId?: string | number } | undefined)?.focusId;

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

  useEffect(() => {
    if (focusId == null || !reels.length) return;
    const idx = reels.findIndex((r) => String(r.id) === String(focusId));
    if (idx < 0) return;
    setCurrentIndex(idx);
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToIndex({ index: idx, animated: false });
    });
  }, [focusId, reels, setCurrentIndex]);

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
      const url = `https://cosonova.com/reels/${reel.id}`;
      Alert.alert(t('reels.share'), undefined, [
        {
          text: t('feed.shareDevice'),
          onPress: async () => {
            try {
              await Share.share({
                message: `${reel.caption || t('reels.shareSignalTitle')}\n@${username}\n${url}`,
                url,
                title: reel.caption || t('reels.shareSignalTitle'),
              });
              await shareReel(String(reel.id));
            } catch {
              /* dismissed */
            }
          },
        },
        {
          text: t('reels.shareToFeed'),
          onPress: async () => {
            try {
              await api.createPost({ text: '', shared_reel_id: reel.id });
              Alert.alert(t('reels.sharedToFeed'));
            } catch {
              Alert.alert(t('reels.actionFailed'));
            }
          },
        },
        {
          text: t('feed.shareToStory'),
          onPress: async () => {
            const videoUri = reel.video_url || reel.video;
            if (!videoUri) {
              Alert.alert(t('reels.actionFailed'));
              return;
            }
            try {
              await api.shareReelToStory(reel.id, videoUri, reel.caption);
              Alert.alert(t('feed.shareStoryDone'));
            } catch {
              Alert.alert(t('reels.actionFailed'));
            }
          },
        },
        {
          text: t('reels.dimSignal'),
          style: 'destructive',
          onPress: async () => {
            await dimReel(String(reel.id));
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [shareReel, dimReel, t]
  );

  const goCreate = useCallback(
    (reel: Reel, kind: 'remix' | 'weave') => {
      if (kind === 'remix' && reel.allow_remix === false) {
        Alert.alert(t('reels.remix'), t('reels.remixHint'));
        return;
      }
      if (kind === 'weave' && reel.allow_weave === false) {
        Alert.alert(t('reels.weave'), t('reels.weaveHint'));
        return;
      }
      navigation.navigate('Create', {
        mode: 'reel',
        remix_of: kind === 'remix' ? reel.id : undefined,
        stitch_of: kind === 'weave' ? reel.id : undefined,
      });
    },
    [navigation, t]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Reel; index: number }) => (
      <ReelItem
        reel={item}
        height={listH}
        isVisible={index === currentIndex && !commentsOpen}
        onLike={() => like(String(item.id), 'spark')}
        onReact={(type) => like(String(item.id), type)}
        onComment={() => openComments(item)}
        onShare={() => handleShare(item)}
        onSave={() => void toggleSave(String(item.id))}
        onRemix={() => goCreate(item, 'remix')}
        onWeave={() => goCreate(item, 'weave')}
        onUserPress={() => openProfile(navigation, item.user?.username)}
        onSoundPress={() => {
          const trackId = item.music_track_detail?.id || item.music_track;
          if (trackId) navigation.navigate('Sound', { musicTrack: trackId, track: item.music_track_detail });
        }}
      />
    ),
    [currentIndex, like, openComments, handleShare, toggleSave, goCreate, commentsOpen, listH, navigation]
  );

  return (
    <View style={styles.container} onLayout={(e) => setListH(e.nativeEvent.layout.height)}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.topChrome, { paddingTop: insets.top + 6 }]}>
        <View style={styles.chromeRow}>
          <View style={styles.brandWrap}>
            <Ionicons name="play-circle" size={22} color="#22D3EE" />
            <Text style={styles.brand}>{t('reels.title')}</Text>
          </View>
          <View style={styles.topActions}>
            <Pressable
              onPress={() => navigation.navigate('ReelsDiscover')}
              style={styles.chromeBtn}
              hitSlop={8}
              accessibilityLabel={t('reels.discoverTitle')}
            >
              <Ionicons name="search-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Create', { mode: 'reel' })}
              style={[styles.chromeBtn, styles.chromeBtnAccent]}
              hitSlop={8}
              accessibilityLabel={t('reels.createTitle')}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.tabs}>
          <Pressable onPress={() => setFeed('all')} style={[styles.tabBtn, feed === 'all' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, feed === 'all' && styles.tabTextOn]}>{t('reels.tabAll')}</Text>
          </Pressable>
          <Pressable onPress={() => setFeed('following')} style={[styles.tabBtn, feed === 'following' && styles.tabBtnOn]}>
            <Text style={[styles.tabText, feed === 'following' && styles.tabTextOn]}>{t('reels.tabFollowing')}</Text>
          </Pressable>
        </View>
      </View>

      {loading && reels.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <ActivityIndicator color="#A78BFA" size="large" />
          <Text style={styles.loadingText}>{t('reels.loading')}</Text>
        </View>
      ) : error && reels.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <EmptyState title={t('reels.loadError')} subtitle={t('reels.retry')} emoji="✦" />
          <Pressable onPress={() => void load()} style={styles.retryBtn}>
            <Text style={styles.retryText}>{t('reels.retry')}</Text>
          </Pressable>
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
          getItemLayout={(_, index) => ({ length: listH, offset: listH * index, index })}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: false }), 80);
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrapper}>
              <EmptyState
                title={t('reels.emptyTitle')}
                subtitle={t('reels.emptyHint')}
                emoji="✦"
              />
            </View>
          }
        />
      )}

      {reels.length > 1 ? (
        <View style={styles.feedRail} pointerEvents="none">
          {reels.map((r, i) => (
            <View key={String(r.id)} style={[styles.railDot, i === currentIndex && styles.railDotOn]} />
          ))}
        </View>
      ) : null}

      <Modal visible={commentsOpen} animationType="slide" transparent onRequestClose={closeComments}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeComments} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('reels.commentsTitle')}</Text>
            {commentsLoading ? (
              <ActivityIndicator style={styles.sheetLoader} color={colors.primary} />
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
                      <Text style={[styles.commentUser, { color: colors.text }]}>
                        {displayName(item.user)}
                      </Text>
                      <Text style={[styles.commentText, { color: colors.text }]}>{item.text}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={[styles.noComments, { color: colors.textSecondary }]}>
                    {t('reels.commentsEmpty')}
                  </Text>
                }
              />
            )}
            <View style={[styles.commentInputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: colors.background, color: colors.text }]}
                placeholder={t('reels.commentPlaceholder')}
                placeholderTextColor={colors.textSecondary}
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
                  <Text style={styles.commentSendText}>{t('reels.send')}</Text>
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
  height: number;
  isVisible: boolean;
  onLike: () => void;
  onReact: (type: ReactionType) => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
  onRemix: () => void;
  onWeave: () => void;
  onUserPress: () => void;
  onSoundPress: () => void;
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
        {kind === 'weave' ? `⧉ Weave of @${username}` : `↻ Remix of @${username}`}
      </Text>
    </View>
  );
}

function ReelItem({
  reel,
  height,
  isVisible,
  onLike,
  onReact,
  onComment,
  onShare,
  onSave,
  onRemix,
  onWeave,
  onUserPress,
  onSoundPress,
}: ReelItemProps) {
  const { t } = useLocale();
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
    t('reels.originalSound');

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
    <View style={[styles.reelContainer, { height }]}>
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
        accessibilityLabel={t('reels.doubleTap')}
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

      {paused && isVisible ? (
        <View style={styles.pauseHint} pointerEvents="none">
          <Text style={styles.pauseIcon}>▶</Text>
        </View>
      ) : null}

      {reel.views && reel.views > 0 ? (
        <View style={styles.viewsBadge} pointerEvents="none">
          <Ionicons name="eye-outline" size={12} color="#fff" />
          <Text style={styles.viewsText}>{formatCount(reel.views)}</Text>
        </View>
      ) : null}

      {burst ? (
        <ReactionBurst key={burst.id} emoji="✨" x={burst.x} y={burst.y} onDone={() => setBurst(null)} />
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onUserPress} style={styles.sideAvatar} accessibilityLabel={displayName(reel.user)}>
          <Avatar user={reel.user} size="md" style={styles.sideAvatarRing} />
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onSave} accessibilityLabel={reel.is_saved ? t('reels.saved') : t('reels.save')}>
          <Ionicons name={reel.is_saved ? 'bookmark' : 'bookmark-outline'} size={26} color={reel.is_saved ? '#C4B5FD' : '#fff'} />
          <Text style={styles.actionCount}>{reel.is_saved ? t('reels.saved') : t('reels.save')}</Text>
        </Pressable>
        <View style={styles.reactWrap}>
          <PostReactions
            compact
            hidePills
            selectedReaction={(reel.my_reaction as ReactionType | null) ?? null}
            reactionCounts={reel.reaction_counts}
            onReact={onReact}
          />
          <Text style={styles.actionCount}>{formatCount(reel.likes_count)}</Text>
        </View>
        <Pressable style={styles.actionBtn} onPress={onComment} accessibilityLabel={t('reels.commentsTitle')}>
          <Ionicons name="chatbubbles-outline" size={26} color="#fff" />
          <Text style={styles.actionCount}>{formatCount(reel.comments_count)}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} onPress={onShare} accessibilityLabel={t('reels.share')}>
          <Ionicons name="share-outline" size={26} color="#fff" />
          <Text style={styles.actionCount}>{reel.shares_count > 0 ? formatCount(reel.shares_count) : t('reels.share')}</Text>
        </Pressable>
        {reel.allow_remix !== false ? (
          <Pressable style={styles.actionBtn} onPress={onRemix} accessibilityLabel={t('reels.remix')}>
            <Ionicons name="sync-outline" size={26} color="#fff" />
            <Text style={styles.actionCount}>{t('reels.remix')}</Text>
          </Pressable>
        ) : null}
        {reel.allow_weave !== false ? (
          <Pressable style={styles.actionBtn} onPress={onWeave} accessibilityLabel={t('reels.weave')}>
            <Ionicons name="git-merge-outline" size={26} color="#fff" />
            <Text style={styles.actionCount}>{t('reels.weave')}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.actionBtn} onPress={() => setMuted((m) => !m)} accessibilityLabel={muted ? t('reels.unmute') : t('reels.mute')}>
          <Ionicons name={muted ? 'volume-mute-outline' : 'volume-high-outline'} size={26} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.bottomInfo}>
        {reel.remix_of != null && <ReelRemixAttribution sourceId={Number(reel.remix_of)} kind="remix" />}
        {reel.stitch_of != null && <ReelRemixAttribution sourceId={Number(reel.stitch_of)} kind="weave" />}
        <Pressable onPress={onUserPress} style={styles.userRow}>
          <Text style={styles.username}>@{displayName(reel.user)}</Text>
        </Pressable>
        {reel.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {reel.caption}
          </Text>
        ) : null}
        {reel.tags?.length ? (
          <Text style={styles.tags} numberOfLines={1}>
            {reel.tags.slice(0, 4).map((tag) => `#${tag}`).join('  ')}
          </Text>
        ) : null}
        <Pressable onPress={onSoundPress} style={styles.musicRow} disabled={!reel.music_track_detail && !reel.music_track}>
          <Text style={styles.musicIcon}>♪</Text>
          <Text style={styles.musicText} numberOfLines={1}>
            {soundLabel}
          </Text>
        </Pressable>
        {isVisible ? <Text style={styles.hint}>{t('reels.doubleTap')}</Text> : null}
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
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brand: {
    color: '#C4B5FD',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tabs: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
    padding: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(10, 8, 24, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(106, 0, 255, 0.25)',
  },
  tabBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  tabBtnOn: {
    backgroundColor: 'rgba(106, 0, 255, 0.55)',
  },
  tabText: {
    color: 'rgba(248,250,252,0.65)',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextOn: {
    color: '#fff',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chromeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 10, 30, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(106, 0, 255, 0.35)',
  },
  chromeBtnAccent: {
    backgroundColor: '#6A00FF',
    borderWidth: 0,
  },
  feedRail: {
    position: 'absolute',
    right: 4,
    top: '42%',
    zIndex: 18,
    alignItems: 'center',
    gap: 5,
  },
  railDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  railDotOn: {
    height: 18,
    backgroundColor: '#22D3EE',
  },
  loadingText: {
    marginTop: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '800',
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
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    zIndex: 12,
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
    right: 10,
    bottom: 28,
    alignItems: 'center',
    zIndex: 14,
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
  reactWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sideAvatar: {
    marginBottom: 14,
  },
  sideAvatarRing: {
    borderWidth: 2,
    borderColor: 'rgba(196,181,253,0.7)',
  },
  pauseHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 7,
  },
  pauseIcon: {
    color: '#fff',
    fontSize: 42,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 12,
  },
  viewsBadge: {
    position: 'absolute',
    left: 14,
    top: 118,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,10,30,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  viewsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tags: {
    color: '#C4B5FD',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 8,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 88,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
    backgroundColor: '#2A2154',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.65,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4C3D7A',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F5F3FF',
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
    color: '#F5F3FF',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    color: '#F5F3FF',
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
    borderTopColor: '#4C3D7A',
    gap: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#14102A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 14,
    color: '#F5F3FF',
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
