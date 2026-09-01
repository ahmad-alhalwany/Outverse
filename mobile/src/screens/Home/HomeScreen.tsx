import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  Pressable,
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePosts } from '../../hooks/usePosts';
import { useStories } from '../../hooks/useStories';
import { useAds } from '../../hooks/useAds';
import { useNotifications } from '../../hooks/useNotifications';
import { api } from '../../api/client';
import { mediaUrl } from '../../api/config';
import PostCard from '../../components/PostCard';
import FeedSkeleton from '../../components/FeedSkeleton';
import StoryViewer from '../../components/StoryViewer';
import AdCard from '../../components/ads/AdCard';
import FeedHero from '../../components/home/FeedHero';
import DailyRitualPanel from '../../components/home/DailyRitualPanel';
import DailyChallengeBanner from '../../components/home/DailyChallengeBanner';
import HomeStoriesRail from '../../components/home/HomeStoriesRail';
import CreatePostComposer from '../../components/home/CreatePostComposer';
import HomeDiscoverRail from '../../components/home/HomeDiscoverRail';
import { useTheme } from '../../hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import type { Post, Story } from '../../types';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';

const AD_FREQUENCY = 5;

type HomeFeed = 'for_you' | 'following' | 'joined' | 'discover';
type StoryMode = 'all' | 'following';

const FEED_TAB_KEYS: { key: HomeFeed; labelKey: string }[] = [
  { key: 'for_you', labelKey: 'feed.feedForYou' },
  { key: 'following', labelKey: 'feed.feedFollowing' },
  { key: 'joined', labelKey: 'feed.feedResonance' },
];

function asStories(data: unknown): Story[] {
  if (Array.isArray(data)) return data as Story[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: Story[] }).results)) {
    return (data as { results: Story[] }).results;
  }
  return [];
}

export default function HomeScreen() {
  const navigation = useNavigation();
  const { colors, isDark, toggleColorScheme } = useTheme();
  const { t } = useLocale();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const gutter = isCompact ? 12 : width >= 768 ? 28 : 16;
  const [feed, setFeed] = useState<HomeFeed>('for_you');
  const { posts, setPosts, loading, error, refreshing, loadMore, refresh, react } = usePosts({
    limit: 10,
    feed,
  });
  const { stories: allStories, viewStory, load: reloadStories } = useStories();
  const { unreadCount } = useNotifications();
  const { currentAd, fetchAd, logImpression, logClick } = useAds();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [spotlightStories, setSpotlightStories] = useState<Story[]>([]);
  const [storyMode, setStoryMode] = useState<StoryMode>('all');
  const [followingStories, setFollowingStories] = useState<Story[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Array<{ id: number | string; slug: string; name: string }>>([]);
  const adFetchedRef = useRef(false);
  const stories = storyMode === 'following' ? followingStories : allStories;

  useEffect(() => {
    if (!adFetchedRef.current) {
      adFetchedRef.current = true;
      fetchAd('feed');
    }
  }, [fetchAd]);

  useEffect(() => {
    void (async () => {
      try {
        const spotlightRows = await api.getSpotlightStories();
        setSpotlightStories(asStories(spotlightRows));
      } catch {
        setSpotlightStories([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (storyMode !== 'following') return;
    void (async () => {
      try {
        setFollowingStories(asStories(await api.getFollowingStories()));
      } catch {
        setFollowingStories([]);
      }
    })();
  }, [storyMode]);

  useEffect(() => {
    void (async () => {
      try {
        const page = await api.getCommunities({ mine: true, limit: 30 });
        const results = (page.results || []) as { id: number | string; slug: string; name: string }[];
        setJoinedCommunities(
          results.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
          })),
        );
      } catch {
        setJoinedCommunities([]);
      }
    })();
  }, []);

  const patchPost = useCallback((postId: string | number, patch: Partial<Post>) => {
    setPosts((prev) => prev.map((p) => (String(p.id) === String(postId) ? { ...p, ...patch } : p)));
  }, [setPosts]);

  const sharePostToStory = useCallback(async (post: Post) => {
    const m = post.media?.[0];
    const uri = mediaUrl(m?.media_file || m?.url || m?.file || m?.thumbnail_url || '') || '';
    if (!uri) {
      Alert.alert(t('mobile.noMediaTitle'), t('mobile.noMediaStory'));
      return;
    }
    try {
      await api.sharePostToStory(post.id, uri);
      Alert.alert(t('mobile.onYourStoryTitle'), t('mobile.onYourStory'));
      void reloadStories();
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotShareStory'));
    }
  }, [reloadStories]);

  const handleEcho = useCallback(async (post: Post) => {
    try {
      const result = await api.repostPost(post.id);
      patchPost(post.id, {
        my_repost: result.reposted ? 1 : null,
        reposts_count: typeof result.reposts_count === 'number' ? result.reposts_count : post.reposts_count,
      });
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotEcho'));
    }
  }, [patchPost]);

  const handleQuote = useCallback(async (post: Post, text: string) => {
    try {
      await api.repostPost(post.id, text);
      patchPost(post.id, { reposts_count: (post.reposts_count || 0) + 1 });
      Alert.alert(t('mobile.quotedTitle'), t('mobile.quotedLive'));
      void refresh();
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotQuote'));
    }
  }, [patchPost, refresh]);

  const handleSave = useCallback(async (post: Post) => {
    try {
      const collections = await api.getCollections();
      if (!collections.length) {
        const result = await api.toggleSavePost(post.id);
        patchPost(post.id, { is_saved: result.saved });
        return;
      }
      Alert.alert(
        t('mobile.saveToVault'),
        t('mobile.pickFolder'),
        [
          {
            text: t('mobile.vaultDefault'),
            onPress: () => {
              void (async () => {
                const result = await api.toggleSavePost(post.id);
                patchPost(post.id, { is_saved: result.saved });
              })();
            },
          },
          ...collections.slice(0, 5).map((c) => ({
            text: c.name,
            onPress: () => {
              void (async () => {
                const result = await api.toggleSavePost(post.id, c.id);
                patchPost(post.id, { is_saved: result.saved });
              })();
            },
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ],
      );
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotSaveVault'));
    }
  }, [patchPost]);

  const handleCrossEcho = useCallback(async (post: Post) => {
    if (!joinedCommunities.length) {
      Alert.alert(t('mobile.joinCommunityTitle'), t('mobile.joinACommunity'));
      return;
    }
    Alert.alert(
      t('mobile.crossEchoTitle'),
      t('mobile.shareIntoCommunity'),
      [
        ...joinedCommunities.slice(0, 6).map((c) => ({
          text: c.name,
          onPress: () => {
            void (async () => {
              try {
                await api.crossEchoPost(post.id, { community_id: c.id });
                Alert.alert(t('mobile.crossEchoedTitle'), t('mobile.crossEchoed', { name: c.name }));
              } catch {
                Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotCrossEcho'));
              }
            })();
          },
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
    );
  }, [joinedCommunities]);

  const renderItem = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      const showAd = currentAd && (index + 1) % AD_FREQUENCY === 0;
      return (
        <>
          <PostCard
            post={item}
            onReact={(type) => react(String(item.id), type)}
            onUserPress={() => openProfile(navigation as any, item.user?.username)}
            onShareToStory={() => void sharePostToStory(item)}
            onEcho={() => void handleEcho(item)}
            onQuote={(text) => void handleQuote(item, text)}
            onSave={() => void handleSave(item)}
            onCrossEcho={() => void handleCrossEcho(item)}
            onVote={(vote) => {
              void (async () => {
                try {
                  const result = await api.votePost(item.id, vote);
                  patchPost(item.id, {
                    vote_score: result.vote_score,
                    my_vote: result.my_vote,
                  });
                } catch {
                  Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotAmplify'));
                }
              })();
            }}
          />
          {showAd ? (
            <AdCard
              ad={currentAd}
              placement="feed"
              onImpression={logImpression}
              logClick={logClick}
            />
          ) : null}
        </>
      );
    },
    [react, currentAd, logImpression, logClick, sharePostToStory, handleEcho, handleQuote, handleSave, handleCrossEcho, patchPost, navigation]
  );

  const handleStoryPress = useCallback((_story: Story, index: number) => {
    setStoryIndex(index);
    setViewerOpen(true);
  }, []);

  const handleAddStory = useCallback(() => {
    navigation.navigate('StoryStudio' as never);
  }, [navigation]);

  const handleViewStory = useCallback(
    (storyId: string | number) => {
      viewStory(storyId);
    },
    [viewStory]
  );

  const emptyTitle =
    feed === 'following'
      ? t('mobile.emptyFollowingTitle')
      : feed === 'joined'
        ? t('feed.emptyResonanceTitle')
        : t('mobile.emptyForYouTitle');
  const emptyBody =
    feed === 'following'
      ? t('mobile.emptyFollowingBody')
      : feed === 'joined'
        ? t('feed.emptyResonanceBody')
        : t('mobile.emptyForYouBody');

  const listHeader = React.useMemo(
    () => (
    <View>
      <FeedHero />
      <DailyRitualPanel />
      <DailyChallengeBanner />
      <HomeStoriesRail
        stories={stories}
        spotlight={spotlightStories}
        feedMode={storyMode}
        onFeedMode={setStoryMode}
        onStoryPress={handleStoryPress}
        onSpotlightPress={(index) => {
          setSpotlightIndex(index);
          setSpotlightOpen(true);
        }}
        onAddStory={handleAddStory}
      />
      <CreatePostComposer onPublished={refresh} />
      <HomeDiscoverRail />
      <View style={[styles.tabsWrap, isCompact && styles.tabsWrapCompact]}>
        <View style={[styles.feedTabs, { backgroundColor: isDark ? 'rgba(42,33,84,0.8)' : colors.surface, borderColor: 'rgba(156,39,176,0.1)', flexShrink: 1 }]}>
          {FEED_TAB_KEYS.map((tab) => {
            const active = feed === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setFeed(tab.key)} style={styles.feedTab}>
                {active ? (
                  <LinearGradient colors={['#9C27B0', '#2196F3', '#4CAF50']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.feedTabActive}>
                    <Text style={styles.feedTabActiveText}>{t(tab.labelKey)}</Text>
                  </LinearGradient>
                ) : (
                  <Text style={[styles.feedTabText, { color: colors.textSecondary }]}>{t(tab.labelKey)}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => refresh()} style={styles.refreshBtn} accessibilityLabel={t('feed.refresh')}>
          <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.refreshText, { color: colors.textSecondary }]}>{t('feed.refresh')}</Text>
        </Pressable>
      </View>
    </View>
    ),
    [stories, spotlightStories, storyMode, handleStoryPress, handleAddStory, isDark, colors.surface, colors.textSecondary, feed, t, refresh, isCompact],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.chromePad, { paddingHorizontal: gutter }]}>
        <View
          style={[
            styles.chrome,
            {
              backgroundColor: isDark ? 'rgba(20,16,42,0.78)' : 'rgba(255,255,255,0.82)',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.border,
            },
          ]}
        >
          <View style={styles.brandRow}>
            <Image source={require('../../../assets/icon.png')} style={styles.brandLogo} />
            <Text style={[styles.brand, { color: colors.text }]}>Cosonova</Text>
          </View>
          <View style={[styles.topCluster, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.06)' }]}>
            <Pressable
              onPress={toggleColorScheme}
              accessibilityRole="button"
              accessibilityLabel={t('mobile.darkUniverse')}
              style={styles.iconBtn}
            >
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={20} color={colors.icon} />
            </Pressable>
            <Pressable
              onPress={() => (navigation as any).navigate('Search')}
              accessibilityRole="button"
              accessibilityLabel={t('common.search')}
              style={styles.iconBtn}
            >
              <Ionicons name="search-outline" size={20} color={colors.icon} />
            </Pressable>
            <Pressable
              onPress={() => (navigation as any).navigate('Notifications')}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.title')}
              style={styles.iconBtn}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.icon} />
              {unreadCount > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: colors.error }]}>{t('feed.loadError')}</Text>
          <Pressable onPress={() => refresh()} style={[styles.retry, { backgroundColor: colors.vault }]} accessibilityRole="button">
            <Text style={styles.retryText}>{t('feed.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      <FlatList
        data={loading && posts.length === 0 ? [] : posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingHorizontal: gutter }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={listHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
              reloadStories();
              fetchAd('feed');
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <FeedSkeleton count={3} />
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.10)' }]}>
                <Ionicons name="planet-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{emptyTitle}</Text>
              <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{emptyBody}</Text>
              {feed === 'joined' ? (
                <Pressable onPress={() => (navigation as any).navigate('Communities')} style={styles.emptyCta}>
                  <LinearGradient colors={['#9C27B0', '#2196F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyCtaInner}>
                    <Text style={styles.emptyCtaText}>{t('feed.browseCommunities')}</Text>
                  </LinearGradient>
                </Pressable>
              ) : feed === 'following' ? (
                <Pressable onPress={() => setFeed('for_you')}>
                  <Text style={[styles.emptyLink, { color: colors.vault }]}>{t('mobile.viewForYou')}</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => (navigation as any).navigate('Create', { mode: 'post' })} style={styles.emptyCta}>
                  <LinearGradient colors={['#9C27B0', '#2196F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.emptyCtaInner}>
                    <Text style={styles.emptyCtaText}>{t('mobile.createAPost')}</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          )
        }
      />
      <StoryViewer
        visible={viewerOpen}
        stories={stories}
        startIndex={storyIndex}
        onClose={() => setViewerOpen(false)}
        onViewStory={handleViewStory}
      />
      <StoryViewer
        visible={spotlightOpen}
        stories={spotlightStories}
        startIndex={spotlightIndex}
        onClose={() => setSpotlightOpen(false)}
        onViewStory={handleViewStory}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chromePad: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8 },
  chrome: {
    height: 64,
    borderRadius: 28,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 12,
  },
  brand: { fontSize: 22, fontWeight: '800' },
  topCluster: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, padding: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  errorBox: { paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center' },
  errorText: { marginBottom: 8, fontWeight: '600' },
  retry: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  retryText: { color: '#fff', fontWeight: '700' },
  list: { paddingHorizontal: 12, paddingBottom: 28 },
  tabsWrap: { marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tabsWrapCompact: { flexDirection: 'column', alignItems: 'stretch' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: 4 },
  refreshText: { fontSize: 12, fontWeight: '600' },
  feedTabs: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    gap: 2,
  },
  feedTab: { borderRadius: 999, overflow: 'hidden' },
  feedTabActive: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, minHeight: 40, justifyContent: 'center' },
  feedTabActiveText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  feedTabText: { fontSize: 13, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 8 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyCta: { borderRadius: 14, overflow: 'hidden' },
  emptyCtaInner: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, minHeight: 44, justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyCtaText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  emptyLink: { fontSize: 14, fontWeight: '700' },
});
