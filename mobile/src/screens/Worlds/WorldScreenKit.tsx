import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
  WorldStat,
} from '@/components/world/WorldChrome';

export type WorldTone = 'lab' | 'vault' | 'bazaar' | 'live' | 'shop' | 'default';
export type WorldRow = Record<string, any>;

export type WorldAction = {
  label: string;
  run: (row: WorldRow) => Promise<unknown>;
  confirm?: string;
};

type WorldListProps = {
  title: string;
  subtitle: string;
  tone?: WorldTone;
  heroTitle: string;
  heroBody: string;
  emptyText?: string;
  load: () => Promise<unknown>;
  createLabel?: string;
  createPlaceholder?: string;
  createPayload?: (text: string) => Record<string, unknown>;
  create?: (payload: Record<string, unknown>) => Promise<unknown>;
  actions?: WorldAction[];
  onPressRow?: (row: WorldRow, navigation: any) => void;
  rowTitle?: (row: WorldRow) => string;
  rowSubtitle?: (row: WorldRow) => string;
  rowMeta?: (row: WorldRow) => string;
  headerRight?: React.ReactNode;
  transformRows?: (data: unknown) => WorldRow[];
};

type WorldStatsProps = {
  title: string;
  subtitle: string;
  tone?: WorldTone;
  heroTitle: string;
  heroBody: string;
  load: () => Promise<unknown>;
  linkLabel?: string;
  onLink?: (navigation: any) => void;
};

export function rowsFrom(data: unknown): WorldRow[] {
  if (Array.isArray(data)) return data as WorldRow[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, any>;
  const list =
    obj.results ||
    obj.items ||
    obj.rows ||
    obj.projects ||
    obj.campaigns ||
    obj.plans ||
    obj.achievements ||
    obj.resources ||
    obj.failed_ideas ||
    obj.future_memories ||
    obj.memories ||
    obj.characters ||
    obj.draw_sessions ||
    obj.sessions ||
    obj.stories ||
    obj.prompt_rooms ||
    obj.rooms ||
    obj.transactions ||
    obj.sales;
  return Array.isArray(list) ? list : [];
}

export function titleOf(row: WorldRow): string {
  return String(
    row.title ||
      row.name ||
      row.label ||
      row.headline ||
      row.question_text ||
      row.email ||
      row.username ||
      row.display_name ||
      row.id ||
      'Untitled',
  );
}

export function subtitleOf(row: WorldRow): string {
  return String(
    row.description ||
      row.body ||
      row.text ||
      row.content ||
      row.summary ||
      row.caption ||
      row.status ||
      row.created_at ||
      '',
  );
}

export function compactMeta(row: WorldRow): string {
  const parts = [
    row.category,
    row.status,
    row.type,
    row.price_usd != null ? `$${Number(row.price_usd).toFixed(2)}` : undefined,
    row.price_usd_cents != null ? `$${(Number(row.price_usd_cents) / 100).toFixed(2)}` : undefined,
    row.member_count != null ? `${row.member_count} members` : undefined,
    row.created_at ? formatDate(row.created_at) : undefined,
  ].filter(Boolean);
  return parts.join(' · ');
}

export async function openMaybeUrl(value?: string | null) {
  if (!value) {
    Alert.alert('Unavailable', 'No URL was returned.');
    return;
  }
  await Linking.openURL(value);
}

export function WorldListScreen({
  title,
  subtitle,
  tone = 'default',
  heroTitle,
  heroBody,
  emptyText = 'Nothing here yet',
  load,
  createLabel,
  createPlaceholder,
  createPayload,
  create,
  actions = [],
  onPressRow,
  rowTitle = titleOf,
  rowSubtitle = subtitleOf,
  rowMeta = compactMeta,
  headerRight,
  transformRows,
}: WorldListProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<WorldRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const fetchRows = useCallback(
    async (refresh = false) => {
      if (!refresh) setLoading(true);
      try {
        const data = await load();
        setRows(transformRows ? transformRows(data) : rowsFrom(data));
      } catch (error: any) {
        Alert.alert(title, error?.response?.data?.detail || 'Could not load this world.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load, title, transformRows],
  );

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const submitCreate = async () => {
    const text = draft.trim();
    if (!create || !createPayload || !text) return;
    setCreating(true);
    try {
      await create(createPayload(text));
      setDraft('');
      await fetchRows(true);
    } catch (error: any) {
      Alert.alert(createLabel || title, error?.response?.data?.detail || 'Could not create item.');
    } finally {
      setCreating(false);
    }
  };

  const runAction = async (action: WorldAction, row: WorldRow) => {
    const key = `${action.label}-${row.id || row.title || rows.indexOf(row)}`;
    const execute = async () => {
      setBusyKey(key);
      try {
        await action.run(row);
        await fetchRows(true);
      } catch (error: any) {
        Alert.alert(action.label, error?.response?.data?.detail || 'Action is not available yet.');
      } finally {
        setBusyKey(null);
      }
    };
    if (action.confirm) {
      Alert.alert(action.label, action.confirm, [
        { text: 'Cancel', style: 'cancel' },
        { text: action.label, onPress: () => void execute() },
      ]);
      return;
    }
    await execute();
  };

  return (
    <WorldBackdrop tone={tone}>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={title}
          subtitle={subtitle}
          tone={tone}
          onBack={() => navigation.goBack()}
          right={headerRight}
        />
        {loading && rows.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item, index) => String(item.id ?? item.slug ?? item.username ?? index)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void fetchRows(true);
                }}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              <>
                <WorldHero tone={tone} eyebrow={subtitle} title={heroTitle} body={heroBody} />
                {create ? (
                  <WorldCard>
                    <TextInput
                      value={draft}
                      onChangeText={setDraft}
                      placeholder={createPlaceholder || 'Title'}
                      placeholderTextColor={colors.textMuted}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <WorldPrimaryButton
                      label={createLabel || 'Create'}
                      onPress={submitCreate}
                      loading={creating}
                      disabled={creating || !draft.trim()}
                    />
                  </WorldCard>
                ) : null}
              </>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{emptyText}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const press = onPressRow ? () => onPressRow(item, navigation) : undefined;
              return (
                <WorldCard onPress={press}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{rowTitle(item)}</Text>
                  {rowSubtitle(item) ? (
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={4}>
                      {rowSubtitle(item)}
                    </Text>
                  ) : null}
                  {rowMeta(item) ? (
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>{rowMeta(item)}</Text>
                  ) : null}
                  {actions.length ? (
                    <View style={styles.actionRow}>
                      {actions.map((action) => {
                        const key = `${action.label}-${item.id || rows.indexOf(item)}`;
                        return (
                          <TouchableOpacity
                            key={action.label}
                            style={[styles.actionBtn, { borderColor: colors.border }]}
                            disabled={busyKey === key}
                            onPress={() => void runAction(action, item)}
                          >
                            <Text style={[styles.actionText, { color: colors.primary }]}>
                              {busyKey === key ? '...' : action.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : null}
                </WorldCard>
              );
            }}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

export function WorldStatsScreen({
  title,
  subtitle,
  tone = 'default',
  heroTitle,
  heroBody,
  load,
  linkLabel,
  onLink,
}: WorldStatsProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const value = await load();
      setData(value && typeof value === 'object' ? (value as Record<string, any>) : { value });
    } catch (error: any) {
      Alert.alert(title, error?.response?.data?.detail || 'Could not load this world.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [load, title]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const stats = useMemo(() => Object.entries(flatStats(data)).slice(0, 12), [data]);
  const rows = useMemo(() => rowsFrom(data), [data]);

  return (
    <WorldBackdrop tone={tone}>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader title={title} subtitle={subtitle} tone={tone} onBack={() => navigation.goBack()} />
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void fetchData()} colors={[colors.primary]} />}
        >
          <WorldHero
            tone={tone}
            eyebrow={subtitle}
            title={heroTitle}
            body={heroBody}
            action={
              linkLabel && onLink ? (
                <WorldPrimaryButton label={linkLabel} onPress={() => onLink(navigation)} />
              ) : undefined
            }
          />
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <>
              {stats.length ? (
                <View style={styles.statsGrid}>
                  {stats.map(([key, value]) => (
                    <WorldStat key={key} label={humanize(key)} value={String(value)} />
                  ))}
                </View>
              ) : (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No stats returned yet.</Text>
              )}
              {rows.map((row, index) => (
                <WorldCard key={String(row.id ?? index)}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{titleOf(row)}</Text>
                  {subtitleOf(row) ? (
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{subtitleOf(row)}</Text>
                  ) : null}
                </WorldCard>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function flatStats(data: Record<string, any> | null) {
  if (!data) return {};
  const out: Record<string, string | number> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value == null) return;
    if (['string', 'number', 'boolean'].includes(typeof value)) out[key] = formatValue(value);
  });
  return out;
}

function formatValue(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? value : value.toFixed(2);
  return String(value);
}

function humanize(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 48 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  meta: { fontSize: 12, fontWeight: '600' },
  empty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  actionText: { fontSize: 13, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
});
