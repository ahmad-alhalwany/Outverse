import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import PostCard from '@/components/PostCard';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { useTheme } from '@/hooks/useTheme';
import type { ReactionType } from '@/lib/reactions';
import type { Post } from '@/types';

type SavedCollection = 'all' | 'post' | 'reel' | 'idea' | 'story';

type SavedItem = Record<string, unknown> & {
  saved_id: string;
  saved_type: 'post' | 'reel' | 'idea' | 'story';
};

const TABS: Array<{ key: SavedCollection; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'post', label: 'Posts' },
  { key: 'reel', label: 'Reels' },
  { key: 'idea', label: 'Ideas' },
  { key: 'story', label: 'Stories' },
];

function asPost(item: SavedItem): Post | null {
  if (item.saved_type !== 'post') return null;
  const user = (item.user as Post['user']) || {
    id: 0,
    username: 'user',
    email: '',
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
  };
  return {
    ...(item as unknown as Post),
    id: (item.id as string | number) ?? item.saved_id,
    user,
    text: String(item.text ?? ''),
    media: Array.isArray(item.media) ? (item.media as Post['media']) : [],
    likes_count: Number(item.likes_count ?? 0),
    comments_count: Number(item.comments_count ?? 0),
    reposts_count: Number(item.reposts_count ?? 0),
    shares_count: Number(item.shares_count ?? 0),
    reaction_counts: (item.reaction_counts as Record<string, number>) || {},
    my_reaction: (item.my_reaction as string | null) ?? null,
    is_saved: true,
    created_at: String(item.created_at ?? ''),
  };
}

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [active, setActive] = useState<SavedCollection>('all');
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const rows = await api.getSavedItems(active);
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [active]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnsave = async (savedId: string) => {
    setItems((prev) => prev.filter((item) => item.saved_id !== savedId));
    try {
      await api.unsaveItem(savedId);
    } catch {
      void load();
    }
  };

  const handleReact = (item: SavedItem, type: ReactionType) => {
    const post = asPost(item);
    if (!post) return;
    const wasSame = post.my_reaction === type;
    setItems((prev) =>
      prev.map((row) =>
        row.saved_id === item.saved_id
          ? {
              ...row,
              my_reaction: wasSame ? null : type,
              likes_count: wasSame
                ? Math.max(0, Number(row.likes_count ?? 0) - 1)
                : Number(row.likes_count ?? 0) + (row.my_reaction ? 0 : 1),
            }
          : row,
      ),
    );
    api
      .reactToPost(post.id, wasSame ? null : type)
      .then((data) => {
        setItems((prev) =>
          prev.map((row) =>
            row.saved_id === item.saved_id
              ? {
                  ...row,
                  my_reaction: data.my_reaction,
                  likes_count: data.total,
                  reaction_counts: data.reaction_counts,
                }
              : row,
          ),
        );
      })
      .catch(() => void load());
  };

  const visible = useMemo(() => {
    if (active === 'all') return items;
    return items.filter((item) => item.saved_type === active);
  }, [active, items]);

  const renderItem = ({ item }: { item: SavedItem }) => {
    if (item.saved_type === 'post') {
      const post = asPost(item);
      if (!post) return null;
      return (
        <View style={styles.cardWrap}>
          <PostCard
            post={post}
            onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            onComment={() => navigation.navigate('PostDetail', { postId: post.id })}
            onReact={(type) => handleReact(item, type)}
            onSave={() => void handleUnsave(item.saved_id)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove from saved"
            hitSlop={10}
            onPress={() => void handleUnsave(item.saved_id)}
            style={({ pressed }) => [
              styles.unsaveBtn,
              { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 13 }}>Unsave</Text>
          </Pressable>
        </View>
      );
    }

    const title =
      item.saved_type === 'reel'
        ? String(item.caption || 'Reel')
        : item.saved_type === 'idea'
          ? String(item.title || 'Idea')
          : String(item.title || 'Story');
    const subtitle =
      item.saved_type === 'reel'
        ? `@${(item.user as { username?: string } | undefined)?.username || 'creator'}`
        : item.saved_type === 'idea'
          ? String((item.owner as { username?: string } | string | undefined) && typeof item.owner === 'object'
              ? (item.owner as { username?: string }).username || 'owner'
              : item.owner || 'owner')
          : String((item.owner as { username?: string } | string | undefined) && typeof item.owner === 'object'
              ? (item.owner as { username?: string }).username || 'owner'
              : item.owner || 'owner');

    const onOpen = () => {
      if (item.saved_type === 'reel') navigation.navigate('Reels');
      else if (item.saved_type === 'idea') navigation.navigate('BazaarDetail', { ideaId: item.id });
      else navigation.navigate('StoryMap', { storyId: item.id });
    };

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open saved ${item.saved_type}`}
        hitSlop={6}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.simpleCard,
          { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.typeBadge, { color: '#818CF8' }]}>{item.saved_type.toUpperCase()}</Text>
          <Text style={[styles.simpleTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove from saved"
          hitSlop={10}
          onPress={() => void handleUnsave(item.saved_id)}
          style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>×</Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Saved"
          subtitle="Bookmarks across Cosonova"
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((tab) => {
            const selected = active === tab.key;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={`Filter ${tab.label}`}
                accessibilityState={{ selected }}
                hitSlop={8}
                onPress={() => setActive(tab.key)}
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
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#818CF8" />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>Could not load saved items.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading saved items"
              hitSlop={10}
              onPress={() => void load()}
              style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.saved_id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#818CF8" />
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: colors.textSecondary }}>No saved items yet.</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  tabs: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  cardWrap: {
    marginBottom: 14,
  },
  unsaveBtn: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  simpleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  typeBadge: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  simpleTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
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
});
