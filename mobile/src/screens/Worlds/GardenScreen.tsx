import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import type { BazaarIdea } from '@/lib/bazaar';
import { asGardenIdeas, gardenGrowthStage, useGardenPalette } from '@/lib/garden';

export default function GardenScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useGardenPalette(isDark);
  const { t } = useLocale();
  const [ideas, setIdeas] = useState<BazaarIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const data = await api.getIdeas({ ordering: 'new', limit: 60, offset: 0 });
      setIdeas(asGardenIdeas(data.results ?? data));
    } catch {
      setIdeas([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openBazaar = () => navigation.navigate('Bazaar');

  return (
    <WorldBackdrop tone="lab">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('garden.title')}
          subtitle={t('nav.garden')}
          tone="lab"
          onBack={() => navigation.goBack()}
        />
        {loading && ideas.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
          >
            <WorldHero
              tone="lab"
              eyebrow="🌱"
              title={t('garden.title')}
              body={t('garden.subtitle')}
              action={<WorldPrimaryButton label={t('garden.visitBazaar')} tone="lab" onPress={openBazaar} />}
            />

            <LinearGradient
              colors={isDark ? [C.card2, C.cream] : [C.card2, C.cream]}
              style={[styles.bed, { borderColor: C.line }]}
            >
              <View style={styles.bedHead}>
                <Text style={[styles.bedTitle, { color: C.text }]}>{t('garden.title')}</Text>
                <Text style={[styles.count, { backgroundColor: C.white, color: C.brownDk }]}>
                  {t('garden.plantedCount', { count: ideas.length })}
                </Text>
              </View>

              {error ? (
                <View style={styles.empty}>
                  <Text style={[styles.emptyText, { color: C.text2 }]}>{t('garden.loadError')}</Text>
                  <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                    <Text style={styles.retryText}>{t('garden.retry')}</Text>
                  </Pressable>
                </View>
              ) : ideas.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyEmoji}>🌰</Text>
                  <Text style={[styles.emptyText, { color: C.text2 }]}>{t('garden.empty')}</Text>
                  <Pressable onPress={openBazaar} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                    <Text style={styles.retryText}>{t('garden.visitBazaar')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.grid}>
                  {ideas.map((item) => {
                    const stage = gardenGrowthStage(item);
                    return (
                      <Pressable
                        key={String(item.id)}
                        onPress={() => navigation.navigate('BazaarDetail', { ideaId: item.id })}
                        style={[styles.plant, { backgroundColor: C.white, borderColor: C.line }]}
                      >
                        <Text style={styles.emoji}>{stage.emoji}</Text>
                        <Text style={[styles.stage, { color: C.brown }]}>{t(stage.labelKey)}</Text>
                        <Text style={[styles.plantTitle, { color: C.text }]} numberOfLines={2}>
                          {item.title || t('garden.title')}
                        </Text>
                        <Text style={[styles.meta, { color: C.text2 }]}>
                          {item.supporters ?? 0} {t('garden.supporters')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </LinearGradient>
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 13 },
  bed: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 16,
  },
  bedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  bedTitle: { fontSize: 15, fontWeight: '800' },
  count: {
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  plant: {
    width: '47.5%',
    flexGrow: 1,
    maxWidth: '48.5%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  stage: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  plantTitle: { fontSize: 13, fontWeight: '700', textAlign: 'center', minHeight: 36 },
  meta: { fontSize: 11, marginTop: 4 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  retry: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
