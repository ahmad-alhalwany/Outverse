import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useShopPalette } from '@/lib/shop';

const NAV: Array<{
  kind:
    | 'dashboard'
    | 'analytics'
    | 'posts'
    | 'forge'
    | 'broadcast'
    | 'users'
    | 'bazaar'
    | 'vault'
    | 'shop'
    | 'ads'
    | 'reels'
    | 'lab'
    | 'achievements'
    | 'moderation'
    | 'verification'
    | 'seller'
    | 'chat'
    | 'health'
    | 'audit'
    | 'marketing';
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { kind: 'dashboard', labelKey: 'admin.navDashboard', icon: 'home-outline' },
  { kind: 'posts', labelKey: 'admin.navPosts', icon: 'document-text-outline' },
  { kind: 'forge', labelKey: 'admin.navForge', icon: 'create-outline' },
  { kind: 'broadcast', labelKey: 'admin.navBroadcast', icon: 'megaphone-outline' },
  { kind: 'analytics', labelKey: 'admin.navAnalytics', icon: 'stats-chart-outline' },
  { kind: 'users', labelKey: 'admin.navUsers', icon: 'people-outline' },
  { kind: 'bazaar', labelKey: 'admin.navBazaar', icon: 'bulb-outline' },
  { kind: 'vault', labelKey: 'admin.navVault', icon: 'wine-outline' },
  { kind: 'shop', labelKey: 'admin.navShop', icon: 'bag-handle-outline' },
  { kind: 'ads', labelKey: 'admin.navAds', icon: 'radio-outline' },
  { kind: 'reels', labelKey: 'admin.navReels', icon: 'videocam-outline' },
  { kind: 'lab', labelKey: 'admin.navLab', icon: 'flask-outline' },
  { kind: 'achievements', labelKey: 'admin.navAchievements', icon: 'trophy-outline' },
  { kind: 'moderation', labelKey: 'admin.navModeration', icon: 'flag-outline' },
  { kind: 'verification', labelKey: 'admin.navVerification', icon: 'checkmark-circle-outline' },
  { kind: 'seller', labelKey: 'admin.navSellerApplications', icon: 'storefront-outline' },
  { kind: 'chat', labelKey: 'admin.navChat', icon: 'chatbubbles-outline' },
  { kind: 'health', labelKey: 'admin.navHealth', icon: 'pulse-outline' },
  { kind: 'audit', labelKey: 'admin.navAudit', icon: 'reader-outline' },
  { kind: 'marketing', labelKey: 'mobile.navMarketing', icon: 'mail-outline' },
];

type Dashboard = {
  counts: Record<string, number>;
  shop: Record<string, number>;
  weekly_activity: { day: string; total: number }[];
  mood_calendar: { day: number; date: string; dominant: string; total: number }[];
  completion_rate: number;
  recent_flags: { id: number; type: string; content: string; status: string }[];
  top_supporters: { id: number; points: number; user__username: string }[];
};

function asDashboard(data: unknown): Dashboard | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const counts = (obj.counts && typeof obj.counts === 'object' ? obj.counts : {}) as Record<string, number>;
  const shop = (obj.shop && typeof obj.shop === 'object' ? obj.shop : {}) as Record<string, number>;
  return {
    counts,
    shop,
    weekly_activity: Array.isArray(obj.weekly_activity)
      ? obj.weekly_activity.map((row) => {
          const item = (row || {}) as Record<string, unknown>;
          return { day: String(item.day || ''), total: Number(item.total || 0) };
        })
      : [],
    mood_calendar: Array.isArray(obj.mood_calendar)
      ? obj.mood_calendar.map((row) => {
          const item = (row || {}) as Record<string, unknown>;
          return {
            day: Number(item.day || 0),
            date: String(item.date || ''),
            dominant: String(item.dominant || ''),
            total: Number(item.total || 0),
          };
        })
      : [],
    completion_rate: Number(obj.completion_rate || 0),
    recent_flags: Array.isArray(obj.recent_flags)
      ? obj.recent_flags.map((row) => {
          const item = (row || {}) as Record<string, unknown>;
          return {
            id: Number(item.id || 0),
            type: String(item.type || ''),
            content: String(item.content || ''),
            status: String(item.status || ''),
          };
        })
      : [],
    top_supporters: Array.isArray(obj.top_supporters)
      ? obj.top_supporters.map((row) => {
          const item = (row || {}) as Record<string, unknown>;
          return {
            id: Number(item.id || 0),
            points: Number(item.points || 0),
            user__username: String(item.user__username || ''),
          };
        })
      : [],
  };
}

export default function AdminScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t, isRTL } = useLocale();
  const staff = !!user?.is_staff;

  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!staff) return;
    if (refresh) setRefreshing(true);
    setError('');
    try {
      const next = asDashboard(await api.request('get', '/analytics/dashboard/'));
      setData(next);
      if (!next) setError(t('common.actionFailed'));
    } catch {
      setError(t('admin.staffRequired'));
    } finally {
      setRefreshing(false);
    }
  }, [staff, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const maxWeek = Math.max(1, ...(data?.weekly_activity || []).map((d) => d.total));
  const moodActive = data?.mood_calendar.filter((c) => c.total > 0).length || 0;

  const open = (kind: (typeof NAV)[number]['kind']) => {
    if (kind === 'ads') {
      navigation.navigate('Ads');
      return;
    }
    if (kind === 'marketing') {
      navigation.navigate('AdminMarketing');
      return;
    }
    navigation.navigate('AdminSection', { kind, title: t(NAV.find((n) => n.kind === kind)?.labelKey || 'admin.panelTitle') });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
          <Text style={[styles.backText, { color: C.text2 }]}>{t('common.back')}</Text>
        </Pressable>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: C.text }]}>{t('admin.commandTitle')}</Text>
            <Text style={[styles.subtitle, { color: C.text2 }]}>{t('admin.commandSubtitle')}</Text>
          </View>
          <Pressable onPress={() => void load(true)} style={[styles.refresh, { backgroundColor: C.card }]}>
            <Text style={{ color: C.brownDk, fontWeight: '700', fontSize: 12 }}>{t('admin.refresh')}</Text>
          </Pressable>
        </View>
        <Text style={[styles.meta, { color: C.text2 }]}>
          {t('admin.signedInAs')} @{user?.username || 'staff'}
        </Text>
        {!staff ? (
          <Text style={styles.error}>{t('admin.staffRequired')}</Text>
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {data ? (
              <>
                <View style={styles.kpis}>
                  {[
                    { label: t('admin.activeUsers'), value: data.counts.active_users || 0, delta: `${data.counts.users || 0} ${t('admin.total')}` },
                    {
                      label: t('admin.pendingReports'),
                      value: data.counts.pending_flags || 0,
                      delta: (data.counts.pending_flags || 0) > 0 ? t('admin.needsReview') : t('admin.allClear'),
                    },
                    { label: t('admin.ordersToday'), value: data.shop.orders_today || 0, delta: `${data.shop.revenue_today || 0} Nova` },
                    { label: t('admin.completionRate'), value: `${data.completion_rate}%`, delta: t('admin.labChallenges') },
                    { label: t('admin.signals'), value: data.counts.reels || 0 },
                    { label: t('admin.shopProducts'), value: data.shop.active_products || 0, delta: `${data.shop.featured_products || 0} ${t('admin.featured')}` },
                  ].map((kpi) => (
                    <View key={kpi.label} style={[styles.kpi, { backgroundColor: C.white, borderColor: C.line }]}>
                      <Text style={[styles.kpiLabel, { color: C.text2 }]}>{kpi.label}</Text>
                      <Text style={[styles.kpiValue, { color: C.text }]}>{kpi.value}</Text>
                      {kpi.delta ? <Text style={[styles.kpiDelta, { color: C.brown }]}>{kpi.delta}</Text> : null}
                    </View>
                  ))}
                </View>

                <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.panelTitle, { color: C.text }]}>{t('admin.weeklyActivity')}</Text>
                  <View style={styles.bars}>
                    {data.weekly_activity.map((day, index) => (
                      <View key={day.day || index} style={styles.barCol}>
                        <View style={[styles.bar, { height: Math.max(4, (day.total / maxWeek) * 80), backgroundColor: C.brownDk }]} />
                        <Text style={[styles.barLabel, { color: C.text2 }]}>{day.day}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.panelTitle, { color: C.text }]}>{t('admin.moodHeatmap')}</Text>
                  <View style={styles.moods}>
                    {data.mood_calendar.map((cell) => (
                      <View key={cell.date} style={[styles.mood, { backgroundColor: cell.total > 0 ? C.card : C.card2 }]}>
                        <Text style={[styles.moodDay, { color: C.text2 }]}>{cell.day}</Text>
                        <Text>{cell.total > 0 ? '🙂' : '·'}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.meta, { color: C.text2 }]}>{t('admin.activeMoodDays', { count: moodActive })}</Text>
                </View>

                <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
                  <View style={styles.panelHead}>
                    <Text style={[styles.panelTitle, { color: C.text, marginBottom: 0 }]}>{t('admin.recentReports')}</Text>
                    <Pressable onPress={() => open('moderation')}>
                      <Text style={{ color: C.brown, fontWeight: '700', fontSize: 12 }}>{t('admin.viewAll')}</Text>
                    </Pressable>
                  </View>
                  {data.recent_flags.length === 0 ? (
                    <Text style={[styles.meta, { color: C.text2 }]}>{t('admin.noReports')}</Text>
                  ) : (
                    data.recent_flags.slice(0, 6).map((flag) => (
                      <View key={flag.id} style={styles.flagRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={[styles.flagType, { color: C.text }]}>{flag.type}</Text>
                          <Text style={[styles.meta, { color: C.text2 }]} numberOfLines={1}>{flag.content}</Text>
                        </View>
                        <Text style={[styles.status, { color: C.brownDk }]}>{flag.status}</Text>
                      </View>
                    ))
                  )}
                </View>

                <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.panelTitle, { color: C.text }]}>{t('admin.topSupporters')}</Text>
                  {data.top_supporters.map((row) => (
                    <View key={row.id} style={styles.flagRow}>
                      <Text style={[styles.flagType, { color: C.text }]}>@{row.user__username}</Text>
                      <Text style={{ color: C.brown, fontWeight: '800' }}>{row.points} pts</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={[styles.meta, { color: C.text2 }]}>{t('common.loading')}</Text>
            )}

            <Text style={[styles.navTitle, { color: C.text }]}>{t('admin.panelTitle')}</Text>
            <View style={styles.grid}>
              {NAV.map((item) => (
                <Pressable
                  key={item.kind}
                  onPress={() => open(item.kind)}
                  style={[styles.cell, { backgroundColor: C.white, borderColor: C.line }]}
                >
                  <Ionicons name={item.icon} size={22} color={C.brownDk} />
                  <Text style={[styles.label, { color: C.text }]}>{t(item.labelKey)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 14, fontWeight: '600' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  refresh: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  meta: { fontSize: 12, marginTop: 8 },
  error: { color: '#ef4444', marginVertical: 10 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  kpi: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderRadius: 16, borderWidth: 1, padding: 12 },
  kpiLabel: { fontSize: 11 },
  kpiValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  kpiDelta: { fontSize: 11, marginTop: 4 },
  panel: { borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 12 },
  panelTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { fontSize: 10 },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  mood: { width: '13%', aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moodDay: { fontSize: 9 },
  flagRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 10 },
  flagType: { fontSize: 13, fontWeight: '700' },
  status: { fontSize: 11, fontWeight: '700' },
  navTitle: { fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderRadius: 16, borderWidth: 1, paddingVertical: 16, alignItems: 'center', gap: 8 },
  icon: { fontSize: 22 },
  label: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
