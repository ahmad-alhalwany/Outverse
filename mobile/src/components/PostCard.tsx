import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  LayoutChangeEvent,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import Video from 'react-native-video';
import Avatar from './Avatar';
import ReactionPicker from './ReactionPicker';
import ReactionBurst from './ReactionBurst';
import { useTheme } from '@/hooks/useTheme';
import { mediaUrl } from '@/api/config';
import api from '../api/client';
import type { ReactionType } from '@/lib/reactions';
import type { Post, PostMedia } from '../types';

interface PostCardProps {
  post: Post;
  onReact?: (type: ReactionType) => void;
  onComment?: () => void;
  onShare?: () => void;
  onShareToStory?: () => void;
  onEcho?: () => void;
  onQuote?: (text: string) => void;
  onSave?: () => void;
  onPin?: () => void;
  onCrossEcho?: () => void;
  onVote?: (vote: 'boost' | 'dim' | null) => void;
  onPress?: () => void;
  showPin?: boolean;
}

const DOUBLE_TAP_MS = 320;

function mediaSrc(media: PostMedia | undefined) {
  if (!media) return '';
  return mediaUrl(media.media_file || media.url || media.file);
}

function isVideo(media: PostMedia | undefined) {
  if (!media) return false;
  const t = media.media_type || media.file_type || media.type;
  return t === 'video';
}

export default function PostCard({
  post,
  onReact,
  onComment,
  onShare,
  onShareToStory,
  onEcho,
  onQuote,
  onSave,
  onPin,
  onCrossEcho,
  onVote,
  onPress,
  showPin,
}: PostCardProps) {
  const { colors } = useTheme();
  const mediaItems = (post.media || []).filter((m) => !!mediaSrc(m));
  const lastTap = useRef(0);
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  const [page, setPage] = useState(0);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [slideW, setSlideW] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [pollVote, setPollVote] = useState<number | null>(post.my_poll_vote ?? null);
  const [pollResults, setPollResults] = useState<Record<string, number>>(post.poll_results || {});
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadPosts, setThreadPosts] = useState<Post[]>([]);

  const pollTotal = (post.poll_options || []).reduce((sum, option) => {
    return sum + (pollResults[String(option.id)] ?? option.vote_count ?? 0);
  }, 0);

  const openEchoSheet = () => {
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [];
    if (onEcho) {
      buttons.push({
        text: post.my_repost != null ? 'Undo Echo' : 'Echo',
        onPress: () => onEcho(),
      });
    }
    if (onQuote) {
      buttons.push({
        text: 'Quote Signal',
        onPress: () => setQuoteOpen(true),
      });
    }
    if (onShare) {
      buttons.push({ text: 'Share…', onPress: () => onShare() });
    }
    if (onCrossEcho) {
      buttons.push({ text: 'Cross-Echo', onPress: () => onCrossEcho() });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Signal actions', undefined, buttons);
  };

  const handleMediaPress = (
    e: { nativeEvent: { locationX: number; locationY: number } },
    index: number,
    video: boolean,
  ) => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      const { locationX, locationY } = e.nativeEvent;
      setBurst({ id: now, x: locationX, y: locationY });
      onReact?.('spark');
      lastTap.current = now;
      return;
    }
    lastTap.current = now;
    if (video) {
      setPlayingIndex((cur) => (cur === index ? null : index));
    }
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!slideW) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / slideW);
    setPage(next);
    setPlayingIndex(null);
  };

  const onMediaLayout = (e: LayoutChangeEvent) => {
    setSlideW(e.nativeEvent.layout.width);
  };

  const handlePollVote = async (optionId: number) => {
    try {
      const data = await api.votePoll(post.id, optionId);
      setPollVote(data?.my_poll_vote ?? data?.option_id ?? optionId);
      if (data?.poll_results) {
        setPollResults(data.poll_results);
      } else if (data?.post?.poll_results) {
        setPollResults(data.post.poll_results);
      } else {
        setPollResults((prev) => ({
          ...prev,
          ...(pollVote != null && pollVote !== optionId
            ? { [String(pollVote)]: Math.max((prev[String(pollVote)] ?? 1) - 1, 0) }
            : {}),
          [String(optionId)]: (prev[String(optionId)] ?? 0) + (pollVote === optionId ? 0 : 1),
        }));
      }
    } catch {
      Alert.alert('Poll vote failed', 'Please try again.');
    }
  };

  const toggleThread = async () => {
    if (threadOpen) {
      setThreadOpen(false);
      return;
    }
    setThreadOpen(true);
    if (threadPosts.length) return;
    setThreadLoading(true);
    try {
      const rows = await api.getThread(post.id);
      setThreadPosts(rows);
    } catch {
      Alert.alert('Thread unavailable', 'Could not load this constellation.');
    } finally {
      setThreadLoading(false);
    }
  };

  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <View style={styles.header}>
        <Avatar name={post.user.username} avatar={post.user.avatar} size="md" verified={post.user.is_verified} />
        <View style={styles.userInfo}>
          <Text style={[styles.username, { color: colors.text }]}>{post.user?.username || 'مستخدم'}</Text>
          <Text style={[styles.time, { color: colors.textSecondary }]}>{formatTime(post.created_at)}</Text>
        </View>
        {post.is_profile_pinned ? (
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>📌 Pinned</Text>
        ) : null}
        {post.reply_control && post.reply_control !== 'everyone' ? (
          <Text style={{ color: colors.textSecondary, fontSize: 11, marginLeft: 6 }}>🔒</Text>
        ) : null}
        {showPin && onPin ? (
          <Pressable
            onPress={onPin}
            hitSlop={8}
            style={{ marginLeft: 8 }}
            accessibilityRole="button"
            accessibilityLabel={post.is_profile_pinned ? 'إلغاء التثبيت' : 'تثبيت المنشور'}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
              {post.is_profile_pinned ? 'Unpin' : 'Pin'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {post.text ? (
        <View style={styles.captionWrap}>
          <Text
            style={[styles.caption, { color: colors.text }]}
            numberOfLines={expanded ? undefined : 3}
          >
            {post.text}
          </Text>
          {post.text.length > 120 ? (
            <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
              <Text style={styles.seeMore}>{expanded ? 'عرض أقل' : 'عرض المزيد'}</Text>
            </Pressable>
          ) : null}
          {post.edited_at ? (
            <Text style={[styles.edited, { color: colors.textSecondary }]}>تم التعديل</Text>
          ) : null}
        </View>
      ) : null}

      {post.location_name ? (
        <View style={styles.badgeRow}>
          <Text style={[styles.locationBadge, { color: colors.primary, borderColor: colors.border }]}>
            📍 {post.location_name}
          </Text>
        </View>
      ) : null}

      {post.post_type === 'poll' && post.poll_options?.length ? (
        <View style={styles.pollWrap}>
          {post.poll_options.map((option) => {
            const votes = pollResults[String(option.id)] ?? option.vote_count ?? 0;
            const percent = pollTotal > 0 ? Math.round((votes / pollTotal) * 100) : 0;
            const selected = pollVote === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => void handlePollVote(option.id)}
                style={[styles.pollOption, { borderColor: selected ? colors.primary : colors.border }]}
              >
                <View style={[styles.pollFill, { width: `${percent}%`, backgroundColor: 'rgba(167,139,250,0.18)' }]} />
                <View style={styles.pollContent}>
                  <Text style={[styles.pollText, { color: colors.text }]}>{option.text}</Text>
                  <Text style={[styles.pollPercent, { color: selected ? colors.primary : colors.textSecondary }]}>
                    {selected ? '✓ ' : ''}{percent}%
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Text style={[styles.pollMeta, { color: colors.textSecondary }]}>{formatCount(pollTotal)} votes</Text>
        </View>
      ) : null}

      {mediaItems.length > 0 ? (
        <View style={styles.mediaShell} onLayout={onMediaLayout}>
          {slideW > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              decelerationRate="fast"
            >
              {mediaItems.map((item, index) => {
                const uri = mediaSrc(item);
                const video = isVideo(item);
                const playing = playingIndex === index;
                return (
                  <Pressable
                    key={`${item.id ?? index}-${uri}`}
                    style={[styles.mediaSlide, { width: slideW }]}
                    onPress={(e) => handleMediaPress(e, index, video)}
                    accessibilityRole="image"
                    accessibilityLabel={video ? 'فيديو المنشور، اضغط مرتين للتفاعل' : 'صورة المنشور، اضغط مرتين للتفاعل'}
                  >
                    {video ? (
                      <>
                        <Video
                          source={{ uri }}
                          style={styles.media}
                          resizeMode="cover"
                          paused={!playing}
                          repeat
                          muted={!playing}
                          poster={item.thumbnail_url || item.thumbnail}
                          controls={playing}
                        />
                        {!playing ? (
                          <View style={styles.playOverlay} pointerEvents="none">
                            <View style={styles.playBtn}>
                              <Text style={styles.playBtnText}>▶</Text>
                            </View>
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <Image source={{ uri }} style={styles.media} resizeMode="cover" />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {mediaItems.length > 1 ? (
            <View style={styles.dots}>
              {mediaItems.map((_, i) => (
                <View key={`dot-${i}`} style={[styles.dot, i === page ? styles.dotActive : null]} />
              ))}
            </View>
          ) : null}

          {mediaItems.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {page + 1}/{mediaItems.length}
              </Text>
            </View>
          ) : null}

          {burst ? (
            <ReactionBurst key={burst.id} emoji="✨" x={burst.x} y={burst.y} onDone={() => setBurst(null)} />
          ) : null}
        </View>
      ) : null}

      {(post.thread_count ?? 0) > 1 ? (
        <View style={styles.threadWrap}>
          <Pressable onPress={() => void toggleThread()} style={[styles.threadButton, { borderColor: colors.border }]}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>
              Constellation · {post.thread_count} parts
            </Text>
          </Pressable>
          {threadOpen ? (
            <View style={styles.threadInline}>
              {threadLoading ? (
                <Text style={{ color: colors.textSecondary }}>Loading constellation…</Text>
              ) : (
                threadPosts
                  .filter((item) => item.id !== post.id && !!item.text)
                  .map((item, idx) => (
                    <View key={String(item.id)} style={[styles.threadInlinePart, { borderColor: colors.border }]}>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                        Part {item.thread_seq ?? idx + 2}
                      </Text>
                      <Text style={{ color: colors.text, marginTop: 4, lineHeight: 20 }}>{item.text}</Text>
                    </View>
                  ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        {onVote ? (
          <View style={[styles.action, { gap: 8 }]}>
            <Pressable
              onPress={() => onVote(post.my_vote === 'boost' ? null : 'boost')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={post.my_vote === 'boost' ? 'إلغاء التعزيز' : 'تعزيز المنشور'}
              style={({ pressed }) => [pressed && styles.pressedDim]}
            >
              <Text style={{ color: post.my_vote === 'boost' ? '#22c55e' : colors.textSecondary, fontWeight: '700' }}>
                ▲
              </Text>
            </Pressable>
            <Text style={[styles.actionText, { color: colors.text }]}>{post.vote_score ?? 0}</Text>
            <Pressable
              onPress={() => onVote(post.my_vote === 'dim' ? null : 'dim')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={post.my_vote === 'dim' ? 'إلغاء التخفيض' : 'تخفيض المنشور'}
              style={({ pressed }) => [pressed && styles.pressedDim]}
            >
              <Text style={{ color: post.my_vote === 'dim' ? '#ef4444' : colors.textSecondary, fontWeight: '700' }}>
                ▼
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.action}>
          <ReactionPicker
            selectedReaction={(post.my_reaction as ReactionType | null) ?? null}
            reactionCounts={post.reaction_counts}
            onReact={(type) => onReact?.(type)}
          />
        </View>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressedDim]}
          onPress={onComment}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`التعليقات، ${formatCount(post.comments_count)}`}
        >
          <Text style={[styles.actionText, { color: colors.textSecondary }]}>💬 {formatCount(post.comments_count)}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressedDim]}
          onPress={onEcho || onQuote || onCrossEcho ? openEchoSheet : onShare}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`إعادة النشر، ${formatCount(post.reposts_count)}`}
        >
          <Text style={[styles.actionText, { color: post.my_repost != null ? colors.primary : colors.textSecondary }]}>
            🔁 {formatCount(post.reposts_count)}
          </Text>
        </Pressable>
        {onSave ? (
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressedDim]}
            onPress={onSave}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={post.is_saved ? 'إزالة من المحفوظات' : 'حفظ المنشور'}
          >
            <Text style={[styles.actionText, { color: post.is_saved ? colors.primary : colors.textSecondary }]}>
              {post.is_saved ? '🔖' : '📑'}
            </Text>
          </Pressable>
        ) : null}
        {onShareToStory ? (
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressedDim]}
            onPress={onShareToStory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="مشاركة في الستوري"
          >
            <Text style={[styles.actionText, { color: '#A78BFA' }]}>◎ Story</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={quoteOpen} transparent animationType="fade" onRequestClose={() => setQuoteOpen(false)}>
        <View style={styles.quoteBackdrop}>
          <View style={[styles.quoteSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.quoteTitle, { color: colors.text }]}>Quote Signal</Text>
            <TextInput
              value={quoteText}
              onChangeText={setQuoteText}
              placeholder="Add your signal…"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[styles.quoteInput, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={styles.quoteActions}>
              <Pressable onPress={() => setQuoteOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const t = quoteText.trim();
                  if (!t) return;
                  onQuote?.(t);
                  setQuoteText('');
                  setQuoteOpen(false);
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Quote</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n || 0);
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ي`;
  return new Date(dateStr).toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  userInfo: {
    marginLeft: 10,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
  },
  caption: {
    fontSize: 15,
    paddingHorizontal: 14,
    paddingBottom: 4,
    lineHeight: 22,
  },
  captionWrap: {
    paddingBottom: 10,
  },
  seeMore: {
    paddingHorizontal: 14,
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA',
  },
  edited: {
    paddingHorizontal: 14,
    marginTop: 4,
    fontSize: 11,
  },
  badgeRow: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
  },
  locationBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
  },
  pollWrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  pollOption: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  pollFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  pollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pollText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  pollPercent: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: '800',
  },
  pollMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  mediaShell: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0f0a1f',
    position: 'relative',
  },
  mediaSlide: {
    height: '100%',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,6,20,0.28)',
  },
  playBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.5)',
  },
  playBtnText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 3,
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 14,
    backgroundColor: '#A78BFA',
  },
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(15,10,31,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  counterText: {
    color: '#F5F3FF',
    fontSize: 11,
    fontWeight: '700',
  },
  threadWrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  threadButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  threadInline: {
    marginTop: 10,
    gap: 8,
  },
  threadInlinePart: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  pressedDim: {
    opacity: 0.55,
  },
  actionText: {
    fontSize: 14,
  },
  quoteBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  quoteSheet: {
    borderRadius: 16,
    padding: 16,
  },
  quoteTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  quoteInput: {
    minHeight: 90,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  quoteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 20,
  },
});
