import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { User, Post, Reel } from '@/types';
import {
  WorldBackdrop,
  WorldCard,
  WorldPill,
} from '@/components/world/WorldChrome';

type ExploreTab = 'posts' | 'users' | 'reels' | 'tags';

type TagRow = {
  tag?: string;
  name?: string;
  count?: number;
  posts?: number;
  score?: number;
};

const TABS: Array<{ key: ExploreTab; label: string }> = [
  { key: 'users', label: 'Users' },
  { key: 'posts', label: 'Posts' },
  { key: 'reels', label: 'Reels' },
  { key: 'tags', label: 'Tags' },
];

function normalizeUsers(rows: unknown): User[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((u: any) => ({
    ...u,
    id: u.id ?? u.username,
    display_name: u.display_name || u.name || u.username,
    followers_count: u.followers_count ?? u.followers ?? 0,
    following_count: u.following_count ?? 0,
    posts_count: u.posts_count ?? 0,
    email: u.email || '',
  }));
}

function normalizeTags(rows: unknown): TagRow[] {
  const list = Array.isArray(rows)
    ? rows
    : rows && typeof rows === 'object' && Array.isArray((rows as any).results)
      ? (rows as any).results
      : [];
  return list.map((t: any) => (typeof t === 'string' ? { tag: t } : t));
}

export default function ExploreScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ExploreTab>('users');
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDiscovery = useCallback(async () => {
    setLoading(true);
    try {
      const [postsPage, suggestions, reelsPage, tagRows] = await Promise.all([
        api.getPosts({ limit: 20, offset: 0 }),
        api.getSuggestions(user?.id).catch(() => []),
        api.getReels({ limit: 20, offset: 0 }).catch(() => ({ results: [] })),
        api.getTrendingTags().catch(() => []),
      ]);
      setPosts((postsPage.results || []) as Post[]);
      setSuggestedUsers(normalizeUsers(suggestions).slice(0, 12));
      setUsers(normalizeUsers(suggestions).slice(0, 12));
      setReels((reelsPage.results || []) as Reel[]);
      setTags(normalizeTags(tagRows).slice(0, 24));
    } catch (error) {
      console.error('Explore discovery failed:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) {
      setUsers(suggestedUsers);
      await loadDiscovery();
      return;
    }
    setLoading(true);
    try {
      const [postsRes, usersRes, reelsPage] = await Promise.all([
        api.searchPosts(q).catch(() => []),
        api.searchUsers(q).catch(() => []),
        api.getReels({ limit: 60, offset: 0 }).catch(() => ({ results: [] })),
      ]);
      const qLower = q.toLowerCase();
      setPosts(Array.isArray(postsRes) ? postsRes : []);
      setUsers(normalizeUsers(usersRes));
      setReels(
        ((reelsPage.results || []) as Reel[]).filter((reel) => {
          const haystack = `${reel.caption || ''} ${reel.user?.username || ''} ${(reel.tags || []).join(' ')}`.toLowerCase();
          return haystack.includes(qLower);
        }),
      );
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [loadDiscovery, query, suggestedUsers]);

  useEffect(() => {
    void loadDiscovery();
  }, [loadDiscovery]);

  const handleRefresh = () => {
    setRefreshing(true);
    const task = query.trim() ? runSearch() : loadDiscovery();
    task.finally(() => setRefreshing(false));
  };

  const clearQuery = () => {
    setQuery('');
    setUsers(suggestedUsers);
    void loadDiscovery();
  };

  const openTag = (tag: string) => {
    setActiveTab('posts');
    setQuery(tag);
    setLoading(true);
    api.searchPosts(tag)
      .then((rows) => setPosts(Array.isArray(rows) ? rows : []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };

  const EmptyComponent = ({ label }: { label: string }) => (
    <View style={styles.emptyState}>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={[styles.postItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      activeOpacity={0.95}
    >
      <View style={styles.postItemHeader}>
        {item.user.avatar ? (
          <Image source={{ uri: mediaUrl(item.user.avatar) || item.user.avatar }} style={styles.postItemAvatar} />
        ) : (
          <View style={[styles.postItemAvatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{item.user.username?.[0]?.toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.postItemAuthor, { color: colors.text }]} numberOfLines={1}>
            {item.user.display_name || item.user.username}
          </Text>
          <Text style={[styles.postItemMeta, { color: colors.textSecondary }]}>
            @{item.user.username} · {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
      <Text style={[styles.postItemContent, { color: colors.text }]} numberOfLines={3}>
        {item.text}
      </Text>
      <View style={[styles.postItemStats, { borderTopColor: colors.border }]}>
        <Text style={[styles.postItemStat, { color: colors.textSecondary }]}>Comments {item.comments_count}</Text>
        <Text style={[styles.postItemStat, { color: colors.textSecondary }]}>Reposts {item.reposts_count}</Text>
        <Text style={[styles.postItemStat, { color: colors.textSecondary }]}>Likes {item.likes_count}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigation.navigate('Profile', { username: item.username })}
      activeOpacity={0.95}
    >
      {item.avatar ? (
        <Image source={{ uri: mediaUrl(item.avatar) || item.avatar }} style={styles.userAvatar} />
      ) : (
        <View style={[styles.userAvatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={[styles.userDisplayName, { color: colors.text }]} numberOfLines={1}>
            {item.display_name || item.username}
          </Text>
          {item.is_verified ? <Text style={styles.verifiedBadge}>✓</Text> : null}
        </View>
        <Text style={[styles.userUsername, { color: colors.textSecondary }]}>@{item.username}</Text>
        {item.bio ? <Text style={[styles.userBio, { color: colors.text }]} numberOfLines={2}>{item.bio}</Text> : null}
      </View>
      <Text style={[styles.userStat, { color: colors.textSecondary }]}>
        {formatNumber(item.followers_count)} followers
      </Text>
    </TouchableOpacity>
  );

  const renderReel = ({ item }: { item: Reel }) => {
    const uri = mediaUrl(item.video_url || item.video) || item.video_url || item.video;
    return (
      <TouchableOpacity
        style={[styles.reelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Reels')}
        activeOpacity={0.95}
      >
        <View style={[styles.reelThumb, { backgroundColor: isDark ? '#16102c' : '#EDE4FB' }]}>
          {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
          <View style={styles.reelVeil}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
        <View style={styles.reelInfo}>
          <Text style={[styles.reelCaption, { color: colors.text }]} numberOfLines={2}>
            {item.caption || 'Reel'}
          </Text>
          <Text style={[styles.postItemMeta, { color: colors.textSecondary }]}>
            {item.user?.username ? `@${item.user.username}` : 'Signal'} · {formatNumber(item.views || 0)} views
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTag = ({ item }: { item: TagRow }) => {
    const label = `#${String(item.tag || item.name || '').replace(/^#/, '')}`;
    const count = item.count ?? item.posts ?? item.score;
    return (
      <WorldCard onPress={() => openTag(label)} style={styles.tagCard}>
        <Text style={[styles.tagName, { color: colors.text }]}>{label}</Text>
        {count != null ? (
          <Text style={[styles.tagMeta, { color: colors.textSecondary }]}>
            {formatNumber(Number(count))} signals
          </Text>
        ) : (
          <Text style={[styles.tagMeta, { color: colors.textSecondary }]}>Trending now</Text>
        )}
      </WorldCard>
    );
  };

  const data = activeTab === 'posts' ? posts : activeTab === 'users' ? users : activeTab === 'reels' ? reels : tags;

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.searchContainer, { borderBottomColor: colors.border }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: isDark ? 'rgba(167,139,250,0.22)' : 'rgba(124,58,237,0.14)' }]}>
            <Text style={{ fontSize: 18, marginRight: 8 }}>Search</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search posts, users, tags..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={runSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity onPress={clearQuery} style={{ padding: 4 }}>
                <Text style={{ fontSize: 18, color: colors.textSecondary }}>x</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.tabs}>
            {TABS.map((tab) => (
              <WorldPill
                key={tab.key}
                label={tab.label}
                active={activeTab === tab.key}
                onPress={() => setActiveTab(tab.key)}
              />
            ))}
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={data as any[]}
            key={activeTab}
            keyExtractor={(item, index) => String(item.id || item.tag || item.name || index)}
            renderItem={
              activeTab === 'posts'
                ? renderPost as any
                : activeTab === 'users'
                  ? renderUser as any
                  : activeTab === 'reels'
                    ? renderReel as any
                    : renderTag as any
            }
            numColumns={activeTab === 'tags' ? 2 : 1}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <>
                <WorldCard onPress={() => navigation.navigate('WorldsHub')} style={styles.worldsCard}>
                  <Text style={[styles.worldsTitle, { color: colors.text }]}>Explore More Worlds</Text>
                  <Text style={[styles.worldsBody, { color: colors.textSecondary }]}>
                    Open the full Cosmory world map.
                  </Text>
                </WorldCard>
                {activeTab === 'users' && !query.trim() && suggestedUsers.length ? (
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Suggested users</Text>
                ) : null}
              </>
            }
            ListEmptyComponent={
              <EmptyComponent
                label={
                  activeTab === 'posts'
                    ? 'No posts found'
                    : activeTab === 'users'
                      ? 'No users found'
                      : activeTab === 'reels'
                        ? 'No reels found'
                        : 'No trending tags found'
                }
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                progressBackgroundColor={colors.surface}
              />
            }
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function formatTime(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

const styles = StyleSheet.create({
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 16 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  loadingContainer: { padding: 40, alignItems: 'center' },
  listContent: { padding: 12, paddingBottom: 96 },
  worldsCard: { marginHorizontal: 4 },
  worldsTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  worldsBody: { fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, paddingHorizontal: 4 },
  emptyState: { minHeight: 180, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  postItem: { marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  postItemHeader: { flexDirection: 'row', marginBottom: 10 },
  postItemAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  postItemAuthor: { fontSize: 15, fontWeight: '700' },
  postItemMeta: { fontSize: 13, marginTop: 2 },
  postItemContent: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  postItemStats: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  postItemStat: { fontSize: 12, fontWeight: '600' },
  userItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  userAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  userDisplayName: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  verifiedBadge: { color: '#6366F1', marginLeft: 4, fontWeight: 'bold', fontSize: 14 },
  userUsername: { fontSize: 13, fontWeight: '500' },
  userBio: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  userStat: { fontSize: 12, fontWeight: '700', marginLeft: 8, maxWidth: 84, textAlign: 'right' },
  reelCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 10 },
  reelThumb: { width: 76, height: 112, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  reelVeil: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,16,31,0.20)' },
  playIcon: { color: '#fff', fontSize: 22, fontWeight: '800' },
  reelInfo: { flex: 1, paddingLeft: 12, justifyContent: 'center' },
  reelCaption: { fontSize: 15, lineHeight: 21, fontWeight: '700', marginBottom: 6 },
  tagCard: { flex: 1, minHeight: 94, marginHorizontal: 4 },
  tagName: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  tagMeta: { fontSize: 12, fontWeight: '700' },
});
