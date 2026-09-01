import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { useShopPalette } from '@/lib/shop';

type AdminKind =
  | 'dashboard'
  | 'analytics'
  | 'posts'
  | 'forge'
  | 'broadcast'
  | 'users'
  | 'bazaar'
  | 'vault'
  | 'shop'
  | 'reels'
  | 'lab'
  | 'achievements'
  | 'moderation'
  | 'verification'
  | 'seller'
  | 'chat'
  | 'health'
  | 'audit';

const PATHS: Record<Exclude<AdminKind, 'broadcast'>, string> = {
  dashboard: '/analytics/dashboard/',
  analytics: '/analytics/dashboard/',
  posts: '/staff/posts/',
  forge: '/forge/stories/?admin=1',
  users: '/users/profiles/',
  bazaar: '/ideas/?ordering=trending',
  vault: '/bottles/',
  shop: '/shop/items/',
  reels: '/reels/?admin=1',
  lab: '/challenges/',
  achievements: '/users/profiles/',
  moderation: '/moderation/flagged/',
  verification: '/users/admin/verification/',
  seller: '/users/admin/seller-applications/',
  chat: '/chat/admin/overview/',
  health: '/health/system/',
  audit: '/audit/logs/?limit=50',
};

const KPI_KEYS: Record<string, string> = {
  users: 'mobile.kpiUsers',
  active_users: 'admin.activeUsers',
  posts: 'mobile.kpiPosts',
  reels: 'admin.signals',
  ideas: 'mobile.kpiIdeas',
  bottles: 'mobile.kpiBottles',
  challenges: 'mobile.kpiChallenges',
  pending_flags: 'admin.pendingReports',
  flags: 'mobile.kpiFlags',
  orders_today: 'admin.ordersToday',
  revenue_today: 'mobile.kpiRevenue',
  active_products: 'admin.shopProducts',
  featured_products: 'admin.featured',
  conversations: 'mobile.conversations',
  messages: 'mobile.dmMessages',
  rooms: 'mobile.groupRooms',
  room_messages: 'mobile.roomMessages',
  presence_records: 'mobile.presence',
};

function unwrap(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.results)) return rec.results;
    if (Array.isArray(rec.logs)) return rec.logs;
    if (Array.isArray(rec.checks)) return rec.checks;
  }
  return [];
}

function asRecord(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
}

function nestedUser(row: Record<string, unknown>): Record<string, unknown> | null {
  return row.user && typeof row.user === 'object' ? (row.user as Record<string, unknown>) : null;
}

function rowTitle(row: Record<string, unknown>): string {
  const user = nestedUser(row);
  return String(
    row.title ||
      row.headline ||
      row.name ||
      row.username ||
      user?.username ||
      row.action ||
      row.verb ||
      row.subject ||
      row.slug ||
      row.id ||
      'item',
  );
}

function formatLabel(key: string, t: (k: string) => string): string {
  if (KPI_KEYS[key]) return t(KPI_KEYS[key]);
  return key.replace(/_/g, ' ');
}

function statusTone(status: string, C: { brown: string; text2: string }): string {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'ok' || s === 'healthy' || s === 'approved') return '#16a34a';
  if (s === 'pending' || s === 'review') return '#d97706';
  if (s === 'suspended' || s === 'rejected' || s === 'error' || s === 'down') return '#dc2626';
  return C.text2;
}

export default function AdminSectionScreen() {
  const { isDark } = useTheme();
  const C = useShopPalette(isDark);
  const { t, isRTL } = useLocale();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const kind = (route.params?.kind || 'dashboard') as AdminKind;
  const title = String(route.params?.title || t('admin.panelTitle'));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [comments, setComments] = useState<Record<string, unknown>[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(
    async (isRefresh = false) => {
      if (kind === 'broadcast') {
        setLoading(false);
        if (isRefresh) setRefreshing(false);
        return;
      }
      try {
        const data = await api.request<unknown>('get', PATHS[kind]);
        if (kind === 'dashboard' || kind === 'analytics' || kind === 'health' || kind === 'chat') {
          setPayload((data && typeof data === 'object' ? data : {}) as Record<string, unknown>);
          setRows(kind === 'health' ? (unwrap(data) as Record<string, unknown>[]) : []);
        } else {
          setRows(unwrap(data) as Record<string, unknown>[]);
          setPayload(null);
        }
        if (kind === 'posts') {
          try {
            const commentData = await api.request<unknown>('get', '/staff/comments/');
            setComments(unwrap(commentData) as Record<string, unknown>[]);
          } catch {
            setComments([]);
          }
        } else {
          setComments([]);
        }
      } catch {
        Alert.alert(t('admin.panelTitle'), t('admin.staffRequired'));
      } finally {
        setLoading(false);
        if (isRefresh) setRefreshing(false);
      }
    },
    [kind, t],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const user = nestedUser(row);
      const hay = [
        rowTitle(row),
        row.email,
        user?.email,
        user?.username,
        row.status,
        row.reason,
        row.content,
        row.description,
        row.action,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const runAction = async (label: string, fn: () => Promise<unknown>, okMessage?: string) => {
    setBusyId(label);
    setNotice('');
    try {
      await fn();
      if (okMessage) setNotice(okMessage);
      await load();
    } catch {
      Alert.alert(t('admin.panelTitle'), t('common.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return;
    setBusyId('broadcast');
    try {
      await api.request('post', '/notifications/broadcast/', {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
      });
      setBroadcastTitle('');
      setBroadcastMessage('');
      setNotice(t('mobile.sendBroadcast'));
    } catch {
      Alert.alert(t('admin.panelTitle'), t('common.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const kpis = useMemo(() => {
    if (!payload) return [];
    const items: Array<{ label: string; value: string }> = [];
    const pushObj = (obj: unknown) => {
      if (!obj || typeof obj !== 'object') return;
      Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
        if (value == null || typeof value === 'object') return;
        items.push({ label: formatLabel(key, t), value: String(value) });
      });
    };
    if (kind === 'chat') {
      pushObj(payload);
      return items;
    }
    if (kind === 'health') {
      const checks = Array.isArray(payload.checks) ? payload.checks : rows;
      const healthy = checks.filter((c) => {
        const status = String(asRecord(c).status || '').toLowerCase();
        return status === 'ok' || status === 'healthy';
      }).length;
      const total = checks.length;
      const pct = total ? Math.round((healthy / total) * 100) : 0;
      return [
        { label: t('mobile.healthScore'), value: `${pct}%` },
        { label: t('mobile.services'), value: String(total) },
        { label: t('mobile.healthy'), value: String(healthy) },
      ];
    }
    pushObj(payload.counts);
    pushObj(payload.shop);
    if (payload.completion_rate != null) {
      items.push({ label: t('admin.completionRate'), value: `${payload.completion_rate}%` });
    }
    return items;
  }, [payload, rows, kind, t]);

  const renderActions = (row: Record<string, unknown>) => {
    const id = Number(row.id);
    const user = nestedUser(row);
    const userId = Number(row.user_id || user?.id || id);
    const status = String(row.status || '');
    const isStaff = Boolean(row.is_staff || user?.is_staff);

    if (kind === 'users') {
      return (
        <View style={styles.actions}>
          {!isStaff ? (
            <Pressable
              onPress={() =>
                Alert.alert(t('mobile.promote'), `@${rowTitle(row)}`, [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('mobile.promote'),
                    onPress: () =>
                      void runAction(`${id}-promote`, () => api.request('post', `/users/${userId}/promote/`)),
                  },
                ])
              }
              style={[styles.chip, { backgroundColor: C.card }]}
            >
              <Text style={[styles.chipGhost, { color: C.brownDk }]}>{t('mobile.promote')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() =>
              void runAction(`${id}-shadow`, () => api.request('post', `/users/${userId}/shadow-ban/`))
            }
            style={[styles.chip, { backgroundColor: C.card }]}
          >
            <Text style={[styles.chipGhost, { color: C.brownDk }]}>{t('mobile.shadowBan')}</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert(status === 'suspended' ? t('mobile.activate') : t('mobile.suspend'), `@${rowTitle(row)}`, [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: status === 'suspended' ? t('mobile.activate') : t('mobile.suspend'),
                  style: status === 'suspended' ? 'default' : 'destructive',
                  onPress: () =>
                    void runAction(`${id}-status`, () =>
                      api.request('patch', `/users/profiles/${id}/`, {
                        status: status === 'suspended' ? 'active' : 'suspended',
                      }),
                    ),
                },
              ])
            }
            style={[styles.chip, { backgroundColor: status === 'suspended' ? '#16a34a' : '#dc2626' }]}
          >
            <Text style={styles.chipText}>{status === 'suspended' ? t('mobile.activate') : t('mobile.suspend')}</Text>
          </Pressable>
        </View>
      );
    }
    if (kind === 'moderation') {
      return (
        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              void runAction(`${id}-ok`, () => api.request('patch', `/moderation/flagged/${id}/`, { status: 'approved' }))
            }
            style={[styles.chip, { backgroundColor: '#16a34a' }]}
          >
            <Text style={styles.chipText}>{t('mobile.approve')}</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              void runAction(`${id}-no`, () => api.request('patch', `/moderation/flagged/${id}/`, { status: 'rejected' }))
            }
            style={[styles.chip, { backgroundColor: '#dc2626' }]}
          >
            <Text style={styles.chipText}>{t('mobile.reject')}</Text>
          </Pressable>
        </View>
      );
    }
    if (kind === 'verification' || kind === 'seller') {
      const path =
        kind === 'verification' ? `/users/admin/verification/${id}/` : `/users/admin/seller-applications/${id}/`;
      return (
        <View style={styles.actions}>
          <Pressable
            onPress={() => void runAction(`${id}-ok`, () => api.request('post', path, { action: 'approve' }))}
            style={[styles.chip, { backgroundColor: '#16a34a' }]}
          >
            <Text style={styles.chipText}>{t('mobile.approve')}</Text>
          </Pressable>
          <Pressable
            onPress={() => void runAction(`${id}-no`, () => api.request('post', path, { action: 'reject' }))}
            style={[styles.chip, { backgroundColor: '#dc2626' }]}
          >
            <Text style={styles.chipText}>{t('mobile.reject')}</Text>
          </Pressable>
        </View>
      );
    }
    if (kind === 'posts') {
      return (
        <View style={styles.actions}>
          <Pressable
            onPress={() =>
              Alert.alert(t('common.delete'), rowTitle(row), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.delete'),
                  style: 'destructive',
                  onPress: () =>
                    void runAction(`${id}-del`, () => api.request('delete', '/staff/posts/', { post_id: id })),
                },
              ])
            }
            style={[styles.chip, { backgroundColor: '#dc2626' }]}
          >
            <Text style={styles.chipText}>{t('common.delete')}</Text>
          </Pressable>
        </View>
      );
    }
    return null;
  };

  const metaRows = (row: Record<string, unknown>) => {
    const user = nestedUser(row);
    const pairs: Array<[string, string]> = [];
    const email = String(row.email || user?.email || '');
    const status = String(row.status || '');
    const points = row.points != null ? String(row.points) : '';
    const role = row.is_staff || user?.is_staff ? t('mobile.staff') : '';
    const reason = String(row.reason || '');
    const type = String(row.type || row.content_type || '');
    const reporter = String((row.reporter as any)?.username || row.reporter || '');
    const created = String(row.created_at || row.submitted_at || row.timestamp || '').slice(0, 16);
    if (email) pairs.push([t('mobile.email'), email]);
    if (points) pairs.push([t('mobile.points'), points]);
    if (role) pairs.push([t('mobile.role'), role]);
    if (status) pairs.push([t('mobile.status'), status]);
    if (type) pairs.push([t('mobile.type'), type]);
    if (reason) pairs.push([t('mobile.reason'), reason]);
    if (reporter) pairs.push([t('mobile.reporter'), reporter]);
    if (created && kind === 'audit') pairs.push([t('mobile.lastCheck'), created]);
    const body = String(row.content || row.description || row.body || row.text || '');
    if (body && kind !== 'posts') pairs.push(['', body.slice(0, 180)]);
    return pairs;
  };

  const showSearch = kind !== 'broadcast' && kind !== 'dashboard' && kind !== 'analytics' && kind !== 'chat';

  const tableCols =
    kind === 'users'
      ? [t('admin.navUsers'), t('mobile.email'), t('mobile.points'), t('mobile.status'), t('mobile.role')]
      : kind === 'moderation'
        ? [t('mobile.type'), t('mobile.reason'), t('mobile.reporter'), t('mobile.status')]
        : kind === 'posts'
          ? [t('admin.navPosts'), t('mobile.status')]
          : kind === 'audit'
            ? [t('admin.navAudit'), t('mobile.lastCheck')]
            : kind === 'verification' || kind === 'seller'
              ? [t('admin.navUsers'), t('mobile.email'), t('mobile.status')]
              : kind === 'shop' || kind === 'bazaar' || kind === 'forge' || kind === 'reels' || kind === 'lab'
                ? [t('common.search'), t('mobile.status')]
                : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.cream }]} edges={['top']}>
      <Pressable onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
        <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={16} color={C.text2} />
        <Text style={[styles.backText, { color: C.text2 }]}>{t('common.back')}</Text>
      </Pressable>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: C.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: C.text2 }]}>{t('mobile.staffOverview')}</Text>
        </View>
        <Pressable
          onPress={() => {
            setRefreshing(true);
            void load(true);
          }}
          style={[styles.refresh, { backgroundColor: C.card }]}
        >
          <Text style={{ color: C.brownDk, fontWeight: '700', fontSize: 12 }}>{t('admin.refresh')}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.brown} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              tintColor={C.brown}
            />
          }
        >
          {notice ? (
            <View style={[styles.notice, { backgroundColor: C.card }]}>
              <Text style={[styles.noticeText, { color: C.brownDk }]}>{notice}</Text>
            </View>
          ) : null}

          {kind === 'broadcast' ? (
            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
              <TextInput
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
                placeholder={t('mobile.broadcastTitle')}
                placeholderTextColor={C.text2}
                style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
              />
              <TextInput
                value={broadcastMessage}
                onChangeText={setBroadcastMessage}
                placeholder={t('mobile.broadcastMessage')}
                placeholderTextColor={C.text2}
                multiline
                style={[
                  styles.input,
                  { minHeight: 120, textAlignVertical: 'top', color: C.text, borderColor: C.line, backgroundColor: C.card2 },
                ]}
              />
              <Pressable
                onPress={() => void sendBroadcast()}
                disabled={!!busyId || !broadcastTitle.trim() || !broadcastMessage.trim()}
                style={[styles.primary, { backgroundColor: C.brownDk, opacity: busyId ? 0.6 : 1 }]}
              >
                <Text style={styles.primaryText}>{t('mobile.sendBroadcast')}</Text>
              </Pressable>
            </View>
          ) : null}

          {kpis.length ? (
            <View style={styles.grid}>
              {kpis.map((kpi) => (
                <View key={kpi.label} style={[styles.kpi, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.kpiLabel, { color: C.text2 }]}>{kpi.label}</Text>
                  <Text style={[styles.kpiValue, { color: C.text }]}>{kpi.value}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {kind === 'health'
            ? filteredRows.map((row, idx) => {
                const status = String(row.status || '');
                const color = statusTone(status, C);
                return (
                  <View
                    key={String(row.name || idx)}
                    style={[styles.card, { backgroundColor: C.white, borderColor: C.line, borderLeftColor: color, borderLeftWidth: 4 }]}
                  >
                    <Text style={[styles.rowTitle, { color: C.text }]}>{String(row.name || rowTitle(row))}</Text>
                    <Text style={{ color, fontWeight: '800', marginTop: 6 }}>{status || t('mobile.healthy')}</Text>
                    {row.detail ? <Text style={[styles.meta, { color: C.text2 }]}>{String(row.detail)}</Text> : null}
                  </View>
                );
              })
            : null}

          {showSearch ? (
            <View style={[styles.search, { backgroundColor: C.white, borderColor: C.line }]}>
              <Ionicons name="search" size={16} color={C.text2} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('mobile.searchRows')}
                placeholderTextColor={C.text2}
                style={[styles.searchInput, { color: C.text }]}
              />
              <Text style={[styles.meta, { color: C.text2, marginTop: 0 }]}>
                {t('mobile.profilesCount', { count: filteredRows.length })}
              </Text>
            </View>
          ) : null}

          {showSearch && tableCols.length && kind !== 'health' ? (
            <View style={[styles.tableHead, { borderColor: C.line }]}>
              {tableCols.map((col) => (
                <Text key={col} style={[styles.th, { color: C.text2 }]} numberOfLines={1}>
                  {col}
                </Text>
              ))}
            </View>
          ) : null}

          {kind !== 'broadcast' && kind !== 'health' && filteredRows.length === 0 && !kpis.length ? (
            <Text style={{ color: C.text2 }}>{t('mobile.noRows')}</Text>
          ) : (
            kind !== 'health' &&
            filteredRows.map((row, idx) => {
              const status = String(row.status || '');
              return (
                <View key={String(row.id || idx)} style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
                  <View style={styles.cardHead}>
                    <Text style={[styles.rowTitle, { color: C.text, flex: 1 }]} numberOfLines={2}>
                      {kind === 'users' ? `@${rowTitle(row)}` : rowTitle(row)}
                    </Text>
                    {status ? (
                      <View style={[styles.badge, { backgroundColor: C.card }]}>
                        <Text style={[styles.badgeText, { color: statusTone(status, C) }]}>{status}</Text>
                      </View>
                    ) : null}
                  </View>
                  {metaRows(row).map(([label, value], i) => (
                    <View key={`${label}-${i}`} style={styles.metaRow}>
                      {label ? <Text style={[styles.metaLabel, { color: C.text2 }]}>{label}</Text> : null}
                      <Text style={[styles.metaValue, { color: C.text }]}>{value}</Text>
                    </View>
                  ))}
                  {kind === 'posts' && row.text ? (
                    <Text style={[styles.meta, { color: C.text2 }]} numberOfLines={3}>
                      {String(row.text)}
                    </Text>
                  ) : null}
                  {renderActions(row)}
                </View>
              );
            })
          )}

          {kind === 'posts' && comments.length ? (
            <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line, marginTop: 8 }]}>
              <Text style={[styles.rowTitle, { color: C.text, marginBottom: 10 }]}>{t('mobile.comments')}</Text>
              {comments.slice(0, 40).map((comment, idx) => {
                const id = Number(comment.id);
                return (
                  <View key={String(comment.id || idx)} style={styles.commentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.metaValue, { color: C.text }]} numberOfLines={2}>
                        {String(comment.content || comment.text || comment.body || '')}
                      </Text>
                      <Text style={[styles.meta, { color: C.text2 }]}>
                        @{String(nestedUser(comment)?.username || comment.username || '')}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        void runAction(`${id}-cdel`, () =>
                          api.request('delete', '/staff/comments/', { comment_id: id }),
                        )
                      }
                      style={[styles.chip, { backgroundColor: '#dc2626' }]}
                    >
                      <Text style={styles.chipText}>{t('common.delete')}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  backText: { fontSize: 14, fontWeight: '600' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 4 },
  refresh: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
  notice: { borderRadius: 14, padding: 12 },
  noticeText: { fontSize: 13, fontWeight: '700' },
  panel: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  chipGhost: { fontWeight: '800', fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
  primary: { borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderRadius: 16, borderWidth: 1, padding: 12 },
  kpiLabel: { fontSize: 11 },
  kpiValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  tableHead: { flexDirection: 'row', gap: 8, paddingHorizontal: 6, paddingBottom: 6, borderBottomWidth: 1 },
  th: { flex: 1, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  meta: { fontSize: 12, marginTop: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 8 },
  metaLabel: { fontSize: 12, fontWeight: '600' },
  metaValue: { fontSize: 12, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
});
