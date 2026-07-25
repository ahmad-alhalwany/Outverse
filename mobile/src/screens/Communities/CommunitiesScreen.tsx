import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
} from '@/components/world/WorldChrome';

type CommunityRow = {
  id: number | string;
  slug: string;
  name: string;
  description?: string;
  rules?: string[];
  members_count?: number;
  posts_count?: number;
  privacy?: string;
  is_member?: boolean;
  is_pending?: boolean;
  is_banned?: boolean;
  creator_username?: string;
};

export default function CommunitiesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joinBusy, setJoinBusy] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const page = await api.getCommunities({ ordering: 'trending' });
      setCommunities(page.results as CommunityRow[]);
    } catch (error) {
      console.error('Failed to load communities:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (slug: string) => {
    if (joinBusy) return;
    setJoinBusy(slug);
    try {
      const updated = await api.joinCommunity(slug);
      setCommunities((prev) =>
        prev.map((c) => (c.slug === slug ? { ...c, ...updated, is_member: updated.is_member } : c)),
      );
    } catch (error) {
      console.error('Failed to join community:', error);
    } finally {
      setJoinBusy(null);
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Communities"
          subtitle="Shared spaces"
          tone="default"
          onBack={() => navigation.goBack()}
        />

        {loading && communities.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={communities}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load(true);
                }}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              communities.length > 0 ? (
                <WorldHero
                  tone="default"
                  eyebrow="Find your people"
                  title="Trending communities"
                  body="Join spaces built around shared interests and ideas."
                />
              ) : null
            }
            ListEmptyComponent={
              <WorldHero
                tone="default"
                eyebrow="No spaces yet"
                title="Communities are forming"
                body="Check back soon or create one on the web."
              />
            }
            renderItem={({ item }) => (
              <WorldCard onPress={() => navigation.navigate('CommunityDetail', { slug: item.slug })}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.name}</Text>
                  {item.is_banned ? (
                    <Text style={[styles.badge, { color: '#dc2626' }]}>Banned</Text>
                  ) : item.is_member ? (
                    <Text style={[styles.badge, { color: colors.primary }]}>Member</Text>
                  ) : item.is_pending ? (
                    <Text style={[styles.badge, { color: colors.textSecondary }]}>Pending</Text>
                  ) : (
                    <TouchableOpacity
                      onPress={() => void handleJoin(item.slug)}
                      disabled={joinBusy === item.slug}
                      style={[styles.joinBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.joinBtnText}>
                        {joinBusy === item.slug ? '…' : item.privacy === 'private' ? 'Request' : 'Join'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                {item.description ? (
                  <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                {item.rules && item.rules.length > 0 ? (
                  <Text style={[styles.rulesSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.rules.slice(0, 2).join(' · ')}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {item.members_count ?? 0} members · {item.posts_count ?? 0} posts
                  {item.privacy ? ` · ${item.privacy}` : ''}
                </Text>
              </WorldCard>
            )}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  badge: { fontSize: 12, fontWeight: '700' },
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  rulesSnippet: { fontSize: 12, lineHeight: 18, marginBottom: 6, fontStyle: 'italic' },
  meta: { fontSize: 12 },
  joinBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  joinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
