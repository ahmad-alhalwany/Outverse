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
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  asYearInReview,
  formatYearDate,
  formatYearNumber,
  useYearPalette,
  yearHasContent,
  type YearInReview,
  type YearPalette,
} from '@/lib/year';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export default function YearScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const C = useYearPalette(isDark);
  const { t, locale, isRTL } = useLocale();

  const [data, setData] = useState<YearInReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (!isAuthenticated) {
      setData(null);
      setError('');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const next = asYearInReview(await api.getYearStats());
      setData(next);
      if (!next) setError(t('year.loadError'));
    } catch {
      setData(null);
      setError(t('year.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const year = data?.year ?? new Date().getFullYear();
  const headline = data?.display_name
    ? t('year.titleNamed', { name: data.display_name, year })
    : `${t('year.yourYear')} ${year}`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.page }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.accent} />
          ) : undefined
        }
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.muted} />
          <Text style={[styles.backText, { color: C.muted }]}>{t('common.back')}</Text>
        </Pressable>

        <View style={styles.heroHead}>
          <View style={[styles.brand, { backgroundColor: C.chipBg }]}>
            <Ionicons name="sparkles-outline" size={13} color={C.accent} />
            <Text style={[styles.brandText, { color: C.accent }]}>{t('year.brand')}</Text>
          </View>
          <Text style={[styles.headline, { color: C.text }]}>{headline}</Text>
          <Text style={[styles.subtitle, { color: C.muted }]}>{t('year.subtitle')}</Text>
        </View>

        {!isAuthenticated ? (
          <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.emptyBody, { color: C.muted }]}>{t('year.needsAuth')}</Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={styles.signIn}
            >
              <Text style={styles.signInText}>{t('auth.signIn')}</Text>
            </Pressable>
          </View>
        ) : loading && !data ? (
          <View style={styles.stack}>
            {[112, 88, 88].map((height, i) => (
              <View
                key={i}
                style={[styles.skeleton, { height, backgroundColor: C.card, borderColor: C.border }]}
              />
            ))}
          </View>
        ) : error && !data ? (
          <Pressable
            onPress={() => void load()}
            style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Text style={[styles.emptyBody, { color: C.muted }]}>{error}</Text>
            <Text style={[styles.retry, { color: C.accent }]}>{t('common.tryAgain')}</Text>
          </Pressable>
        ) : data && !yearHasContent(data) ? (
          <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.emptyTitle, { color: C.text }]}>
              {t('year.emptyTitle', { year: data.year })}
            </Text>
            <Text style={[styles.emptyBody, { color: C.muted }]}>{t('year.emptyBody')}</Text>
          </View>
        ) : data ? (
          <YearRecapView
            data={data}
            C={C}
            t={t}
            locale={locale}
            onOpenPost={(postId) => navigation.navigate('PostDetail', { postId })}
            onOpenTag={(tag) => navigation.navigate('TagFeed', { tag })}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function YearRecapView({
  data,
  C,
  t,
  locale,
  onOpenPost,
  onOpenTag,
}: {
  data: YearInReview;
  C: YearPalette;
  t: TFn;
  locale: string;
  onOpenPost: (id: number) => void;
  onOpenTag: (tag: string) => void;
}) {
  const stats: Array<{ value: number; label: string }> = [
    { value: data.posts_count, label: t('year.posts') },
    { value: data.ritual_days, label: t('year.ritualDays') },
    { value: data.ritual_max_streak, label: t('year.longestStreak') },
    { value: data.voice_notes, label: t('year.voiceNotes') },
    { value: data.capsules_created, label: t('year.capsulesSealed') },
    { value: data.capsules_opened, label: t('year.capsulesOpened') },
    { value: data.rooms_joined, label: t('year.roomsJoined') },
    { value: data.longest_post_chars, label: t('year.longestPost') },
  ];

  return (
    <View style={styles.stack}>
      <LinearGradient
        colors={[C.card, C.chipBg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroCard, { borderColor: C.border }]}
      >
        <Text style={[styles.heroValue, { color: C.gold }]}>
          {formatYearNumber(data.words_written, locale)}
        </Text>
        <Text style={[styles.heroLabel, { color: C.muted }]}>{t('year.wordsWritten')}</Text>
      </LinearGradient>

      <View style={styles.grid}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={[styles.statCard, { backgroundColor: C.card, borderColor: C.border }]}
          >
            <Text style={[styles.statValue, { color: C.accent }]}>
              {formatYearNumber(stat.value, locale)}
            </Text>
            <Text style={[styles.statLabel, { color: C.muted }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {data.first_post ? (
        <Pressable
          onPress={() => onOpenPost(data.first_post!.id)}
          style={[styles.panel, { backgroundColor: C.card, borderColor: C.border }]}
        >
          <Text style={[styles.panelTitle, { color: C.muted }]}>{t('year.yearBeganTitle')}</Text>
          <Text style={[styles.quote, { color: C.text }]}>“{data.first_post.text}”</Text>
          {data.first_post.created_at ? (
            <Text style={[styles.meta, { color: C.muted }]}>
              {formatYearDate(data.first_post.created_at, locale)}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      {data.top_tags.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.panelTitle, { color: C.muted }]}>{t('year.tagsTitle')}</Text>
          <View style={styles.tags}>
            {data.top_tags.map((row) => (
              <Pressable
                key={row.key}
                onPress={() => onOpenTag(row.key)}
                style={[styles.tag, { backgroundColor: C.chipBg }]}
              >
                <Text style={[styles.tagText, { color: C.accent }]}>
                  #{row.key}{' '}
                  <Text style={{ color: C.muted }}>· {formatYearNumber(row.count, locale)}</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {data.top_categories.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.card, borderColor: C.border }]}>
          <Text style={[styles.panelTitle, { color: C.muted }]}>{t('year.categoriesTitle')}</Text>
          {data.top_categories.map((row) => (
            <View key={row.key} style={styles.catRow}>
              <Text style={[styles.catName, { color: C.text }]}>{row.key}</Text>
              <Text style={[styles.catCount, { color: C.muted }]}>
                {formatYearNumber(row.count, locale)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <LinearGradient
        colors={[C.card, C.chipBg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.closing, { borderColor: C.border }]}
      >
        <Text style={[styles.closingText, { color: C.text }]}>
          {data.posts_count > 0
            ? t('year.closingPosts', {
                count: data.posts_count,
                plural: data.posts_count === 1 ? '' : 's',
              })
            : t('year.closingCapsules', {
                count: data.capsules_created,
                plural: data.capsules_created === 1 ? '' : 's',
              })}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18, alignSelf: 'flex-start' },
  backText: { fontSize: 14, fontWeight: '600' },
  heroHead: { alignItems: 'center', marginBottom: 24, paddingHorizontal: 8 },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 12,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 38,
    textAlign: 'center',
  },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
  stack: { gap: 16 },
  skeleton: { borderRadius: 18, borderWidth: 1 },
  empty: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 },
  retry: { fontSize: 13, fontWeight: '700', marginTop: 12 },
  signIn: { marginTop: 16, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#7C3AED' },
  signInText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  heroValue: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flexGrow: 1,
    flexBasis: 148,
    minWidth: 148,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  panel: { borderRadius: 18, borderWidth: 1, padding: 20 },
  panelTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  quote: { fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  meta: { fontSize: 12, marginTop: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  tagText: { fontSize: 12, fontWeight: '700' },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  catName: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize', flex: 1 },
  catCount: { fontSize: 14 },
  closing: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  closingText: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
