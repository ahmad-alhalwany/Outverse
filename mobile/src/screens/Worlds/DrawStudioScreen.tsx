import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useAuth } from '@/auth/AuthContext';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
  WorldPill,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import {
  asStudioSessions,
  useStudioPalette,
  type StudioSession,
} from '@/lib/studio';

type FilterKey = 'all' | 'live' | 'mine';

export default function DrawStudioScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useStudioPalette(isDark);
  const { t } = useLocale();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StudioSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setSessions(asStudioSessions(await api.getDrawSessions()));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'live') return sessions.filter((s) => s.mode === 'live');
    if (filter === 'mine') return sessions.filter((s) => s.host?.id === user?.id || s.host?.username === user?.username);
    return sessions;
  }, [filter, sessions, user?.id, user?.username]);

  const openSession = (id: number) => navigation.navigate('StudioSession', { sessionId: id });

  const createSession = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const created = await api.createDrawSession({
        title: `Session ${new Date().toLocaleTimeString()}`,
      });
      await load(true);
      if (created?.id) openSession(created.id);
    } catch {
      Alert.alert(t('studio.title'), t('studio.createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('studio.title')}
          subtitle={t('studio.eyebrow')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        {loading && sessions.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />}
            ListHeaderComponent={
              <>
                <WorldHero
                  tone="default"
                  eyebrow={t('studio.eyebrow')}
                  title={t('studio.title')}
                  body={t('studio.subtitle')}
                  action={
                    <WorldPrimaryButton
                      label={creating ? '…' : t('studio.newSession')}
                      tone="default"
                      loading={creating}
                      onPress={() => void createSession()}
                    />
                  }
                />
                <View style={styles.sectionHead}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>{t('studio.sessions')}</Text>
                    <Text style={[styles.sectionHint, { color: C.text2 }]}>{t('studio.sessionsHint')}</Text>
                  </View>
                  <Text style={[styles.countChip, { backgroundColor: C.card2, color: C.brown }]}>
                    {filtered.length}
                  </Text>
                </View>
                <View style={styles.pills}>
                  {([
                    ['all', t('studio.filterAll')],
                    ['live', t('studio.filterLive')],
                    ['mine', t('studio.filterMine')],
                  ] as const).map(([key, label]) => (
                    <WorldPill
                      key={key}
                      label={label}
                      active={filter === key}
                      tone="default"
                      onPress={() => setFilter(key)}
                    />
                  ))}
                </View>
              </>
            }
            ListEmptyComponent={
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Ionicons name="color-palette-outline" size={28} color={C.brown} />
                <Text style={[styles.emptyText, { color: C.text2 }]}>{t('studio.empty')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <SessionCard session={item} onOpen={() => openSession(item.id)} />
            )}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function SessionCard({ session, onOpen }: { session: StudioSession; onOpen: () => void }) {
  const { isDark } = useTheme();
  const C = useStudioPalette(isDark);
  const { t } = useLocale();
  const live = session.mode === 'live';
  const initial = (session.title || '?').trim().charAt(0).toUpperCase();

  return (
    <Pressable onPress={onOpen} style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
      <LinearGradient colors={[C.coverFrom, C.coverTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
        <View style={styles.coverMark}>
          <Ionicons name="brush" size={20} color={C.brown} />
          <Text style={[styles.coverLetter, { color: C.brown }]}>{initial}</Text>
        </View>
        <View style={[styles.modeBadge, { backgroundColor: live ? '#dc2626' : C.brownDk }]}>
          {live ? <View style={styles.liveDot} /> : null}
          <Text style={styles.modeBadgeText}>{live ? t('studio.live') : t('studio.solo')}</Text>
        </View>
      </LinearGradient>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={1}>
          {session.title || t('studio.title')}
        </Text>
        <Text style={[styles.cardHost, { color: C.text2 }]} numberOfLines={1}>
          @{session.host?.username || '—'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 13,
    marginTop: 2,
  },
  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 13,
    fontWeight: '700',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  empty: {
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cover: {
    height: 92,
    padding: 14,
    justifyContent: 'space-between',
  },
  coverMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coverLetter: {
    fontSize: 22,
    fontWeight: '700',
  },
  modeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  modeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardHost: {
    fontSize: 13,
  },
});
