import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldStat,
} from '@/components/world/WorldChrome';

type PassportStamp = {
  world: string;
  label: string;
  value: number;
  earned: boolean;
};

export default function PassportScreen() {
  const { colors } = useTheme();
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api.request<any>('get', '/users/me/passports/');
      if (Array.isArray(data?.worlds) && data.worlds.length) {
        setStamps(
          data.worlds.map((row: any) => ({
            world: row.world || row.key || 'world',
            label: row.label || row.world || 'Stamp',
            value: Number(row.count ?? row.value ?? 0),
            earned: Number(row.count ?? row.value ?? 0) > 0,
          })),
        );
      } else {
        const rows = Array.isArray(data?.stamps) ? data.stamps : Array.isArray(data) ? data : [];
        const mapped: PassportStamp[] = rows.map((row: any) => ({
          world: row.world || row.id || 'world',
          label: row.label || row.name || row.world || 'Stamp',
          value: Number(row.value ?? row.count ?? 0),
          earned: Boolean(row.earned ?? (row.value ?? row.count ?? 0) > 0),
        }));
        if (mapped.length) {
          setStamps(mapped);
        } else if (data && typeof data === 'object') {
          const stampsObj = data.stamps || data;
          setStamps([
            { world: 'lab', label: 'Lab streak', value: stampsObj.lab_streak || 0, earned: (stampsObj.lab_streak || 0) > 0 },
            { world: 'bottles', label: 'Bottles caught', value: stampsObj.bottles_caught || 0, earned: (stampsObj.bottles_caught || 0) > 0 },
            { world: 'bazaar', label: 'Ideas launched', value: stampsObj.ideas_launched || 0, earned: (stampsObj.ideas_launched || 0) > 0 },
            { world: 'capsules', label: 'Capsules opened', value: stampsObj.capsules_opened || 0, earned: (stampsObj.capsules_opened || 0) > 0 },
            { world: 'communities', label: 'Communities joined', value: stampsObj.communities_joined || 0, earned: (stampsObj.communities_joined || 0) > 0 },
            { world: 'live', label: 'Lives hosted', value: stampsObj.lives_hosted || 0, earned: (stampsObj.lives_hosted || 0) > 0 },
          ]);
        }
      }
    } catch {
      setStamps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const earnedCount = stamps.filter((s) => s.earned).length;

  return (
    <WorldBackdrop tone="bazaar">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="World Passports"
          subtitle="Your stamps"
          tone="bazaar"
        />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => {
                setLoading(true);
                void load();
              }}
              colors={[colors.primary]}
            />
          }
        >
          <WorldHero
            tone="bazaar"
            eyebrow="Travel log"
            title="Stamps across Cosmory"
            body="Earned across Lab, Vault, Bazaar, and Communities."
          />

          {!loading && stamps.length > 0 ? (
            <View style={styles.statsRow}>
              <WorldStat label="Earned" value={earnedCount} />
              <WorldStat label="Total" value={stamps.length} />
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            stamps.map((stamp) => (
              <WorldCard
                key={stamp.world}
                style={{ opacity: stamp.earned ? 1 : 0.55 }}
              >
                <View style={styles.stampRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.kicker, { color: stamp.earned ? colors.primary : colors.textSecondary }]}>
                      {stamp.world}
                    </Text>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{stamp.label}</Text>
                  </View>
                  <Text style={[styles.cardValue, { color: colors.primary }]}>{stamp.value}</Text>
                </View>
              </WorldCard>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardValue: { fontSize: 22, fontWeight: '800' },
});
