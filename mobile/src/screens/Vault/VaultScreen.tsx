import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import {
  asCapsuleStats,
  asVaultMoods,
  moodLabel,
  ritualStreak,
  useVaultPalette,
  type CapsuleStats,
  type VaultMoodRow,
} from '@/lib/vault';

export default function VaultScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useVaultPalette(isDark);
  const { t, locale } = useLocale();

  const [streak, setStreak] = useState(0);
  const [capsuleStats, setCapsuleStats] = useState<CapsuleStats | null>(null);
  const [moods, setMoods] = useState<VaultMoodRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [ritual, caps, dashboard] = await Promise.all([
        api.getDailyQuestion({ lang: locale }).catch(() => null),
        api.getCapsuleStats().catch(() => null),
        api.getBottlesDashboard().catch(() => null),
      ]);
      setStreak(ritualStreak(ritual));
      setCapsuleStats(asCapsuleStats(caps));
      setMoods(asVaultMoods(dashboard));
    } finally {
      setRefreshing(false);
    }
  }, [locale]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const chambers = [
    {
      key: 'bottles',
      screen: 'Bottles',
      label: t('vault.bottlesLabel'),
      title: t('vault.bottlesTitle'),
      body: t('vault.bottlesBody'),
    },
    {
      key: 'capsules',
      screen: 'Capsules',
      label: t('vault.capsulesLabel'),
      title: t('vault.capsulesTitle'),
      body: capsuleStats
        ? t('vault.capsulesStats', {
            sealed: capsuleStats.sealed,
            ready: capsuleStats.ready,
            opened: capsuleStats.opened,
          })
        : t('vault.capsulesBody'),
    },
    {
      key: 'year',
      screen: 'Year',
      label: t('vault.mapLabel'),
      title: t('vault.mapTitle'),
      body: t('vault.mapBody', { streak }),
    },
  ];

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('nav.vault')}
          subtitle={t('vault.eyebrow')}
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.accent} />
          }
        >
          <LinearGradient
            colors={[C.glow, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={styles.glow}
          />

          <Text style={[styles.eyebrow, { color: C.accent }]}>{t('vault.eyebrow')}</Text>
          <Text style={[styles.title, { color: C.ink }]}>{t('vault.title')}</Text>
          <Text style={[styles.subtitle, { color: C.muted }]}>{t('vault.subtitle')}</Text>

          {chambers.map((chamber) => (
            <Pressable
              key={chamber.key}
              onPress={() => navigation.navigate(chamber.screen)}
              style={[styles.chamber, { backgroundColor: C.card, borderColor: C.line }]}
            >
              <Text style={[styles.chamberLabel, { color: C.accent }]}>{chamber.label}</Text>
              <Text style={[styles.chamberTitle, { color: C.ink }]}>{chamber.title}</Text>
              <Text style={[styles.chamberBody, { color: C.muted }]}>{chamber.body}</Text>
              <Text style={[styles.enter, { color: C.accent }]}>{t('vault.enter')}</Text>
            </Pressable>
          ))}

          <View style={[styles.moodCard, { backgroundColor: C.card, borderColor: C.line }]}>
            <Text style={[styles.moodTitle, { color: C.ink }]}>{t('vault.emotionTitle')}</Text>
            <Text style={[styles.moodSub, { color: C.muted }]}>{t('vault.emotionSubtitle')}</Text>

            <View style={styles.moodActions}>
              <Pressable
                onPress={() => navigation.navigate('Bottles')}
                style={[styles.primaryBtn, { backgroundColor: C.accentDk }]}
              >
                <Text style={styles.primaryText}>{t('vault.openBottles')}</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate('Memories')}
                style={[styles.secondaryBtn, { borderColor: C.line }]}
              >
                <Text style={[styles.secondaryText, { color: C.ink }]}>{t('vault.openMemories')}</Text>
              </Pressable>
            </View>

            {moods.length === 0 ? (
              <Text style={[styles.empty, { color: C.muted }]}>{t('vault.emotionEmpty')}</Text>
            ) : (
              <View style={styles.moodList}>
                {moods.map((row) => (
                  <View
                    key={row.emotion}
                    style={[
                      styles.moodRow,
                      {
                        borderColor: C.line,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.04)',
                      },
                    ]}
                  >
                    <Text style={[styles.moodName, { color: C.ink }]}>{moodLabel(row.emotion, t)}</Text>
                    <Text style={[styles.moodCount, { color: C.accent }]}>
                      {row.asPercent ? `${row.count}%` : row.count}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 80,
    height: 180,
    opacity: 0.7,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, lineHeight: 38 },
  subtitle: { fontSize: 16, lineHeight: 24, marginTop: 12, marginBottom: 22 },
  chamber: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    marginBottom: 12,
  },
  chamberLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  chamberTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  chamberBody: { fontSize: 14, lineHeight: 21 },
  enter: { marginTop: 16, fontSize: 14, fontWeight: '800' },
  moodCard: {
    borderWidth: 1,
    borderRadius: 32,
    padding: 20,
    marginTop: 8,
  },
  moodTitle: { fontSize: 20, fontWeight: '800' },
  moodSub: { fontSize: 13, marginTop: 6, marginBottom: 14 },
  moodActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  primaryBtn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  secondaryBtn: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryText: { fontWeight: '800', fontSize: 13 },
  empty: { fontSize: 13, lineHeight: 20 },
  moodList: { gap: 10 },
  moodRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  moodName: { fontSize: 15, fontWeight: '700', flex: 1 },
  moodCount: { fontSize: 18, fontWeight: '800' },
});
