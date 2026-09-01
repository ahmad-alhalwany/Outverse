import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Linking,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { api } from '@/api/client';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

type CreatorSummary = {
  total_content?: number;
  total_posts?: number;
  total_signals?: number;
  total_ideas?: number;
  total_views?: number;
  total_likes?: number;
  total_comments?: number;
  total_shares?: number;
  total_reposts?: number;
  total_reactions?: number;
};

type AnalyticsBreakdown = Record<string, number>;

type VodItem = {
  id: number | string;
  title?: string;
  recording_url?: string;
  ended_at?: string | null;
  current_viewers?: number;
  peak_viewers?: number;
  user?: { username?: string };
};

type CreatorTier = {
  id: number | string;
  name: string;
  description?: string;
  price_usd?: number;
  price_usd_cents?: number;
  benefits?: string[];
  is_active?: boolean;
};

type ScheduledPost = {
  id: number | string;
  publish_at?: string;
  status?: string;
  payload?: { text?: string };
  text?: string;
};

export default function CreatorStudioScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<CreatorSummary>({});
  const [reactionsByType, setReactionsByType] = useState<AnalyticsBreakdown>({});
  const [sharesByChannel, setSharesByChannel] = useState<AnalyticsBreakdown>({});
  const [topContent, setTopContent] = useState<Array<Record<string, any>>>([]);
  const [vods, setVods] = useState<VodItem[]>([]);
  const [daily, setDaily] = useState<Array<{ day: string; count: number }>>([]);
  const [tiers, setTiers] = useState<CreatorTier[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [tierName, setTierName] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [tierDescription, setTierDescription] = useState('');
  const [tierBusy, setTierBusy] = useState(false);
  const [selectedVod, setSelectedVod] = useState<VodItem | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const [analytics, vodRows, tierRows, scheduledRows] = await Promise.all([
        api.getCreatorAnalytics(),
        api.getLiveVods({ mine: true, limit: 30 }),
        api.getMyCreatorTiers().catch(() => []),
        api.getScheduledPosts().catch(() => []),
      ]);
      setSummary(analytics?.summary || {});
      setReactionsByType(analytics?.reactions_by_type || {});
      setSharesByChannel(analytics?.shares_by_channel || {});
      setTopContent(Array.isArray(analytics?.top_content) ? analytics.top_content : []);
      const trend = Array.isArray(analytics?.engagement_trend) ? analytics.engagement_trend : [];
      setDaily(
        trend.map((d: { day?: string; shares?: number; reactions?: number }) => ({
          day: d.day || '',
          count: (d.shares || 0) + (d.reactions || 0),
        })),
      );
      setVods(Array.isArray(vodRows) ? vodRows : []);
      setTiers(Array.isArray(tierRows) ? (tierRows as CreatorTier[]) : []);
      setScheduledPosts(
        (Array.isArray(scheduledRows) ? scheduledRows : [])
          .filter((post: ScheduledPost) => !post.status || post.status === 'pending'),
      );
    } catch (e) {
      console.error('Creator studio load failed', e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  const resetTierForm = () => {
    setTierName('');
    setTierPrice('');
    setTierDescription('');
  };

  const createTier = async () => {
    const price = Number.parseFloat(tierPrice);
    if (!tierName.trim() || !Number.isFinite(price) || price < 1) {
      Alert.alert(t('mobile.creatorTiers'), t('mobile.tierDetails'));
      return;
    }
    setTierBusy(true);
    try {
      const created = await api.createCreatorTier({
        name: tierName.trim(),
        price_usd_cents: Math.round(price * 100),
        description: tierDescription.trim(),
        is_active: true,
      });
      setTiers((prev) => [...prev, created as CreatorTier]);
      resetTierForm();
    } catch (e) {
      console.error('Create tier failed', e);
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotCreateTier'));
    } finally {
      setTierBusy(false);
    }
  };

  const updateTier = async (tier: CreatorTier, patch: Partial<CreatorTier>) => {
    setTierBusy(true);
    try {
      const updated = await api.updateCreatorTier(tier.id, patch);
      setTiers((prev) => prev.map((item) => (item.id === tier.id ? (updated as CreatorTier) : item)));
    } catch (e) {
      console.error('Update tier failed', e);
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotUpdateTier'));
    } finally {
      setTierBusy(false);
    }
  };

  const deleteTier = async (tier: CreatorTier) => {
    setTierBusy(true);
    try {
      await api.deleteCreatorTier(tier.id);
      setTiers((prev) => prev.filter((item) => item.id !== tier.id));
    } catch (e) {
      console.error('Delete tier failed', e);
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotDeleteTier'));
    } finally {
      setTierBusy(false);
    }
  };

  const cancelScheduled = async (post: ScheduledPost) => {
    try {
      await api.cancelScheduledPost(post.id);
      setScheduledPosts((prev) => prev.filter((item) => String(item.id) !== String(post.id)));
    } catch {
      Alert.alert(t('mobile.errorTitle'), t('mobile.couldNotCancelScheduled'));
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <WorldBackdrop>
      <SafeAreaView style={styles.safe}>
        <WorldHeader title={t('mobile.creatorStudioTitle')} subtitle={t('mobile.creatorStudioSub')} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
      </WorldBackdrop>
    );
  }

  const cards: Array<{ label: string; value: number | string }> = [
    { label: t('mobile.views'), value: summary.total_views ?? 0 },
    { label: t('mobile.likes'), value: summary.total_likes ?? 0 },
    { label: t('mobile.commentsCount'), value: summary.total_comments ?? 0 },
    { label: t('mobile.shares'), value: summary.total_shares ?? 0 },
    { label: t('mobile.posts'), value: summary.total_posts ?? 0 },
    { label: t('mobile.pulses'), value: summary.total_signals ?? 0 },
  ];
  const reactionEntries = Object.entries(reactionsByType).filter(([, count]) => Number(count) > 0);
  const shareEntries = Object.entries(sharesByChannel).filter(([, count]) => Number(count) > 0);

  return (
    <WorldBackdrop>
    <SafeAreaView style={styles.safe}>
      <WorldHeader title={t('mobile.creatorStudioTitle')} subtitle={t('mobile.creatorStudioSub')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.quickLinks}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Videos')}
            style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.linkTitle, { color: colors.text }]}>{t('nav.videos')}</Text>
            <Text style={[styles.linkMeta, { color: colors.textSecondary }]}>{t('mobile.uploadAndPremiere')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Playlists')}
            style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.linkTitle, { color: colors.text }]}>{t('nav.playlists')}</Text>
            <Text style={[styles.linkMeta, { color: colors.textSecondary }]}>{t('mobile.curateVideoSets')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('Experience')}
            style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.linkTitle, { color: colors.text }]}>{t('profile.experienceTitle')}</Text>
            <Text style={[styles.linkMeta, { color: colors.textSecondary }]}>{t('mobile.profileTimeline')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void load(true)}
            style={[styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.linkTitle, { color: colors.text }]}>{t('mobile.refreshStats')}</Text>
            <Text style={[styles.linkMeta, { color: colors.textSecondary }]}>{t('mobile.refreshMetrics')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.section, { color: colors.text }]}>{t('nav.analytics')}</Text>
        <View style={styles.grid}>
          {cards.map((c) => (
            <View key={c.label} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardValue, { color: colors.text }]}>{c.value}</Text>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{c.label}</Text>
            </View>
          ))}
        </View>

        {reactionEntries.length || shareEntries.length ? (
          <View style={[styles.breakdownCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {reactionEntries.length ? (
              <>
                <Text style={[styles.breakdownTitle, { color: colors.text }]}>{t('mobile.reactionsLabel')}</Text>
                <View style={styles.chipList}>
                  {reactionEntries.map(([type, count]) => (
                    <View key={type} style={[styles.metricChip, { borderColor: colors.border }]}>
                      <Text style={[styles.metricChipText, { color: colors.text }]}>
                        {type}: {count}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            {shareEntries.length ? (
              <>
                <Text style={[styles.breakdownTitle, { color: colors.text }]}>{t('mobile.sharesByChannel')}</Text>
                <View style={styles.chipList}>
                  {shareEntries.map(([channel, count]) => (
                    <View key={channel} style={[styles.metricChip, { borderColor: colors.border }]}>
                      <Text style={[styles.metricChipText, { color: colors.text }]}>
                        {channel}: {count}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        ) : null}

        {daily.length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.text }]}>{t('mobile.engagement7days')}</Text>
            <View style={[styles.barWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {daily.map((d) => {
                const max = Math.max(...daily.map((x) => x.count), 1);
                return (
                  <View key={d.day} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: 8 + (d.count / max) * 56,
                          backgroundColor: colors.primary,
                        },
                      ]}
                    />
                    <Text style={[styles.barLabel, { color: colors.textSecondary }]}>{d.day}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={[styles.section, { color: colors.text }]}>Top content</Text>
        {topContent.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No top content yet.</Text>
        ) : (
          topContent.slice(0, 6).map((item) => (
            <View
              key={`${item.type}-${item.id}`}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.title || `${item.type} #${item.id}`}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {item.type || t('mobile.posts')} · {item.views ?? 0} {t('mobile.views')} · {item.likes ?? item.reactions ?? 0} {t('mobile.likes')}
                  {item.comments != null ? ` · ${item.comments} ${t('mobile.commentsCount')}` : ''}
                  {item.shares != null ? ` · ${item.shares} ${t('mobile.shares')}` : ''}
                </Text>
                {item.created_at || item.published_at || item.status ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {item.status ? `${item.status} · ` : ''}
                    {item.created_at || item.published_at ? new Date(item.created_at || item.published_at).toLocaleDateString() : ''}
                  </Text>
                ) : null}
                {item.excerpt || item.text || item.description ? (
                  <Text style={{ color: colors.text, fontSize: 12, marginTop: 5 }} numberOfLines={2}>
                    {item.excerpt || item.text || item.description}
                  </Text>
                ) : null}
                {item.reactions_by_type ? (
                  <View style={[styles.chipList, { marginTop: 8 }]}>
                    {Object.entries(item.reactions_by_type as AnalyticsBreakdown).slice(0, 4).map(([type, count]) => (
                      <View key={type} style={[styles.metricChip, { borderColor: colors.border }]}>
                        <Text style={[styles.metricChipText, { color: colors.textSecondary }]}>
                          {type}: {count}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}

        <Text style={[styles.section, { color: colors.text }]}>{t('mobile.creatorTiers')}</Text>
        <View style={[styles.tierForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={tierName}
            onChangeText={setTierName}
            placeholder={t('mobile.tierName')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={tierPrice}
            onChangeText={setTierPrice}
            placeholder={t('mobile.priceUsd')}
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={tierDescription}
            onChangeText={setTierDescription}
            placeholder={t('profile.experienceFieldDescription')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <TouchableOpacity
            disabled={tierBusy || !tierName.trim() || !tierPrice.trim()}
            onPress={() => void createTier()}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: tierBusy || !tierName.trim() || !tierPrice.trim() ? 0.5 : 1 }]}
          >
            <Text style={styles.primaryBtnText}>{tierBusy ? '…' : t('mobile.createTier')}</Text>
          </TouchableOpacity>
        </View>
        {tiers.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>{t('mobile.noTiersYet')}</Text>
        ) : (
          tiers.map((tier) => (
            <View key={String(tier.id)} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {tier.name} · ${Number(tier.price_usd ?? (tier.price_usd_cents || 0) / 100).toFixed(2)}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={2}>
                  {tier.description || tier.benefits?.join(' · ') || t('mobile.noDescription')}
                </Text>
              </View>
              <TouchableOpacity
                disabled={tierBusy}
                onPress={() => void updateTier(tier, { is_active: !tier.is_active })}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {tier.is_active === false ? t('mobile.activate') : t('mobile.pause')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={tierBusy} onPress={() => void deleteTier(tier)}>
                <Text style={{ color: '#dc2626', fontWeight: '700' }}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: colors.text, marginBottom: 0 }]}>{t('mobile.scheduledPosts')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignalPublish')}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('live.create')}</Text>
          </TouchableOpacity>
        </View>
        {scheduledPosts.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>{t('mobile.noPendingScheduled')}</Text>
        ) : (
          scheduledPosts.slice(0, 5).map((post) => (
            <View key={String(post.id)} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {post.payload?.text || post.text || t('mobile.scheduledPostN', { id: post.id })}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {post.publish_at ? new Date(post.publish_at).toLocaleString() : t('mobile.pending')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => void cancelScheduled(post)}>
                <Text style={{ color: '#dc2626', fontWeight: '700' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: colors.text, marginBottom: 0 }]}>{t('mobile.vodLibrary')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Live')}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('live.goLive')}</Text>
          </TouchableOpacity>
        </View>
        {vods.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>
            {t('mobile.vodEmpty')}
          </Text>
        ) : (
          vods.map((v) => (
            <TouchableOpacity
              key={String(v.id)}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => {
                if (v.recording_url) setSelectedVod(v);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {v.title || t('mobile.liveN', { id: v.id })}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {v.ended_at ? new Date(v.ended_at).toLocaleString() : t('mobile.recording')}
                  {v.peak_viewers != null ? ` · ${t('mobile.peakViewersCount', { count: v.peak_viewers })}` : ''}
                </Text>
              </View>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('mobile.play')}</Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
      <Modal visible={!!selectedVod} animationType="slide" onRequestClose={() => setSelectedVod(null)}>
        <SafeAreaView style={[styles.safe, { backgroundColor: '#000' }]}>
          <View style={styles.playerHeader}>
            <TouchableOpacity onPress={() => setSelectedVod(null)}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{t('common.close')}</Text>
            </TouchableOpacity>
            {selectedVod?.recording_url ? (
              <TouchableOpacity onPress={() => void Linking.openURL(selectedVod.recording_url!)}>
                <Text style={{ color: '#A78BFA', fontWeight: '800' }}>{t('mobile.openExternally')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {selectedVod?.recording_url ? (
            <Video
              source={{ uri: selectedVod.recording_url }}
              controls
              resizeMode="contain"
              style={styles.videoPlayer}
            />
          ) : (
            <View style={styles.center}>
              <Text style={{ color: '#fff' }}>{t('mobile.recordingUnavailable')}</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40, gap: 10 },
  quickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  linkCard: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderWidth: 1, borderRadius: 14, padding: 12 },
  linkTitle: { fontSize: 15, fontWeight: '800' },
  linkMeta: { fontSize: 12, marginTop: 3 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 8, marginBottom: 4 },
  sectionRow: {
    marginTop: 12,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '31%',
    minWidth: 96,
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  cardValue: { fontSize: 18, fontWeight: '800' },
  cardLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowTitle: { fontWeight: '700', fontSize: 14 },
  breakdownCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  breakdownTitle: { fontSize: 13, fontWeight: '800' },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metricChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  metricChipText: { fontSize: 12, fontWeight: '700' },
  tierForm: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  primaryBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  videoPlayer: { flex: 1, backgroundColor: '#000' },
  barWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    height: 100,
    marginBottom: 8,
  },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 14, borderRadius: 6 },
  barLabel: { fontSize: 10, marginTop: 4, fontWeight: '600' },
});
