import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, RefreshControl, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import { User } from '@/types';
import { WorldBackdrop, WorldCard, WorldHeader, WorldHero } from '@/components/world/WorldChrome';

export default function PeopleListScreen({ kind }: { kind: 'followers' | 'following' }) {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [rows, setRows] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const username = route.params?.username as string | undefined;
  const userIdParam = route.params?.userId as string | number | undefined;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let userId = userIdParam || user?.id;
      if (username && username !== user?.username) {
        const profile = await api.getProfile(username);
        userId = profile.id;
      }
      if (!userId) return;
      const data = kind === 'followers' ? await api.getFollowers(userId) : await api.getFollowing(userId);
      setRows(Array.isArray(data) ? (data as User[]) : []);
    } finally {
      setLoading(false);
    }
  }, [kind, user?.id, user?.username, userIdParam, username]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={kind === 'followers' ? 'Followers' : 'Following'}
          subtitle="People"
          tone="default"
          onBack={() => navigation.goBack()}
        />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item, index) => String(item.id ?? item.username ?? index)}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} colors={[colors.primary]} />}
            ListHeaderComponent={
              <WorldHero
                tone="default"
                eyebrow={username ? `@${username}` : 'Network'}
                title={kind === 'followers' ? 'People following this profile' : 'People this profile follows'}
                body="Tap a person to open their profile."
              />
            }
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No people found</Text>}
            renderItem={({ item }) => (
              <WorldCard onPress={() => navigation.navigate('Profile', { username: item.username })}>
                <TouchableOpacity style={styles.row} activeOpacity={0.9}>
                  {item.avatar ? (
                    <Image source={{ uri: mediaUrl(item.avatar) || item.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                      <Text style={styles.avatarText}>{item.username?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{item.display_name || item.username}</Text>
                    <Text style={[styles.handle, { color: colors.textSecondary }]}>@{item.username}</Text>
                  </View>
                </TouchableOpacity>
              </WorldCard>
            )}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '800' },
  handle: { fontSize: 13, marginTop: 2 },
  empty: { padding: 24, textAlign: 'center', fontWeight: '700' },
});
