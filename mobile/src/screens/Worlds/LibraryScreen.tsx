import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { openInAppWeb } from '@/lib/nav';
import {
  asResource,
  asResources,
  LIBRARY_TABS,
  resourceFileUrl,
  resourceIcon,
  useLibraryPalette,
  type LibraryResource,
  type ResourceType,
} from '@/lib/library';

export default function LibraryScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useLibraryPalette(isDark);
  const { t } = useLocale();

  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [tab, setTab] = useState<ResourceType>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const rows = asResources(
        await api.getResources({
          type: tab === 'all' ? undefined : tab,
          search: debouncedSearch || undefined,
        }),
      );
      setResources(rows);
    } catch {
      setResources([]);
      setError(t('library.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, debouncedSearch, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const download = async (resource: LibraryResource) => {
    if (busyId) return;
    setBusyId(resource.id);
    setError('');
    try {
      const updated = asResource(await api.downloadResource(resource.id)) || resource;
      setResources((prev) => prev.map((row) => (row.id === resource.id ? updated : row)));
      const url = resourceFileUrl(updated.file_url || resource.file_url);
      if (url) {
        openInAppWeb(navigation, resource.title || t('library.title'), url);
      } else {
        setError(t('library.downloadFailed'));
      }
    } catch {
      setError(t('library.downloadFailed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('library.title')}
          subtitle={t('library.subtitle')}
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
          }
        >
          <View style={[styles.search, { backgroundColor: C.white, borderColor: C.line }]}>
            <Ionicons name="search" size={18} color={C.text2} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t('library.search')}
              placeholderTextColor={C.text2}
              style={[styles.searchInput, { color: C.text }]}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
          >
            {LIBRARY_TABS.map((item) => {
              const selected = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: selected ? C.brown : C.white,
                      borderColor: selected ? C.brown : C.line,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={14} color={selected ? '#fff' : C.text2} />
                  <Text style={[styles.tabText, { color: selected ? '#fff' : C.text2 }]}>
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {error ? <Text style={[styles.error, { color: C.brownDk }]}>{error}</Text> : null}

          {loading && resources.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.brown} />
              <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
            </View>
          ) : resources.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: C.card2 }]}>
              <Text style={[styles.hint, { color: C.text2 }]}>{error || t('library.empty')}</Text>
              {error ? (
                <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.grid}>
              {resources.map((resource) => {
                const busy = busyId === resource.id;
                return (
                  <View
                    key={resource.id}
                    style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}
                  >
                    <View style={styles.cardHead}>
                      <Ionicons name={resourceIcon(resource.type)} size={18} color={C.brown} />
                      <View style={[styles.badge, { backgroundColor: C.card2 }]}>
                        <Text style={[styles.badgeText, { color: C.brownDk }]}>
                          {resource.type_display}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.cardTitle, { color: C.text }]}>{resource.title}</Text>
                    {resource.description ? (
                      <Text style={[styles.cardBody, { color: C.text2 }]} numberOfLines={3}>
                        {resource.description}
                      </Text>
                    ) : null}
                    <View style={styles.cardFoot}>
                      <Text style={[styles.meta, { color: C.text2 }]}>
                        {[resource.file_size_label, `${resource.download_count} ${t('library.downloads')}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      <Pressable
                        onPress={() => void download(resource)}
                        disabled={busy}
                        style={[
                          styles.download,
                          {
                            backgroundColor: C.brownDk,
                            opacity: busy ? 0.55 : 1,
                          },
                        ]}
                      >
                        <Ionicons name="download-outline" size={14} color="#fff" />
                        <Text style={styles.downloadText}>
                          {busy ? t('common.loading') : t('library.download')}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  tabs: { gap: 8, paddingBottom: 16 },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 13, marginBottom: 10 },
  center: { alignItems: 'center', paddingVertical: 40 },
  hint: { fontSize: 14, textAlign: 'center', marginTop: 10 },
  empty: { borderRadius: 18, padding: 28, alignItems: 'center' },
  retry: { marginTop: 14, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  grid: { gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardBody: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  cardFoot: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  meta: { fontSize: 11, flex: 1 },
  download: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  downloadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
