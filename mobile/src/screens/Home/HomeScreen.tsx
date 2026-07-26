import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePosts } from '../../hooks/usePosts';
import { useStories } from '../../hooks/useStories';
import { useAds } from '../../hooks/useAds';
import { api } from '../../api/client';
import { mediaUrl } from '../../api/config';
import PostCard from '../../components/PostCard';
import FeedSkeleton from '../../components/FeedSkeleton';
import EmptyState from '../../components/EmptyState';
import StoriesBar from '../../components/StoriesBar';
import StoryViewer from '../../components/StoryViewer';
import AdCard from '../../components/ads/AdCard';
import type { Post, Story } from '../../types';

const AD_FREQUENCY = 5;

type HomeFeed = 'for_you' | 'following' | 'joined' | 'discover';

const FEED_TABS: { key: HomeFeed; label: string }[] = [
  { key: 'for_you', label: 'For You' },
  { key: 'following', label: 'Following' },
  { key: 'joined', label: 'Resonance' },
  { key: 'discover', label: 'Discover' },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const [feed, setFeed] = useState<HomeFeed>('for_you');
  const { posts, setPosts, loading, error, refreshing, loadMore, refresh, react } = usePosts({
    limit: 10,
    feed,
  });
  const { stories, viewStory, load: reloadStories } = useStories();
  const { currentAd, fetchAd, logImpression, logClick } = useAds();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [spotlightStories, setSpotlightStories] = useState<Story[]>([]);
  const [trends, setTrends] = useState<string[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<Array<{ id: number | string; slug: string; name: string }>>([]);
  const adFetchedRef = useRef(false);

  useEffect(() => {
    if (!adFetchedRef.current) {
      adFetchedRef.current = true;
      fetchAd('feed');
    }
  }, [fetchAd]);

  useEffect(() => {
    void (async () => {
      try {
        const [rows, spotlightRows] = await Promise.all([
          api.getTrendingTags(),
          api.getSpotlightStories().catch(() => []),
        ]);
        setTrends(rows.map((r) => r.tag).filter((t): t is string => !!t).slice(0, 8));
        setSpotlightStories(Array.isArray(spotlightRows) ? (spotlightRows as Story[]) : []);
      } catch {
        setTrends([]);
        setSpotlightStories([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const page = await api.getCommunities({ mine: true, limit: 30 });
        setJoinedCommunities(
          (page.results || []).map((c: any) => ({
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

  const goToPost = useCallback(
    (postId: string | number) => (navigation as any).navigate('PostDetail', { postId }),
    [navigation]
  );

  const sharePostToStory = useCallback(async (post: Post) => {
    const m = post.media?.[0];
    const uri = mediaUrl(m?.media_file || m?.url || m?.file || m?.thumbnail_url || '') || '';
    if (!uri) {
      Alert.alert('No media', 'This post has no image to broadcast to your story.');
      return;
    }
    try {
      await api.sharePostToStory(post.id, uri);
      Alert.alert('On your story', 'Signal broadcast to your 24h orbit.');
      void reloadStories();
    } catch {
      Alert.alert('Error', 'Could not share to story.');
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
      Alert.alert('Error', 'Could not Echo this signal.');
    }
  }, [patchPost]);

  const handleQuote = useCallback(async (post: Post, text: string) => {
    try {
      await api.repostPost(post.id, text);
      patchPost(post.id, { reposts_count: (post.reposts_count || 0) + 1 });
      Alert.alert('Quoted', 'Your Quote Signal is live.');
      void refresh();
    } catch {
      Alert.alert('Error', 'Could not post Quote Signal.');
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
        'Save to Vault',
        'Pick a folder',
        [
          {
            text: 'Default',
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
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
    } catch {
      Alert.alert('Error', 'Could not save to Vault.');
    }
  }, [patchPost]);

  const handleCrossEcho = useCallback(async (post: Post) => {
    if (!joinedCommunities.length) {
      Alert.alert('Join a community', 'Cross-Echo needs a community you belong to.');
      return;
    }
    Alert.alert(
      'Cross-Echo',
      'Share this signal into another community',
      [
        ...joinedCommunities.slice(0, 6).map((c) => ({
          text: c.name,
          onPress: () => {
            void (async () => {
              try {
                await api.crossEchoPost(post.id, { community_id: c.id });
                Alert.alert('Cross-Echoed', `Shared into ${c.name}.`);
              } catch {
                Alert.alert('Error', 'Could not Cross-Echo.');
              }
            })();
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
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
            onComment={() => goToPost(item.id)}
            onPress={() => goToPost(item.id)}
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
                  Alert.alert('Error', 'Could not Amplify/Fade.');
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
    [react, goToPost, currentAd, logImpression, logClick, sharePostToStory, handleEcho, handleQuote, handleSave, handleCrossEcho, patchPost]
  );

  const handleStoryPress = (_story: Story, index: number) => {
    setStoryIndex(index);
    setViewerOpen(true);
  };

  const handleAddStory = useCallback(() => {
    navigation.navigate('StoryStudio' as never);
  }, [navigation]);

  const handleViewStory = useCallback(
    (storyId: string | number) => {
      viewStory(storyId);
    },
    [viewStory]
  );

  if (loading && posts.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <FeedSkeleton count={3} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image source={require('../../../assets/icon.png')} style={styles.brandLogo} />
          <Text style={styles.brand}>Cosmory</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={() => (navigation as any).navigate('StoryMap')} style={styles.mapBtn}>
            <Text style={styles.mapBtnText}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Chat')} hitSlop={12}>
            <Text style={styles.chatBtn}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.feedTabs}
        style={styles.feedTabsScroll}
      >
        {FEED_TABS.map((tab) => {
          const active = feed === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setFeed(tab.key)}
              style={[styles.feedTab, active && styles.feedTabActive]}
            >
              <Text style={[styles.feedTabText, active && styles.feedTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <StoriesBar
              stories={stories}
              onStoryPress={handleStoryPress}
              onAddStory={handleAddStory}
            />
            {spotlightStories.length > 0 ? (
              <View style={styles.spotlightWrap}>
                <View style={styles.spotlightHeader}>
                  <Text style={styles.spotlightLabel}>Spotlight</Text>
                  <TouchableOpacity onPress={() => (navigation as any).navigate('StoryMap')}>
                    <Text style={styles.spotlightMapLink}>Map</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spotlightRow}>
                  {spotlightStories.map((story, index) => {
                    const uri = mediaUrl(story.image || story.media || story.video || '');
                    return (
                      <TouchableOpacity
                        key={String(story.id)}
                        style={styles.spotlightCard}
                        onPress={() => {
                          setSpotlightIndex(index);
                          setSpotlightOpen(true);
                        }}
                      >
                        {uri ? (
                          <Image source={{ uri }} style={styles.spotlightImage} />
                        ) : (
                          <View style={styles.spotlightFallback}>
                            <Text style={styles.spotlightFallbackText}>★</Text>
                          </View>
                        )}
                        <Text style={styles.spotlightUser} numberOfLines={1}>
                          @{story.user?.username || story.author?.username || 'story'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
            {trends.length > 0 ? (
              <View style={styles.trendsWrap}>
                <Text style={styles.trendsLabel}>Signal Trends</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendsRow}>
                  {trends.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.trendChip}
                      onPress={() => (navigation as any).navigate('TagFeed', { tag })}
                    >
                      <Text style={styles.trendChipText}>#{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
              reloadStories();
              fetchAd('feed');
            }}
            tintColor="#6366f1"
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="لا توجد منشورات"
            subtitle="اتبع المزيد من المستخدمين لرؤية منشوراتهم هنا"
            emoji="📭"
          />
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
  safe: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: '#4f46e5',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mapBtn: {
    borderRadius: 999,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mapBtnText: {
    color: '#5b21b6',
    fontWeight: '800',
    fontSize: 12,
  },
  chatBtn: {
    fontSize: 22,
  },
  feedTabsScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  feedTabs: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  feedTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
  },
  feedTabActive: {
    backgroundColor: '#4f46e5',
  },
  feedTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4b5563',
  },
  feedTabTextActive: {
    color: '#fff',
  },
  errorText: {
    color: '#ef4444',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  spotlightWrap: {
    marginBottom: 10,
  },
  spotlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  spotlightLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  spotlightMapLink: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '800',
  },
  spotlightRow: {
    gap: 10,
    paddingHorizontal: 2,
  },
  spotlightCard: {
    width: 92,
  },
  spotlightImage: {
    width: 92,
    height: 128,
    borderRadius: 16,
    backgroundColor: '#111827',
  },
  spotlightFallback: {
    width: 92,
    height: 128,
    borderRadius: 16,
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightFallbackText: {
    color: '#fff',
    fontSize: 24,
  },
  spotlightUser: {
    marginTop: 5,
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '700',
  },
  trendsWrap: {
    marginBottom: 10,
    paddingTop: 4,
  },
  trendsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  trendsRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  trendChip: {
    backgroundColor: '#ede9fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  trendChipText: {
    color: '#5b21b6',
    fontWeight: '700',
    fontSize: 13,
  },
});
