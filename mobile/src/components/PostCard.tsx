import React, { useEffect, useRef, useState } from 'react';
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
  Share,
} from 'react-native';
import Video from 'react-native-video';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Avatar from './Avatar';
import PostReactions from './PostReactions';
import ReactionSummaryLine from './ReactionSummaryLine';
import CommentsThread from './CommentsThread';
import ReactionBurst from './ReactionBurst';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/auth/AuthContext';
import { useLocale } from '@/i18n/LocaleProvider';
import { mediaUrl } from '@/api/config';
import api from '../api/client';
import { displayName } from '@/lib/names';
import { countsToEmojiMap, selectedEmoji, totalReactions, type ReactionType } from '@/lib/reactions';
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
  onUserPress?: () => void;
  showPin?: boolean;
  initialCommentsOpen?: boolean;
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
  onUserPress,
  showPin,
  initialCommentsOpen,
}: PostCardProps) {
  const { colors } = useTheme();
  const { t } = useLocale();
  const { user: me } = useAuth();
  const navigation = useNavigation<any>();
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
  const [commentsOpen, setCommentsOpen] = useState(!!initialCommentsOpen);
  const [echoMenu, setEchoMenu] = useState(false);
  const [following, setFollowing] = useState(!!post.user?.is_following);
  const [followBusy, setFollowBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState(50);
  const [tipBusy, setTipBusy] = useState(false);
  const [tipStatus, setTipStatus] = useState('');
  const [localVote, setLocalVote] = useState(post.my_vote ?? null);
  const [localScore, setLocalScore] = useState(post.vote_score ?? 0);
  const [commentCount, setCommentCount] = useState(post.comments_count || 0);
  const [localReaction, setLocalReaction] = useState(post.my_reaction);
  const [localCounts, setLocalCounts] = useState(post.reaction_counts || {});

  const authorName = displayName(post.user);
  const isOwner = !!me && String(me.id) === String(post.user?.id);
  const emojiCounts = countsToEmojiMap(localCounts);
  const reactionTotal = totalReactions(emojiCounts);
  const myEmoji = selectedEmoji(localReaction);

  useEffect(() => {
    setLocalVote(post.my_vote ?? null);
    setLocalScore(post.vote_score ?? 0);
    setCommentCount(post.comments_count || 0);
    setFollowing(!!post.user?.is_following);
  }, [post.my_vote, post.vote_score, post.comments_count, post.user?.is_following]);

  useEffect(() => {
    setLocalReaction(post.my_reaction);
  }, [post.my_reaction]);

  useEffect(() => {
    setLocalCounts(post.reaction_counts || {});
  }, [post.reaction_counts]);

  const pollTotal = (post.poll_options || []).reduce((sum, option) => {
    return sum + (pollResults[String(option.id)] ?? option.vote_count ?? 0);
  }, 0);

  const handleMediaPress = (
    e: { nativeEvent: { locationX: number; locationY: number } },
    index: number,
    video: boolean,
  ) => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      const { locationX, locationY } = e.nativeEvent;
      setBurst({ id: now, x: locationX, y: locationY });
      handleReact('spark');
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
      Alert.alert(t('mobile.pollVoteFailed'), t('common.tryAgain'));
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
      Alert.alert(t('mobile.threadUnavailable'), t('mobile.constellationFail'));
    } finally {
      setThreadLoading(false);
    }
  };

  const handleReact = (type: ReactionType) => {
    const same = localReaction === type;
    const next = same ? null : type;
    const prevCounts = { ...localCounts };
    const prevReaction = localReaction;
    const nextCounts = { ...localCounts };
    if (prevReaction && nextCounts[prevReaction]) {
      nextCounts[prevReaction] = Math.max(0, (nextCounts[prevReaction] || 0) - 1);
    }
    if (next) nextCounts[next] = (nextCounts[next] || 0) + 1;
    setLocalReaction(next);
    setLocalCounts(nextCounts);
    if (onReact) {
      onReact(type);
      return;
    }
    api
      .reactToPost(post.id, next)
      .then((data) => {
        setLocalReaction(data.my_reaction);
        setLocalCounts(data.reaction_counts || {});
      })
      .catch(() => {
        setLocalReaction(prevReaction);
        setLocalCounts(prevCounts);
      });
  };

  const handleVote = async (vote: 'boost' | 'dim') => {
    const next = localVote === vote ? null : vote;
    const prevVote = localVote;
    const prevScore = localScore;
    const delta =
      (next === 'boost' ? 1 : next === 'dim' ? -1 : 0) -
      (prevVote === 'boost' ? 1 : prevVote === 'dim' ? -1 : 0);
    setLocalVote(next);
    setLocalScore(prevScore + delta);
    try {
      if (onVote) {
        onVote(next);
      } else {
        const result = await api.votePost(post.id, next);
        setLocalScore(result.vote_score);
        setLocalVote(result.my_vote);
      }
    } catch {
      setLocalVote(prevVote);
      setLocalScore(prevScore);
    }
  };

  const handleFollow = async () => {
    if (!post.user?.id || followBusy) return;
    setFollowBusy(true);
    try {
      const res = await api.toggleFollow(post.user.id);
      setFollowing(!!(res.following ?? res.is_following ?? !following));
    } catch {
      /* ignore */
    } finally {
      setFollowBusy(false);
    }
  };

  const handleSharePost = async () => {
    if (onShare) {
      onShare();
      return;
    }
    try {
      await Share.share({
        message: `${authorName}: ${post.text || ''}\nhttps://cosonova.com/post/${post.id}`,
      });
    } catch {
      /* cancelled */
    }
  };

  const handleTip = async () => {
    if (!post.user?.id || tipBusy || tipAmount <= 0) return;
    setTipBusy(true);
    setTipStatus('');
    try {
      await api.sendTip(post.user.id, tipAmount, { postId: post.id });
      setTipStatus(t('tip.sent', { amount: String(tipAmount) }));
    } catch {
      setTipStatus(t('tip.error'));
    } finally {
      setTipBusy(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          shadowColor: '#6A00FF',
        },
      ]}
    >
      <View style={styles.cardShine} />
      <View style={styles.header}>
        <Pressable
          onPress={onUserPress}
          disabled={!onUserPress}
          hitSlop={8}
          accessibilityRole={onUserPress ? 'button' : undefined}
          accessibilityLabel={onUserPress ? authorName : undefined}
          style={styles.userHit}
        >
          <Avatar name={authorName} avatar={post.user.avatar} size="md" verified={post.user.is_verified} style={styles.avatarRing} />
          <View style={styles.userInfo}>
            <View style={styles.nameRow}>
              <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                {authorName}
              </Text>
              {post.user?.is_verified ? (
                <Ionicons name="checkmark-circle" size={15} color={colors.primaryLight} />
              ) : null}
              {post.flair ? (
                <Text style={[styles.flair, { color: colors.textSecondary, backgroundColor: colors.surface }]}>
                  {post.flair}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.time, { color: colors.textSecondary }]}>{formatTime(post.created_at)}</Text>
            {post.community?.slug ? (
              <Pressable
                onPress={() => navigation.navigate('CommunityDetail', { slug: post.community?.slug })}
                hitSlop={6}
              >
                <Text style={[styles.communityLink, { color: colors.lab }]}>
                  c/{post.community.name || post.community.slug}
                  {post.is_community_pinned ? ' · 📌' : ''}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
        {!isOwner && post.user?.id && me && !following ? (
          <Pressable
            onPress={() => void handleFollow()}
            disabled={followBusy}
            style={styles.followBtn}
            accessibilityRole="button"
            accessibilityLabel={t('feed.follow')}
          >
            <Ionicons name="person-add-outline" size={14} color="#fff" />
            <Text style={styles.followText}>{t('feed.follow')}</Text>
          </Pressable>
        ) : null}
        {post.is_profile_pinned ? (
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>📌</Text>
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
            accessibilityLabel={post.is_profile_pinned ? 'Unpin signal' : 'Pin signal'}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
              {post.is_profile_pinned ? 'Unpin' : 'Pin'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {post.text ? (
        <Pressable style={styles.captionWrap} onPress={onPress} disabled={!onPress}>
          <Text
            style={[styles.caption, { color: colors.text }]}
            numberOfLines={expanded ? undefined : 3}
          >
            {post.text}
          </Text>
          {post.text.length > 120 ? (
            <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
              <Text style={styles.seeMore}>{expanded ? t('feed.seeLess') : t('feed.seeMore')}</Text>
            </Pressable>
          ) : null}
          {post.edited_at ? (
            <Text style={[styles.edited, { color: colors.textSecondary }]}>{t('feed.edited')}</Text>
          ) : null}
        </Pressable>
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
                    accessibilityLabel={video ? 'Post video, double-tap to react' : 'Post image, double-tap to react'}
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

      <View style={styles.engagement}>
        <View style={[styles.voteBar, { borderColor: 'rgba(167,139,250,0.16)' }]}>
          <Pressable
            onPress={() => void handleVote('boost')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('comments.boost')}
          >
            <Ionicons name="caret-up" size={20} color={localVote === 'boost' ? '#A78BFA' : colors.textSecondary} />
          </Pressable>
          <Text
            style={[
              styles.voteScore,
              { color: localScore > 0 ? '#A78BFA' : localScore < 0 ? '#22D3EE' : colors.textSecondary },
            ]}
          >
            {localScore}
          </Text>
          <Pressable
            onPress={() => void handleVote('dim')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('comments.dim')}
          >
            <Ionicons name="caret-down" size={20} color={localVote === 'dim' ? '#22D3EE' : colors.textSecondary} />
          </Pressable>
          {!isOwner && post.user?.id ? (
            <View>
              <Pressable
                onPress={() => setTipOpen((v) => !v)}
                style={styles.tipTrigger}
                accessibilityRole="button"
                accessibilityLabel={t('tip.send')}
              >
                <Ionicons name="gift-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.tipLabel, { color: colors.textSecondary }]}>{t('tip.send')}</Text>
              </Pressable>
              {tipOpen ? (
                <View style={[styles.tipPanel, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <Text style={[styles.tipTitle, { color: colors.text }]}>{t('tip.pickAmount')}</Text>
                  <View style={styles.tipAmounts}>
                    {[10, 50, 100, 500].map((amt) => (
                      <Pressable
                        key={amt}
                        onPress={() => setTipAmount(amt)}
                        style={[
                          styles.tipAmt,
                          { backgroundColor: tipAmount === amt ? colors.primary : colors.surface },
                        ]}
                      >
                        <Text style={{ color: tipAmount === amt ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                          {amt} ✨
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => void handleTip()}
                    disabled={tipBusy}
                    style={[styles.tipSend, { backgroundColor: colors.primary, opacity: tipBusy ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                      {tipBusy ? t('common.loading') : t('tip.send')}
                    </Text>
                  </Pressable>
                  {tipStatus ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>{tipStatus}</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {reactionTotal > 0 ? (
          <ReactionSummaryLine
            total={reactionTotal}
            myReaction={myEmoji}
            reactionCounts={emojiCounts}
            topReactors={post.top_reactors || []}
          />
        ) : null}

        <View style={styles.engagementRow}>
          <PostReactions
            selectedReaction={(localReaction as ReactionType | null) ?? null}
            reactionCounts={localCounts}
            onReact={handleReact}
          />
        </View>

        <View style={styles.actionChips}>
          <View style={styles.viewsStat}>
            <Ionicons name="eye-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.viewsText, { color: colors.textSecondary }]}>
              {post.views && post.views > 0 ? formatCount(post.views) : '—'}
            </Text>
          </View>

          <Pressable
            onPress={() => setCommentsOpen((v) => !v)}
            style={[
              styles.chip,
              commentsOpen && styles.chipActive,
              { borderColor: commentsOpen ? 'rgba(0,204,255,0.4)' : 'rgba(106,0,255,0.15)' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={commentsOpen ? t('feed.hideComments') : t('feed.discuss')}
          >
            <Ionicons name="chatbubbles-outline" size={18} color={colors.icon} />
            <Text style={[styles.chipLabel, { color: colors.text }]}>
              {commentsOpen ? t('feed.hideComments') : t('feed.discuss')}
            </Text>
            {commentCount > 0 ? (
              <View style={styles.chipCount}>
                <Text style={styles.chipCountText}>{formatCount(commentCount)}</Text>
              </View>
            ) : null}
          </Pressable>

          {onEcho || onQuote || onCrossEcho ? (
            <View>
              <Pressable
                onPress={() => setEchoMenu((v) => !v)}
                style={[
                  styles.chip,
                  post.my_repost != null && styles.chipActive,
                  { borderColor: post.my_repost != null ? 'rgba(0,204,255,0.4)' : 'rgba(106,0,255,0.15)' },
                ]}
                accessibilityRole="button"
                accessibilityLabel={t('feed.repost')}
              >
                <Ionicons
                  name="repeat-outline"
                  size={18}
                  color={post.my_repost != null ? colors.primary : colors.icon}
                />
                <Text style={[styles.chipLabel, { color: post.my_repost != null ? colors.primary : colors.text }]}>
                  {t('feed.repost')}
                </Text>
                {post.reposts_count > 0 ? (
                  <View style={styles.chipCount}>
                    <Text style={styles.chipCountText}>{formatCount(post.reposts_count)}</Text>
                  </View>
                ) : null}
              </Pressable>
              {echoMenu ? (
                <View style={[styles.echoMenu, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  {onEcho ? (
                    <Pressable
                      onPress={() => {
                        setEchoMenu(false);
                        onEcho();
                      }}
                      style={styles.echoItem}
                    >
                      <Ionicons name="repeat-outline" size={18} color={colors.icon} />
                      <Text style={{ color: colors.text, fontWeight: '700' }}>
                        {post.my_repost != null ? t('feed.undoRepost') : t('feed.echo')}
                      </Text>
                    </Pressable>
                  ) : null}
                  {onQuote ? (
                    <Pressable
                      onPress={() => {
                        setEchoMenu(false);
                        setQuoteOpen(true);
                      }}
                      style={styles.echoItem}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.icon} />
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{t('feed.quote')}</Text>
                    </Pressable>
                  ) : null}
                  {onCrossEcho ? (
                    <Pressable
                      onPress={() => {
                        setEchoMenu(false);
                        onCrossEcho();
                      }}
                      style={styles.echoItem}
                    >
                      <Ionicons name="git-branch-outline" size={18} color={colors.icon} />
                      <Text style={{ color: colors.text, fontWeight: '700' }}>Cross-Echo</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={() => void handleSharePost()}
            style={[styles.chip, { borderColor: 'rgba(106,0,255,0.15)' }]}
            accessibilityRole="button"
            accessibilityLabel={t('feed.share')}
          >
            <Ionicons name="share-outline" size={18} color={colors.icon} />
            <Text style={[styles.chipLabel, { color: colors.text }]}>{t('feed.share')}</Text>
            {post.shares_count > 0 ? (
              <View style={styles.chipCount}>
                <Text style={styles.chipCountText}>{formatCount(post.shares_count)}</Text>
              </View>
            ) : null}
          </Pressable>

          {onSave ? (
            <Pressable
              onPress={onSave}
              style={[styles.chip, { borderColor: 'rgba(106,0,255,0.15)' }]}
              accessibilityRole="button"
              accessibilityLabel={post.is_saved ? 'Remove from saved' : 'Save post'}
            >
              <Ionicons
                name={post.is_saved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={post.is_saved ? colors.primary : colors.icon}
              />
            </Pressable>
          ) : null}
          {onShareToStory ? (
            <Pressable
              onPress={onShareToStory}
              style={[styles.chip, { borderColor: 'rgba(106,0,255,0.15)' }]}
              accessibilityRole="button"
              accessibilityLabel={t('feed.shareToStory')}
            >
              <Ionicons name="ellipse-outline" size={18} color={colors.primaryLight} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <CommentsThread
        postId={post.id}
        postOwnerId={post.user?.id}
        open={commentsOpen}
        onAdded={() => setCommentCount((n) => n + 1)}
      />

      <Modal visible={quoteOpen} transparent animationType="fade" onRequestClose={() => setQuoteOpen(false)}>
        <View style={styles.quoteBackdrop}>
          <View style={[styles.quoteSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.quoteTitle, { color: colors.text }]}>{t('feed.quoteTitle')}</Text>
            <TextInput
              value={quoteText}
              onChangeText={setQuoteText}
              placeholder={t('feed.quotePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[styles.quoteInput, { color: colors.text, borderColor: colors.border }]}
            />
            <View style={styles.quoteActions}>
              <Pressable onPress={() => setQuoteOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const next = quoteText.trim();
                  if (!next) return;
                  onQuote?.(next);
                  setQuoteText('');
                  setQuoteOpen(false);
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('feed.quoteSubmit')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    marginBottom: 16,
    overflow: 'visible',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  cardShine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  userHit: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 44,
  },
  avatarRing: {
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.42)',
  },
  userInfo: {
    marginLeft: 10,
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  flair: {
    fontSize: 10,
    fontWeight: '700',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  communityLink: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginEnd: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#7C3AED',
  },
  followText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  time: {
    fontSize: 12,
  },
  caption: {
    fontSize: 16,
    paddingHorizontal: 24,
    paddingBottom: 4,
    lineHeight: 24,
  },
  captionWrap: {
    paddingBottom: 10,
  },
  seeMore: {
    paddingHorizontal: 24,
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: '#A78BFA',
  },
  edited: {
    paddingHorizontal: 24,
    marginTop: 4,
    fontSize: 11,
  },
  badgeRow: {
    paddingHorizontal: 24,
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
    paddingHorizontal: 24,
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
    overflow: 'hidden',
    borderRadius: 4,
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
    paddingHorizontal: 24,
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
  engagement: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(167,139,250,0.18)',
  },
  voteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
  voteScore: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
  tipTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginStart: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tipLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  tipPanel: {
    position: 'absolute',
    top: 36,
    start: 0,
    zIndex: 40,
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  tipAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tipAmt: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tipSend: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  engagementRow: {
    marginBottom: 8,
  },
  actionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  viewsStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  viewsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(106,0,255,0.08)',
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: 'rgba(106,0,255,0.22)',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(0,204,255,0.2)',
  },
  chipCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F5F3FF',
    textAlign: 'center',
  },
  echoMenu: {
    position: 'absolute',
    bottom: 44,
    end: 0,
    zIndex: 30,
    minWidth: 180,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 6,
  },
  echoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
