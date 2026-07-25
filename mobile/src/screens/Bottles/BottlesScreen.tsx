import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';

type BottleRow = {
  id: number | string;
  message?: string;
  emotion_type?: string;
  created_at?: string;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_name?: string | null;
};

const EMOTIONS = ['hope', 'joy', 'curiosity', 'gratitude', 'wonder'];

function toCoordinate(value?: number | string | null) {
  const numberValue = typeof value === 'string' ? Number.parseFloat(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null;
}

function bottleLocation(item: BottleRow) {
  const lat = toCoordinate(item.location_lat ?? item.lat ?? item.latitude);
  const lng = toCoordinate(item.location_lng ?? item.lng ?? item.longitude);
  return { lat, lng };
}

export default function BottlesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [bottles, setBottles] = useState<BottleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [catching, setCatching] = useState(false);
  const [throwing, setThrowing] = useState(false);
  const [draft, setDraft] = useState('');
  const [emotion, setEmotion] = useState('hope');
  const [polishing, setPolishing] = useState(false);

  const nearbyBottles = useMemo(
    () =>
      bottles
        .filter((item) => {
          const { lat, lng } = bottleLocation(item);
          return lat != null && lng != null;
        })
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5),
    [bottles],
  );

  const load = useCallback(async (isRefresh = false) => {
    try {
      const rows = await api.getBottles();
      setBottles((Array.isArray(rows) ? rows : []) as BottleRow[]);
    } catch (error) {
      console.error('Failed to load bottles:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCatch = async () => {
    setCatching(true);
    try {
      const caught = await api.catchBottle();
      Alert.alert('Bottle caught!', caught?.message || 'A message from the cosmic sea.');
      load(true);
    } catch (error: any) {
      Alert.alert('Empty sea', error?.response?.data?.detail || 'No bottles drifting right now.');
    } finally {
      setCatching(false);
    }
  };

  const handlePolish = async () => {
    const text = draft.trim();
    if (!text) return;
    setPolishing(true);
    try {
      const result = await api.polishTone(text, 'bottle');
      if (result.polished) {
        setDraft(result.polished);
        if (result.note) Alert.alert('Tone polished', result.note);
      }
    } catch {
      Alert.alert('Polish failed', 'Could not reach the AI. Try again.');
    } finally {
      setPolishing(false);
    }
  };

  const handleThrow = async () => {
    const message = draft.trim();
    if (!message) return;
    setThrowing(true);
    try {
      await api.throwBottle({ message, emotion_type: emotion });
      setDraft('');
      Alert.alert('Thrown', 'Your bottle is drifting in the cosmos.');
      load(true);
    } catch (error: any) {
      Alert.alert('Could not throw', error?.response?.data?.detail || 'Try again.');
    } finally {
      setThrowing(false);
    }
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Bottles"
          subtitle="Messages in the cosmos"
          tone="vault"
          onBack={() => navigation.goBack()}
        />

        {loading && bottles.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={bottles}
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
              <>
                <WorldCard>
                  <WorldPrimaryButton
                    label={catching ? '…' : 'Catch a bottle'}
                    onPress={handleCatch}
                    loading={catching}
                    disabled={catching}
                  />
                </WorldCard>

                <WorldCard style={styles.throwCard}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Throw a bottle</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
                    placeholder="Write a message to the cosmos…"
                    placeholderTextColor={colors.textSecondary}
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    maxLength={500}
                  />
                  <View style={styles.emotionRow}>
                    {EMOTIONS.map((e) => (
                      <Text
                        key={e}
                        onPress={() => setEmotion(e)}
                        style={[
                          styles.emotionChip,
                          {
                            borderColor: emotion === e ? colors.primary : colors.border,
                            backgroundColor: emotion === e ? colors.primary + '22' : 'transparent',
                            color: emotion === e ? colors.primary : colors.textSecondary,
                          },
                        ]}
                      >
                        {e}
                      </Text>
                    ))}
                  </View>
                  <WorldPrimaryButton
                    label={polishing ? '✨ Polishing…' : '✨ Polish tone'}
                    onPress={handlePolish}
                    loading={polishing}
                    disabled={polishing || !draft.trim()}
                  />
                  <WorldPrimaryButton
                    label={throwing ? '…' : 'Throw'}
                    onPress={handleThrow}
                    loading={throwing}
                    disabled={throwing || !draft.trim()}
                  />
                </WorldCard>

                {nearbyBottles.length > 0 ? (
                  <WorldCard>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>Nearby</Text>
                    {nearbyBottles.map((item) => {
                      const { lat, lng } = bottleLocation(item);
                      return (
                        <View key={String(item.id)} style={styles.nearbyRow}>
                          <Text style={[styles.nearbyMessage, { color: colors.text }]} numberOfLines={1}>
                            {item.message || 'A drifting bottle'}
                          </Text>
                          <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                            {item.location_name || `${lat?.toFixed(4)}, ${lng?.toFixed(4)}`}
                          </Text>
                        </View>
                      );
                    })}
                  </WorldCard>
                ) : null}

                <Text style={[styles.sectionLabel, { color: colors.text, paddingHorizontal: 4, marginBottom: 4 }]}>
                  Drifting now
                </Text>
              </>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🌊</Text>
                <Text style={{ color: colors.textSecondary }}>No bottles on the map right now.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const { lat, lng } = bottleLocation(item);
              return (
                <WorldCard>
                  <Text style={[styles.emotion, { color: colors.primary }]}>
                    {item.emotion_type || 'unknown'}
                  </Text>
                  <Text style={[styles.cardBody, { color: colors.text }]} numberOfLines={4}>
                    {item.message || '…'}
                  </Text>
                  {lat != null && lng != null ? (
                    <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                      {item.location_name || 'Location'} · {lat.toFixed(4)}, {lng.toFixed(4)}
                    </Text>
                  ) : null}
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
  throwCard: { marginBottom: 8 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  input: { minHeight: 72, borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 8 },
  emotionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  emotionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    overflow: 'hidden',
  },
  emotion: { fontSize: 12, fontWeight: '700', marginBottom: 4, textTransform: 'capitalize' },
  cardBody: { fontSize: 14, lineHeight: 20 },
  nearbyRow: { marginBottom: 8 },
  nearbyMessage: { fontSize: 13, fontWeight: '700' },
  locationText: { fontSize: 12, marginTop: 6, fontWeight: '600' },
});
