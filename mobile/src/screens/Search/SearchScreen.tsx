import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import Avatar from '@/components/Avatar';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { useTheme } from '@/hooks/useTheme';

type SearchTab =
  | 'all'
  | 'users'
  | 'posts'
  | 'reels'
  | 'ideas'
  | 'stories'
  | 'challenges'
  | 'shop'
  | 'bottles';

type SearchResults = {
  users: Array<{ id: number; username: string; name?: string; avatar?: string | null }>;
  posts: Array<{ id: number; snippet?: string; author?: string; tags?: string[] }>;
  reels: Array<{ id: number; caption?: string; author?: string; tags?: string[] }>;
  ideas: Array<{ id: number; title?: string; description?: string; owner?: string }>;
  stories: Array<{ id: number; title?: string; description?: string; owner?: string }>;
  bottles: Array<{ id: number; message?: string; emotion_type?: string; sender?: string }>;
  shop: Array<{ id: number; name?: string; description?: string; creator?: string; price?: number }>;
  challenges: Array<{ id: number; title?: string; description?: string; type?: string }>;
};

type ResultRow = {
  key: string;
  kind: Exclude<SearchTab, 'all'>;
  title: string;
  subtitle: string;
  id: number;
  avatar?: string | null;
};

const EMPTY: SearchResults = {
  users: [],
  posts: [],
  reels: [],
  ideas: [],
  stories: [],
  bottles: [],
  shop: [],
  challenges: [],
};

const TABS: Array<{ key: SearchTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'users', label: 'Users' },
  { key: 'posts', label: 'Posts' },
  { key: 'ideas', label: 'Ideas' },
  { key: 'stories', label: 'Stories' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'reels', label: 'Signals' },
  { key: 'shop', label: 'Shop' },
  { key: 'bottles', label: 'Bottles' },
];

const PAGINATED: Array<Exclude<SearchTab, 'all'>> = [
  'users',
  'posts',
  'reels',
  'ideas',
  'stories',
  'bottles',
  'shop',
  'challenges',
];

function flatten(results: SearchResults, tab: SearchTab): ResultRow[] {
  const rows: ResultRow[] = [];
  const pushUsers = () => {
    results.users.forEach((u) =>
      rows.push({
        key: `user-${u.id}`,
        kind: 'users',
        id: u.id,
        title: u.name || u.username,
        subtitle: `@${u.username}`,
        avatar: u.avatar,
      }),
    );
  };
  const pushPosts = () => {
    results.posts.forEach((p) =>
      rows.push({
        key: `post-${p.id}`,
        kind: 'posts',
        id: p.id,
        title: p.snippet || 'Post',
        subtitle: p.author ? `@${p.author}` : 'Post',
      }),
    );
  };
  const pushReels = () => {
    results.reels.forEach((r) =>
      rows.push({
        key: `reel-${r.id}`,
        kind: 'reels',
        id: r.id,
        title: r.caption || 'Signal',
        subtitle: r.author ? `@${r.author}` : 'Reel',
      }),
    );
  };
  const pushIdeas = () => {
    results.ideas.forEach((i) =>
      rows.push({
        key: `idea-${i.id}`,
        kind: 'ideas',
        id: i.id,
        title: i.title || 'Idea',
        subtitle: i.owner ? `@${i.owner}` : i.description || 'Idea',
      }),
    );
  };
  const pushStories = () => {
    results.stories.forEach((s) =>
      rows.push({
        key: `story-${s.id}`,
        kind: 'stories',
        id: s.id,
        title: s.title || 'Story',
        subtitle: s.owner ? `@${s.owner}` : s.description || 'Story',
      }),
    );
  };
  const pushChallenges = () => {
    results.challenges.forEach((c) =>
      rows.push({
        key: `challenge-${c.id}`,
        kind: 'challenges',
        id: c.id,
        title: c.title || 'Challenge',
        subtitle: c.type || c.description || 'Challenge',
      }),
    );
  };
  const pushShop = () => {
    results.shop.forEach((s) =>
      rows.push({
        key: `shop-${s.id}`,
        kind: 'shop',
        id: s.id,
        title: s.name || 'Item',
        subtitle: s.creator
          ? `@${s.creator}${s.price != null ? ` · $${s.price}` : ''}`
          : s.description || 'Shop',
      }),
    );
  };
  const pushBottles = () => {
    results.bottles.forEach((b) =>
      rows.push({
        key: `bottle-${b.id}`,
        kind: 'bottles',
        id: b.id,
        title: b.message || 'Bottle',
        subtitle: b.sender ? `@${b.sender}` : b.emotion_type || 'Bottle',
      }),
    );
  };

  if (tab === 'all' || tab === 'users') pushUsers();
  if (tab === 'all' || tab === 'posts') pushPosts();
  if (tab === 'all' || tab === 'reels') pushReels();
  if (tab === 'all' || tab === 'ideas') pushIdeas();
  if (tab === 'all' || tab === 'stories') pushStories();
  if (tab === 'all' || tab === 'challenges') pushChallenges();
  if (tab === 'all' || tab === 'shop') pushShop();
  if (tab === 'all' || tab === 'bottles') pushBottles();
  return rows;
}

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('all');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    setQuery(trimmed);
    if (!trimmed) {
      setResults(EMPTY);
      setHasMore(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.search(trimmed);
      setResults({
        users: data.users || [],
        posts: data.posts || [],
        reels: data.reels || [],
        ideas: data.ideas || [],
        stories: data.stories || [],
        bottles: data.bottles || [],
        shop: data.shop || [],
        challenges: data.challenges || [],
      });
      setHasMore(false);
    } catch {
      setResults(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query) return;
    if (tab === 'all') return;
    const list = results[tab as keyof SearchResults];
    setHasMore(Array.isArray(list) && list.length >= 5);
  }, [tab, query, results]);

  const rows = useMemo(() => flatten(results, tab), [results, tab]);

  const total = useMemo(
    () =>
      results.users.length +
      results.posts.length +
      results.reels.length +
      results.ideas.length +
      results.stories.length +
      results.bottles.length +
      results.shop.length +
      results.challenges.length,
    [results],
  );

  const openRow = (row: ResultRow) => {
    switch (row.kind) {
      case 'users':
        navigation.navigate('Profile', { username: row.subtitle.replace(/^@/, '') });
        break;
      case 'posts':
        navigation.navigate('PostDetail', { postId: row.id });
        break;
      case 'reels':
        navigation.navigate('Reels');
        break;
      case 'ideas':
        navigation.navigate('BazaarDetail', { ideaId: row.id });
        break;
      case 'stories':
        navigation.navigate('ForgeDetail', { storyId: row.id });
        break;
      case 'challenges':
        navigation.navigate('Lab');
        break;
      case 'shop':
        navigation.navigate('Shop');
        break;
      case 'bottles':
        navigation.navigate('Bottles');
        break;
      default:
        break;
    }
  };

  const loadMore = async () => {
    if (tab === 'all' || !query || !PAGINATED.includes(tab) || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = (results[tab as keyof SearchResults] as unknown[]).length;
      const page = await api.search(query, { category: tab, offset, limit: 20 });
      const next = Array.isArray(page.results) ? page.results : [];
      setResults((prev) => ({
        ...prev,
        [tab]: [...(prev[tab as keyof SearchResults] as unknown[]), ...next],
      }));
      setHasMore(Boolean(page.has_more));
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Search"
          subtitle={query ? `${total} results` : 'Ideas, creators, signals'}
          onBack={() => navigation.goBack()}
        />

        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Search Cosonova…"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => void runSearch(draft)}
            accessibilityLabel="Search query"
          />
          {draft ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={10}
              onPress={() => {
                setDraft('');
                setQuery('');
                setResults(EMPTY);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>×</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Run search"
            hitSlop={10}
            onPress={() => void runSearch(draft)}
            style={({ pressed }) => [styles.goBtn, { opacity: pressed ? 0.75 : 1 }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Go</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((item) => {
            const selected = tab === item.key;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={`Search category ${item.label}`}
                accessibilityState={{ selected }}
                hitSlop={8}
                onPress={() => setTab(item.key)}
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
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#818CF8" />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                  {query ? 'No results for this query.' : 'Search for inspiration across Cosonova.'}
                </Text>
              </View>
            }
            ListFooterComponent={
              tab !== 'all' && hasMore && query ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Load more results"
                  hitSlop={10}
                  onPress={() => void loadMore()}
                  style={({ pressed }) => [styles.moreBtn, { opacity: pressed || loadingMore ? 0.7 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </Text>
                </Pressable>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.kind} result ${item.title}`}
                hitSlop={6}
                onPress={() => openRow(item)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                {item.kind === 'users' ? (
                  <Avatar uri={mediaUrl(item.avatar) || undefined} name={item.title} size="md" />
                ) : (
                  <View style={[styles.kindChip, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                    <Text style={{ color: '#818CF8', fontWeight: '800', fontSize: 10 }}>
                      {item.kind.slice(0, 4).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 4,
  },
  goBtn: {
    marginLeft: 8,
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabs: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  kindChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  moreBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#6366F1',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
});
