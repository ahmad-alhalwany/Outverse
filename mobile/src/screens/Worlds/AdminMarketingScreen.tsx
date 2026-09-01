import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useShopPalette } from '@/lib/shop';

type Segment = 'all' | 'inactive_30d';
type Campaign = {
  id: number;
  subject: string;
  body_html: string;
  segment: Segment;
  status: 'draft' | 'sending' | 'sent';
  recipient_count: number;
  sent_at: string | null;
};

const EMPTY = { subject: '', body_html: '', segment: 'all' as Segment };

function unwrapCampaigns(data: unknown): Campaign[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results: unknown[] }).results
      : [];
  return rows
    .map((row) => {
      const c = (row || {}) as Partial<Campaign>;
      const id = Number(c.id);
      if (!id) return null;
      return {
        id,
        subject: String(c.subject || ''),
        body_html: String(c.body_html || ''),
        segment: c.segment === 'inactive_30d' ? 'inactive_30d' : 'all',
        status: c.status === 'sent' || c.status === 'sending' ? c.status : 'draft',
        recipient_count: Number(c.recipient_count || 0),
        sent_at: c.sent_at ? String(c.sent_at) : null,
      } satisfies Campaign;
    })
    .filter((row): row is Campaign => Boolean(row));
}

export default function AdminMarketingScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t, isRTL } = useLocale();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [previews, setPreviews] = useState<Record<number, number>>({});

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const rows = unwrapCampaigns(await api.request('get', '/notifications/marketing-campaigns/'));
      setCampaigns(rows);
    } catch {
      setCampaigns([]);
      setNotice(t('admin.staffRequired'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const save = async () => {
    if (!form.subject.trim() || !form.body_html.trim()) return;
    setBusyId('save');
    try {
      if (editId) {
        await api.request('patch', `/notifications/marketing-campaigns/${editId}/`, form);
        setNotice(t('mobile.campaignUpdated'));
      } else {
        await api.request('post', '/notifications/marketing-campaigns/', form);
        setNotice(t('mobile.campaignCreated'));
      }
      setEditId(null);
      setForm(EMPTY);
      await load(true);
    } catch {
      Alert.alert(t('mobile.navMarketing'), t('common.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const preview = async (id: number) => {
    setBusyId(`${id}-preview`);
    try {
      const data = await api.request<{ recipient_count?: number }>(
        'post',
        `/notifications/marketing-campaigns/${id}/preview/`,
      );
      setPreviews((prev) => ({ ...prev, [id]: Number(data?.recipient_count || 0) }));
    } catch {
      Alert.alert(t('mobile.navMarketing'), t('common.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const send = (campaign: Campaign) => {
    const count = previews[campaign.id];
    const note = count != null ? ` (${count})` : '';
    Alert.alert(t('mobile.sendCampaign'), `${campaign.subject}${note}`, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mobile.sendNow'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId(`${campaign.id}-send`);
            try {
              await api.request('post', `/notifications/marketing-campaigns/${campaign.id}/send/`);
              setNotice(t('mobile.campaignSent'));
              await load(true);
            } catch {
              Alert.alert(t('mobile.navMarketing'), t('common.actionFailed'));
            } finally {
              setBusyId(null);
            }
          })();
        },
      },
    ]);
  };

  const remove = (id: number) => {
    Alert.alert(t('common.delete'), t('mobile.deleteDraft'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId(`${id}-del`);
            try {
              await api.request('delete', `/notifications/marketing-campaigns/${id}/`);
              await load(true);
            } catch {
              Alert.alert(t('mobile.navMarketing'), t('common.actionFailed'));
            } finally {
              setBusyId(null);
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
        <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
        <Text style={[styles.backText, { color: C.text2 }]}>{t('common.back')}</Text>
      </Pressable>
      <Text style={[styles.title, { color: C.text }]}>{t('mobile.navMarketing')}</Text>
      <Text style={[styles.subtitle, { color: C.text2 }]}>{t('mobile.marketingSubtitle')}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brown} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />}
        >
          {notice ? (
            <View style={[styles.notice, { backgroundColor: C.card }]}>
              <Text style={[styles.noticeText, { color: C.brownDk }]}>{notice}</Text>
            </View>
          ) : null}

          <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={[styles.panelTitle, { color: C.text }]}>
              {editId ? t('common.edit') : t('mobile.newCampaign')}
            </Text>
            <TextInput
              value={form.subject}
              onChangeText={(subject) => setForm((prev) => ({ ...prev, subject }))}
              placeholder={t('mobile.campaignSubject')}
              placeholderTextColor={C.text2}
              style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
            />
            <TextInput
              value={form.body_html}
              onChangeText={(body_html) => setForm((prev) => ({ ...prev, body_html }))}
              placeholder={t('mobile.campaignBody')}
              placeholderTextColor={C.text2}
              multiline
              style={[styles.input, styles.area, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
            />
            <View style={styles.chips}>
              {(['all', 'inactive_30d'] as Segment[]).map((segment) => {
                const on = form.segment === segment;
                return (
                  <Pressable
                    key={segment}
                    onPress={() => setForm((prev) => ({ ...prev, segment }))}
                    style={[styles.chip, { backgroundColor: on ? C.brownDk : C.card }]}
                  >
                    <Text style={[styles.chipText, { color: on ? '#fff' : C.brownDk }]}>
                      {segment === 'all' ? t('mobile.segmentAll') : t('mobile.segmentInactive')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => void save()}
              disabled={!!busyId || !form.subject.trim() || !form.body_html.trim()}
              style={[styles.primary, { backgroundColor: C.brownDk, opacity: busyId ? 0.6 : 1 }]}
            >
              <Text style={styles.primaryText}>{t('common.save')}</Text>
            </Pressable>
          </View>

          <View style={[styles.tableHead, { borderColor: C.line }]}>
            <Text style={[styles.th, { color: C.text2, flex: 1.4 }]}>{t('mobile.campaignSubject')}</Text>
            <Text style={[styles.th, { color: C.text2, flex: 0.8 }]}>{t('mobile.status')}</Text>
            <Text style={[styles.th, { color: C.text2, width: 56, textAlign: 'right' }]}>{t('mobile.recipients')}</Text>
          </View>

          {campaigns.length === 0 ? (
            <Text style={{ color: C.text2 }}>{t('mobile.noRows')}</Text>
          ) : (
            campaigns.map((campaign) => (
              <View key={campaign.id} style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
                <View style={styles.row}>
                  <Text style={[styles.subject, { color: C.text }]} numberOfLines={2}>
                    {campaign.subject}
                  </Text>
                  <Text style={[styles.status, { color: C.brownDk }]}>{campaign.status}</Text>
                  <Text style={[styles.count, { color: C.text }]}>
                    {campaign.status === 'sent' ? campaign.recipient_count : previews[campaign.id] ?? '—'}
                  </Text>
                </View>
                <Text style={[styles.meta, { color: C.text2 }]}>
                  {campaign.segment === 'all' ? t('mobile.segmentAll') : t('mobile.segmentInactive')}
                </Text>
                <View style={styles.actions}>
                  {campaign.status === 'draft' ? (
                    <>
                      <Pressable
                        onPress={() => {
                          setEditId(campaign.id);
                          setForm({
                            subject: campaign.subject,
                            body_html: campaign.body_html,
                            segment: campaign.segment,
                          });
                        }}
                        style={[styles.ghost, { backgroundColor: C.card }]}
                      >
                        <Text style={[styles.ghostText, { color: C.brownDk }]}>{t('common.edit')}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void preview(campaign.id)}
                        style={[styles.ghost, { backgroundColor: C.card }]}
                      >
                        <Text style={[styles.ghostText, { color: C.brownDk }]}>{t('mobile.preview')}</Text>
                      </Pressable>
                      <Pressable onPress={() => send(campaign)} style={[styles.ghost, { backgroundColor: C.brownDk }]}>
                        <Text style={[styles.ghostText, { color: '#fff' }]}>{t('mobile.sendNow')}</Text>
                      </Pressable>
                      <Pressable onPress={() => remove(campaign.id)} style={[styles.ghost, { backgroundColor: '#dc2626' }]}>
                        <Text style={[styles.ghostText, { color: '#fff' }]}>{t('common.delete')}</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '800', paddingHorizontal: 16 },
  subtitle: { fontSize: 13, paddingHorizontal: 16, marginTop: 4, marginBottom: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  notice: { borderRadius: 14, padding: 12 },
  noticeText: { fontSize: 13, fontWeight: '700' },
  panel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  panelTitle: { fontSize: 16, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
  area: { minHeight: 120, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 12, fontWeight: '800' },
  primary: { borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  tableHead: { flexDirection: 'row', paddingHorizontal: 4, paddingBottom: 6, borderBottomWidth: 1 },
  th: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { flex: 1.4, fontSize: 14, fontWeight: '800' },
  status: { flex: 0.8, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  count: { width: 56, textAlign: 'right', fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  ghost: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  ghostText: { fontSize: 12, fontWeight: '800' },
});
