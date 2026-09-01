import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#C4B5FD',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    successBg: '#e8f3ee',
    successText: '#2f8f6b',
  },
  dark: {
    cream: '#14102A',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    successBg: 'rgba(74,222,128,0.15)',
    successText: '#4ade80',
  },
};

type Entry = {
  id: number | string;
  content?: string;
  submitted_at?: string;
  created_at?: string;
  is_approved?: boolean;
  challenge_title?: string;
  challenge?: { title?: string };
};

function formatDate(value: string | undefined, justNow: string) {
  if (!value) return justNow;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return justNow;
  return date.toLocaleString();
}

export default function LabHistoryScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { t } = useLocale();
  const C = isDark ? PALETTES.dark : { ...PALETTES.light, brown: '#7C3AED' };
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.getMyChallengeEntries();
      setRows(Array.isArray(data) ? (data as Entry[]) : []);
    } catch {
      setRows([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.root, { backgroundColor: C.cream }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: C.brown }]}>{t('lab.historyTitle')}</Text>
            <Text style={[styles.subtitle, { color: C.text2 }]}>{t('lab.historySubtitle')}</Text>
          </View>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.back, { backgroundColor: C.white, borderColor: C.line }]}
          >
            <Text style={{ color: C.brownDk, fontWeight: '700', fontSize: 13 }}>{t('lab.backToLab')}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={[styles.state, { backgroundColor: C.card2 }]}>
            <ActivityIndicator color={C.brown} />
            <Text style={{ color: C.text2, marginTop: 10 }}>{t('lab.loadingEntries')}</Text>
          </View>
        ) : error ? (
          <View style={[styles.state, { backgroundColor: C.card2 }]}>
            <Text style={{ color: C.text2, textAlign: 'center' }}>{t('lab.historyLoadError')}</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={[styles.state, { backgroundColor: C.card2 }]}>
                <Text style={{ color: C.text2, textAlign: 'center' }}>{t('lab.noEntries')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
                <Text style={[styles.cardTitle, { color: C.text }]}>
                  {item.challenge?.title || item.challenge_title || t('lab.challengeFallback')}
                </Text>
                {item.content ? (
                  <Text style={[styles.body, { color: C.text2 }]}>{item.content}</Text>
                ) : null}
                <View style={styles.metaRow}>
                  {item.is_approved ? (
                    <View style={[styles.badge, { backgroundColor: C.successBg }]}>
                      <Ionicons name="checkmark-circle" size={14} color={C.successText} />
                      <Text style={{ color: C.successText, fontWeight: '700', fontSize: 12 }}>{t('lab.approved')}</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: C.card2 }]}>
                      <Ionicons name="time-outline" size={14} color={C.brownDk} />
                      <Text style={{ color: C.brownDk, fontWeight: '700', fontSize: 12 }}>{t('lab.pendingReview')}</Text>
                    </View>
                  )}
                  <Text style={{ color: C.text2, fontSize: 12 }}>
                    {formatDate(item.submitted_at || item.created_at, t('lab.justNow'))}
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  back: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  state: { marginHorizontal: 16, borderRadius: 16, padding: 36, alignItems: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  body: { fontSize: 13, marginTop: 8, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
});
