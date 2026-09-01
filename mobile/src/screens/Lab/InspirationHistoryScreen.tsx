import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

const CATEGORY_KEYS: Record<string, string> = {
  historical: 'mobile.catHistorical',
  fantasy: 'mobile.catFantasy',
  scifi: 'mobile.catScifi',
  philosophical: 'mobile.catPhilosophical',
  mystery: 'mobile.catMystery',
  surreal: 'mobile.catSurreal',
  everyday: 'mobile.catEveryday',
  emotional: 'mobile.catEmotional',
};

type HistoryRow = {
  viewed_at?: string;
  published?: boolean;
  skipped?: boolean;
  question?: { id?: number; text?: string; category?: string };
};

export default function InspirationHistoryScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getInspirationHistory();
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WorldBackdrop tone="lab">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('mobile.inspHistoryTitle')}
          subtitle={t('mobile.inspHistorySub')}
          tone="lab"
          onBack={() => navigation.goBack()}
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item, index) => `${item.question?.id || 'q'}-${item.viewed_at || index}`}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={{ padding: 28, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('mobile.inspHistoryEmpty')}</Text>
                <Pressable onPress={() => navigation.navigate('Lab')} style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>{t('mobile.openDaily')}</Text>
                </Pressable>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.chips}>
                  <Text style={[styles.chip, { color: colors.primary }]}>
                    {CATEGORY_KEYS[item.question?.category || ''] ? t(CATEGORY_KEYS[item.question?.category || '']) : item.question?.category || t('mobile.prompt')}
                  </Text>
                  {item.published ? <Text style={[styles.chip, { color: colors.success }]}>{t('mobile.published')}</Text> : null}
                  {item.skipped && !item.published ? (
                    <Text style={[styles.chip, { color: colors.textSecondary }]}>{t('mobile.skipped')}</Text>
                  ) : null}
                </View>
                <Text style={[styles.title, { color: colors.text }]}>{item.question?.text || 'Prompt'}</Text>
                {item.viewed_at ? (
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>{item.viewed_at}</Text>
                ) : null}
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  title: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  meta: { fontSize: 12, marginTop: 8 },
});
