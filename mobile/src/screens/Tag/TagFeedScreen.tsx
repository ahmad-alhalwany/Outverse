import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import PostCard from '@/components/PostCard';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { usePosts } from '@/hooks/usePosts';
import { useTheme } from '@/hooks/useTheme';
import type { Reel } from '@/types';
import { openProfile } from '@/lib/nav';

type Tab = 'posts' | 'reels';

export default function TagFeedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { colors } = useTheme();
  const raw = (route.params as { tag?: string } | undefined)?.tag || '';
  const tag = decodeURIComponent(String(raw)).replace(/^#/, '').trim();

  const { posts, loading, error, refreshing, hasMore, loadMore, refresh, react } = usePosts({
    tag: tag || undefined,
    limit: 12,
  });

  const [tab, setTab] = useState<Tab>('posts');
  const [reels, setReels] = useState<Reel[]>([]);
  const [reelsLoading, setReelsLoading] = useState(false);
  const [reelsError, setReelsError] = useState(false);

  const loadReels = useCallback(async () => {
    if (!tag) return;
    setReelsLoading(true);
    setReelsError(false);
    try {
      const page = await api.getReels({ tag, limit: 40, offset: 0 });
      setReels(page.results || []);
    } catch {
      setReels([]);
      setReelsError(true);
    } finally {
      setReelsLoading(false);
    }
  }, [tag]);

  useEffect(() => {
    void loadReels();
  }, [loadReels]);

  if (!tag) {
    return (
      <WorldBackdrop>
        <SafeAreaView style={{ flex: 1 }}>
          <WorldHeader title="Tag" subtitle="Missing" onBack={() => navigation.goBack()} />
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary }}>Missing tag.</Text>
          </View>
        </SafeAreaView>
      </WorldBackdrop>
    );
  }

  return (
    <WorldBackdrop tone="lab">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={`#${tag}`}
          subtitle={
            loading || reelsLoading
              ? 'Loading…'
              : `${posts.length} posts · ${reels.length} reels`
          }
          tone="lab"
          onBack={() => navigation.goBack()}
        />

        <View style={styles.tabs}>
          {(['posts', 'reels'] as Tab[]).map((key) => {
            const selected = tab === key;
            const count = key === 'posts' ? posts.length : reels.length;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${key} tab`}
                accessibilityState={{ selected }}
                hitSlop={8}
                onPress={() => setTab(key)}
                style={({ pressed }) => [
                  styles.tab,
                  {
                    backgroundColor: selected ? '#6366F1' : colors.surface,
                    borderColor: selected ? '#6366F1' : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
                  {key === 'posts' ? `Posts (${count})` : `Reels (${count})`}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'posts' ? (
          loading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator color="#818CF8" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>Could not load posts.</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading tag posts"
                hitSlop={10}
                onPress={() => void refresh()}
                style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={posts}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.list}
              onEndReached={() => {
                if (hasMore) void loadMore();
              }}
              onEndReachedThreshold={0.4}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#818CF8" />
              }
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={{ color: colors.textSecondary }}>No posts with this tag yet.</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={{ marginBottom: 12 }}>
                  <PostCard
                    post={item}
                    onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                    onComment={() => navigation.navigate('PostDetail', { postId: item.id })}
                    onUserPress={() => openProfile(navigation, item.user?.username)}
                    onReact={(type) => react(item.id, type)}
                  />
                </View>
              )}
            />
          )
        ) : reelsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#818CF8" />
          </View>
        ) : reelsError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>Could not load reels.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading tag reels"
              hitSlop={10}
              onPress={() => void loadReels()}
              style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={reels}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            columnWrapperStyle={{ gap: 10 }}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={() => void loadReels()}
                tintColor="#818CF8"
              />
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: colors.textSecondary }}>No reels with this tag yet.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const uri = mediaUrl(item.video_url || item.video) || item.video_url || item.video;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open reel ${item.caption || item.id}`}
                  hitSlop={6}
                  onPress={() => navigation.navigate('Reels')}
                  style={({ pressed }) => [
                    styles.reelCard,
                    { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <View style={[styles.reelThumb, { backgroundColor: '#16102c' }]}>
                    {uri ? (
                      <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                    ) : null}
                    <Text style={styles.play}>▶</Text>
                  </View>
                  <Text style={[styles.reelCaption, { color: colors.text }]} numberOfLines={2}>
                    {item.caption || 'Signal'}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  retry: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reelCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  reelThumb: {
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  play: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  reelCaption: {
    padding: 10,
    fontSize: 12,
    fontWeight: '600',
  },
});
