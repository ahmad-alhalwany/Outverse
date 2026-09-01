import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useShopPalette } from '@/lib/shop';

type Campaign = {
  id: number;
  name: string;
  status: string;
  spent: string;
  lifetime_budget: string;
};

type Summary = {
  total_spent: number;
  total_impressions: number;
  total_clicks: number;
  overall_ctr: number;
};

const OBJECTIVES = ['awareness', 'traffic', 'engagement', 'conversions', 'app_installs'] as const;
const BIDS = ['cpm', 'cpc', 'cpa'] as const;
const PLACEMENTS = ['feed', 'stories', 'reels', 'explore', 'profile'] as const;

const STATUS_KEYS: Record<string, string> = {
  draft: 'ads.statusDraft',
  pending_review: 'ads.statusPendingReview',
  active: 'ads.statusActive',
  paused: 'ads.statusPaused',
  completed: 'ads.statusCompleted',
  rejected: 'ads.statusRejected',
  disapproved: 'ads.statusDisapproved',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8',
  pending_review: '#f59e0b',
  active: '#22c55e',
  paused: '#f59e0b',
  completed: '#94a3b8',
  rejected: '#ef4444',
  disapproved: '#ef4444',
};

function asCampaigns(data: unknown): Campaign[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows
    .map((row) => {
      const item = (row || {}) as Record<string, unknown>;
      const id = Number(item.id);
      if (!id) return null;
      return {
        id,
        name: String(item.name || ''),
        status: String(item.status || 'draft'),
        spent: String(item.spent || '0'),
        lifetime_budget: String(item.lifetime_budget || '0'),
      };
    })
    .filter((row): row is Campaign => Boolean(row));
}

export default function AdsScreen() {
  const navigation = useNavigation<any>();
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t, isRTL } = useLocale();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState('traffic');
  const [bid, setBid] = useState('cpm');
  const [daily, setDaily] = useState('10.00');
  const [lifetime, setLifetime] = useState('100.00');
  const [placements, setPlacements] = useState<string[]>(['feed']);

  const load = useCallback(async (refresh = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [list, report] = await Promise.all([
        api.getAdCampaigns(),
        api.getAdReports().catch(() => null),
      ]);
      setCampaigns(asCampaigns(list));
      const rec = report && typeof report === 'object' ? (report as Record<string, unknown>) : null;
      setSummary(
        rec
          ? {
              total_spent: Number(rec.total_spent || 0),
              total_impressions: Number(rec.total_impressions || 0),
              total_clicks: Number(rec.total_clicks || 0),
              overall_ctr: Number(rec.overall_ctr || 0),
            }
          : null,
      );
    } catch {
      setCampaigns([]);
      setSummary(null);
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

  const create = async () => {
    if (!name.trim()) {
      setError(t('ads.createError'));
      return;
    }
    setCreating(true);
    setError('');
    try {
      await api.createAdCampaign({
        name: name.trim(),
        objective,
        bid_strategy: bid,
        daily_budget: daily,
        lifetime_budget: lifetime,
        start_date: new Date().toISOString(),
        targeting: { placements },
      });
      setShowForm(false);
      setName('');
      await load(true);
    } catch {
      setError(t('ads.createError'));
    } finally {
      setCreating(false);
    }
  };

  const objLabel = useMemo(
    () => ({
      awareness: t('ads.objAwareness'),
      traffic: t('ads.objTraffic'),
      engagement: t('ads.objEngagement'),
      conversions: t('ads.objConversions'),
      app_installs: t('ads.objAppInstalls'),
    }),
    [t],
  );
  const bidLabel = useMemo(
    () => ({
      cpm: t('ads.bidCpm'),
      cpc: t('ads.bidCpc'),
      cpa: t('ads.bidCpa'),
    }),
    [t],
  );
  const placeLabel = useMemo(
    () => ({
      feed: t('ads.placementFeed'),
      stories: t('ads.placementStories'),
      reels: t('ads.placementReels'),
      explore: t('ads.placementExplore'),
      profile: t('ads.placementProfile'),
    }),
    [t],
  );

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
          <Text style={[styles.backText, { color: C.text2 }]}>{t('ads.back')}</Text>
        </Pressable>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: C.text }]}>{t('ads.title')}</Text>
            <Text style={[styles.subtitle, { color: C.text2 }]}>{t('ads.subtitle')}</Text>
          </View>
          {isAuthenticated ? (
            <Pressable onPress={() => setShowForm((v) => !v)} style={[styles.add, { backgroundColor: C.brownDk }]}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addText}>{t('ads.newCampaign')}</Text>
            </Pressable>
          ) : null}
        </View>

        {!isAuthenticated ? (
          <View style={[styles.empty, { backgroundColor: C.card2 }]}>
            <Text style={[styles.emptyText, { color: C.text2 }]}>{t('ads.signInPrompt')}</Text>
          </View>
        ) : (
          <>
            {summary ? (
              <View style={styles.stats}>
                {[
                  { label: t('ads.totalSpend'), value: `$${summary.total_spent.toFixed(2)}` },
                  { label: t('ads.totalImpressions'), value: String(summary.total_impressions) },
                  { label: t('ads.totalClicks'), value: String(summary.total_clicks) },
                  { label: t('ads.overallCtr'), value: `${summary.overall_ctr}%` },
                ].map((stat) => (
                  <View key={stat.label} style={[styles.stat, { backgroundColor: C.white, borderColor: C.line }]}>
                    <Text style={[styles.statLabel, { color: C.text2 }]}>{stat.label}</Text>
                    <Text style={[styles.statValue, { color: C.text }]}>{stat.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {showForm ? (
              <View style={[styles.form, { backgroundColor: C.white, borderColor: C.line }]}>
                <Text style={[styles.formTitle, { color: C.text }]}>{t('ads.newCampaign')}</Text>
                <Text style={[styles.field, { color: C.text2 }]}>{t('ads.campaignName')}</Text>
                <TextInput value={name} onChangeText={setName} style={[styles.input, { color: C.text, borderColor: C.line }]} />
                <Text style={[styles.field, { color: C.text2 }]}>{t('ads.objective')}</Text>
                <View style={styles.chips}>
                  {OBJECTIVES.map((id) => (
                    <Pressable key={id} onPress={() => setObjective(id)} style={[styles.chip, { backgroundColor: objective === id ? C.brownDk : C.card2 }]}>
                      <Text style={{ color: objective === id ? '#fff' : C.brown, fontSize: 11, fontWeight: '700' }}>{objLabel[id]}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.field, { color: C.text2 }]}>{t('ads.bidStrategy')}</Text>
                <View style={styles.chips}>
                  {BIDS.map((id) => (
                    <Pressable key={id} onPress={() => setBid(id)} style={[styles.chip, { backgroundColor: bid === id ? C.brownDk : C.card2 }]}>
                      <Text style={{ color: bid === id ? '#fff' : C.brown, fontSize: 11, fontWeight: '700' }}>{bidLabel[id]}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.field, { color: C.text2 }]}>{t('ads.dailyBudget')}</Text>
                <TextInput value={daily} onChangeText={setDaily} keyboardType="decimal-pad" style={[styles.input, { color: C.text, borderColor: C.line }]} />
                <Text style={[styles.field, { color: C.text2 }]}>{t('ads.lifetimeBudget')}</Text>
                <TextInput value={lifetime} onChangeText={setLifetime} keyboardType="decimal-pad" style={[styles.input, { color: C.text, borderColor: C.line }]} />
                <Text style={[styles.field, { color: C.text2 }]}>{t('ads.placements')}</Text>
                <View style={styles.chips}>
                  {PLACEMENTS.map((id) => {
                    const active = placements.includes(id);
                    return (
                      <Pressable
                        key={id}
                        onPress={() =>
                          setPlacements((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
                        }
                        style={[styles.chip, { backgroundColor: active ? C.brownDk : C.card2 }]}
                      >
                        <Text style={{ color: active ? '#fff' : C.brown, fontSize: 11, fontWeight: '700' }}>{placeLabel[id]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.formActions}>
                  <Pressable onPress={() => { setShowForm(false); setError(''); }}>
                    <Text style={{ color: C.text2, fontWeight: '700' }}>{t('ads.cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={() => void create()} disabled={creating} style={[styles.add, { backgroundColor: C.brownDk }]}>
                    <Text style={styles.addText}>{creating ? t('ads.creating') : t('ads.create')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {loading && campaigns.length === 0 ? (
              <Text style={[styles.emptyText, { color: C.text2 }]}>{t('common.loading')}</Text>
            ) : campaigns.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Text style={[styles.emptyText, { color: C.text2 }]}>{t('ads.noCampaigns')}</Text>
              </View>
            ) : (
              campaigns.map((campaign) => {
                const spent = parseFloat(campaign.spent) || 0;
                const budget = parseFloat(campaign.lifetime_budget) || 1;
                const pct = Math.min(100, Math.round((spent / budget) * 100));
                const color = STATUS_COLORS[campaign.status] || '#94a3b8';
                return (
                  <View key={campaign.id} style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
                    <View style={styles.cardHead}>
                      <Ionicons name="megaphone-outline" size={18} color={C.brown} />
                      <Text style={[styles.cardTitle, { color: C.text }]} numberOfLines={1}>{campaign.name}</Text>
                      <Text style={[styles.status, { backgroundColor: `${color}22`, color }]}>
                        {t(STATUS_KEYS[campaign.status] || 'ads.statusDraft')}
                      </Text>
                    </View>
                    <View style={styles.budgetRow}>
                      <Text style={[styles.meta, { color: C.text2 }]}>{t('ads.spent')}: ${spent.toFixed(2)}</Text>
                      <Text style={[styles.meta, { color: C.text2 }]}>{t('ads.budget')}: ${budget.toFixed(2)}</Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: C.card2 }]}>
                      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: C.brown }]} />
                    </View>
                    <View style={styles.actions}>
                      {campaign.status === 'draft' ? (
                        <Pressable onPress={() => void api.activateAdCampaign(campaign.id).then(() => load(true))} style={[styles.action, { backgroundColor: C.brownDk }]}>
                          <Text style={styles.actionLight}>{t('ads.activate')}</Text>
                        </Pressable>
                      ) : campaign.status === 'paused' ? (
                        <Pressable onPress={() => void api.resumeAdCampaign(campaign.id).then(() => load(true))} style={[styles.action, { backgroundColor: C.brownDk }]}>
                          <Text style={styles.actionLight}>{t('ads.resume')}</Text>
                        </Pressable>
                      ) : campaign.status === 'active' ? (
                        <Pressable onPress={() => void api.pauseAdCampaign(campaign.id).then(() => load(true))} style={[styles.action, { borderColor: C.line, borderWidth: 1 }]}>
                          <Text style={{ color: C.brown, fontWeight: '700', fontSize: 12 }}>{t('ads.pause')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
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
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 18 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  add: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { borderRadius: 22, padding: 28, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  stat: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderRadius: 16, borderWidth: 1, padding: 12 },
  statLabel: { fontSize: 11 },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  form: { borderRadius: 22, borderWidth: 1, padding: 16, marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  field: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  error: { color: '#ef4444', marginTop: 10, fontSize: 13 },
  formActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  meta: { fontSize: 12 },
  track: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 999 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  actionLight: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
