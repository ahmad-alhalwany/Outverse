import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldStat,
} from '@/components/world/WorldChrome';

type LiveRow = {
  id: number | string;
  title?: string;
  description?: string;
  status?: string;
  user?: string;
  current_viewers?: number;
  peak_viewers?: number;
  is_live?: boolean;
  started_at?: string | null;
};

export default function LiveScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [sessions, setSessions] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [goingLive, setGoingLive] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const page = await api.getLiveSessions({ status: 'live' });
      const rows = (page.results as LiveRow[]).length
        ? (page.results as LiveRow[])
        : ((await api.getLiveSessions()).results as LiveRow[]);
      setSessions(rows);
    } catch (error) {
      console.error('Failed to load live sessions:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleGoLive = async () => {
    if (goingLive) return;
    setGoingLive(true);
    try {
      const session = await api.createLiveSession({ title: 'My Live Stream' });
      const started = await api.startLiveSession(session.id);
      navigation.navigate('LiveViewer', { sessionId: started.id || session.id, isHost: true });
    } catch (error: any) {
      Alert.alert('Could not go live', error?.response?.data?.detail || 'Try again.');
    } finally {
      setGoingLive(false);
    }
  };

  const liveCount = sessions.filter((s) => s.is_live || s.status === 'live').length;

  return (
    <WorldBackdrop tone="live">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Live"
          subtitle="Watch & broadcast"
          tone="live"
          onBack={() => navigation.goBack()}
          right={
            <Text
              onPress={goingLive ? undefined : handleGoLive}
              style={[styles.goLiveText, { color: goingLive ? colors.textSecondary : colors.primary }]}
            >
              {goingLive ? '…' : 'Go Live'}
            </Text>
          }
        />

        {loading && sessions.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={sessions}
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
              liveCount > 0 ? (
                <WorldCard style={styles.statsCard}>
                  <View style={styles.statsRow}>
                    <WorldStat label="Live now" value={liveCount} />
                    <WorldStat label="Total sessions" value={sessions.length} />
                  </View>
                </WorldCard>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📡</Text>
                <Text style={{ color: colors.textSecondary }}>No live sessions right now</Text>
              </View>
            }
            renderItem={({ item }) => {
              const live = item.is_live || item.status === 'live';
              return (
                <WorldCard onPress={() => navigation.navigate('LiveViewer', { sessionId: item.id })}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                      {item.title || 'Untitled stream'}
                    </Text>
                    <View style={[styles.liveDot, { backgroundColor: live ? '#ef4444' : colors.textSecondary }]} />
                  </View>
                  {item.description ? (
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    <WorldStat label="Viewers" value={item.current_viewers ?? 0} />
                    {item.user ? (
                      <Text style={[styles.meta, { color: colors.textSecondary }]}>by {item.user}</Text>
                    ) : null}
                    <Text style={[styles.statusBadge, {
                      color: live ? '#ef4444' : colors.textSecondary,
                      fontWeight: live ? '700' : '400',
                    }]}>
                      {live ? '● LIVE' : item.status || 'scheduled'}
                    </Text>
                  </View>
                </WorldCard>
              );
            }}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { padding: 12, paddingBottom: 40 },
  statsCard: { marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 12 },
  goLiveText: { fontSize: 14, fontWeight: '700' },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  meta: { fontSize: 12 },
  statusBadge: { fontSize: 12 },
});
