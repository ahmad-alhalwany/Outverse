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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  MOOD_EMOJI,
  asCreatorAnalytics,
  asPersonalAnalytics,
  useAnalyticsPalette,
  type CreatorAnalytics,
  type PersonalAnalytics,
} from '@/lib/analytics';
import { CreatorDashboard } from './analyticsParts';

export default function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const C = useAnalyticsPalette(isDark);
  const { t, isRTL } = useLocale();

  const [personal, setPersonal] = useState<PersonalAnalytics | null>(null);
  const [creator, setCreator] = useState<CreatorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!isAuthenticated) {
      setPersonal(null);
      setCreator(null);
      setError(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const [me, creatorData] = await Promise.all([
        api.getMeAnalytics(),
        api.getCreatorAnalytics().catch(() => null),
      ]);
      const nextPersonal = asPersonalAnalytics(me);
      setPersonal(nextPersonal);
      setCreator(asCreatorAnalytics(creatorData));
      if (!nextPersonal) setError(true);
    } catch {
      setPersonal(null);
      setCreator(null);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const maxActivity = personal
    ? Math.max(1, ...personal.weekly_activity.map((day) => day.total))
    : 1;
  const genres = personal ? Object.entries(personal.story_genre_breakdown) : [];

  const openItem = (type: 'post' | 'reel' | 'idea', id: number) => {
    if (type === 'post') navigation.navigate('PostDetail', { postId: id });
    else if (type === 'idea') navigation.navigate('BazaarDetail', { ideaId: id });
    else navigation.navigate('Reels', { reelId: id });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
          ) : undefined
        }
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
          <Text style={[styles.backText, { color: C.text2 }]}>{t('common.back')}</Text>
        </Pressable>

        <Text style={[styles.title, { color: C.brown }]}>{t('analytics.title')}</Text>
        <Text style={[styles.subtitle, { color: C.text2 }]}>{t('analytics.subtitle')}</Text>

        {!isAuthenticated ? (
          <View style={[styles.empty, { backgroundColor: C.card2 }]}>
            <Text style={[styles.emptyText, { color: C.text2 }]}>{t('analytics.signInPrompt')}</Text>
            <Pressable onPress={() => navigation.navigate('Login')} style={[styles.signIn, { backgroundColor: C.brownDk }]}>
              <Text style={styles.signInText}>{t('auth.signIn')}</Text>
            </Pressable>
          </View>
        ) : loading && !personal ? (
          <Text style={[styles.emptyText, { color: C.text2, marginTop: 28 }]}>{t('common.loading')}</Text>
        ) : error && !personal ? (
          <View style={[styles.empty, { backgroundColor: C.card2 }]}>
            <Text style={[styles.emptyText, { color: C.text2 }]}>{t('analytics.error')}</Text>
            <Pressable onPress={() => void load()} style={[styles.signIn, { backgroundColor: C.brownDk }]}>
              <Text style={styles.signInText}>{t('common.tryAgain')}</Text>
            </Pressable>
          </View>
        ) : personal ? (
          <>
            <CreatorDashboard
              data={creator}
              C={C}
              t={t}
              loading={loading}
              onOpenBazaar={() => navigation.navigate('Bazaar')}
              onOpenInspiration={() => navigation.navigate('InspirationHistory')}
              onOpenItem={openItem}
            />

            <View style={[styles.score, { backgroundColor: C.card, borderColor: C.line }]}>
              <View style={styles.scoreHead}>
                <Text style={[styles.scoreLabel, { color: C.brownDk }]}>{t('analytics.creativityScore')}</Text>
                <Ionicons name="sparkles-outline" size={18} color={C.brownDk} />
              </View>
              <Text style={[styles.scoreValue, { color: C.text }]}>{personal.creativity_score}</Text>
              <View style={[styles.track, { backgroundColor: C.barBg }]}>
                <View
                  style={[
                    styles.fill,
                    { width: `${Math.min(100, personal.creativity_score)}%`, backgroundColor: C.brownDk },
                  ]}
                />
              </View>
            </View>

            <View style={styles.stats}>
              {[
                { label: t('analytics.completionRate'), value: `${personal.completion_rate}%` },
                { label: t('analytics.bottlesCaught'), value: personal.bottles_caught },
                { label: t('analytics.storiesCount'), value: personal.stories_count },
              ].map((stat) => (
                <View key={stat.label} style={[styles.stat, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.statValue, { color: C.brown }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: C.text2 }]}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
              <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.weeklyActivity')}</Text>
              <View style={styles.week}>
                {personal.weekly_activity.map((day, index) => (
                  <View key={day.date || index} style={styles.weekCol}>
                    <View
                      style={[
                        styles.weekBar,
                        {
                          height: Math.max(4, (day.total / maxActivity) * 80),
                          backgroundColor: C.brownDk,
                        },
                      ]}
                    />
                    <Text style={[styles.weekLabel, { color: C.text2 }]}>{day.day}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
              <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.moodPatterns')}</Text>
              <View style={styles.moods}>
                {personal.mood_calendar.map((cell, index) => (
                  <View key={cell.date || index} style={[styles.mood, { backgroundColor: C.barBg }]}>
                    <Text style={[styles.moodText, { color: C.text2 }]}>
                      {cell.dominant ? MOOD_EMOJI[cell.dominant] || String(cell.day) : String(cell.day)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.banner, { backgroundColor: C.bannerBg }]}>
              <Ionicons name="trending-up-outline" size={22} color={C.brownDk} />
              <Text style={[styles.bannerText, { color: C.text }]}>
                {t('analytics.aboveAverage', { pct: personal.above_average_pct })}
              </Text>
            </View>

            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
              <View style={styles.sectionHead}>
                <Ionicons name="book-outline" size={16} color={C.brown} />
                <Text style={[styles.panelTitle, { color: C.text, marginBottom: 0 }]}>{t('analytics.yourStories')}</Text>
              </View>
              {genres.length === 0 ? (
                <Text style={[styles.emptyText, { color: C.text2, marginTop: 10 }]}>{t('analytics.noStories')}</Text>
              ) : (
                <View style={styles.chips}>
                  {genres.map(([genre, count]) => (
                    <Text key={genre} style={[styles.chip, { backgroundColor: C.card2, color: C.brownDk }]}>
                      {genre} · {count}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start' },
  backText: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, lineHeight: 21, marginBottom: 20 },
  empty: { borderRadius: 18, padding: 28, alignItems: 'center' },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  signIn: { marginTop: 14, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  signInText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  score: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 12 },
  scoreHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreLabel: { fontSize: 14, fontWeight: '700' },
  scoreValue: { fontSize: 40, fontWeight: '800', marginTop: 6 },
  track: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 999 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, borderRadius: 16, borderWidth: 1, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 4, textAlign: 'center' },
  panel: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  panelTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  week: { flexDirection: 'row', alignItems: 'flex-end', height: 104, gap: 6 },
  weekCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  weekBar: { width: '80%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  weekLabel: { fontSize: 10 },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mood: {
    width: '12.5%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodText: { fontSize: 11 },
  banner: { borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
});
