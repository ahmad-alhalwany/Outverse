import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { BAZAAR_CATEGORIES, type BazaarIdea } from '@/lib/bazaar';
import {
  CreateIdeaModal,
  DeleteIdeaDialog,
  EditIdeaModal,
  FeaturedHero,
  FeaturedRail,
  IdeaCard,
  type BazaarPalette,
} from './bazaarParts';

const PALETTES: Record<'light' | 'dark', BazaarPalette> = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    card2: '#F5F1FE',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
    overlay: 'rgba(33,27,61,0.45)',
    fundedBg: '#e8f3ee',
    fundedText: '#2f8f6b',
    progressBg: 'rgba(0,0,0,0.06)',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    card2: '#251B4D',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
    overlay: 'rgba(10,8,24,0.65)',
    fundedBg: 'rgba(74,222,128,0.15)',
    fundedText: '#4ade80',
    progressBg: 'rgba(255,255,255,0.08)',
  },
};

const TABS = [
  { key: 'trending', labelKey: 'bazaar.trending' },
  { key: 'new', labelKey: 'bazaar.new' },
  { key: 'needs_help', labelKey: 'bazaar.needsHelp' },
] as const;

const SORT_OPTIONS = [
  { key: 'newest', labelKey: 'bazaar.sortNewest' },
  { key: 'funded', labelKey: 'bazaar.sortMostFunded' },
  { key: 'supporters', labelKey: 'bazaar.sortMostSupported' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['key'];

export default function BazaarScreen() {
  const { isDark } = useTheme();
  const { t, locale } = useLocale();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const C = isDark ? PALETTES.dark : PALETTES.light;

  const [ideas, setIdeas] = useState<BazaarIdea[]>([]);
  const [featured, setFeatured] = useState<BazaarIdea[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('trending');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<BazaarIdea | null>(null);
  const [deleting, setDeleting] = useState<BazaarIdea | null>(null);

  const patchIdea = useCallback((id: BazaarIdea['id'], patch: Partial<BazaarIdea>) => {
    setIdeas((list) => list.map((row) => (String(row.id) === String(id) ? { ...row, ...patch } : row)));
    setFeatured((list) => list.map((row) => (String(row.id) === String(id) ? { ...row, ...patch } : row)));
  }, []);

  const load = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setLoadError(false);
      }
      try {
        const [page, featuredRows] = await Promise.all([
          api.getIdeas({
            ordering: tab === 'new' ? 'new' : 'trending',
            category: category === 'all' ? undefined : category,
            offset: append ? ideas.length : 0,
            limit: 20,
          }),
          append ? Promise.resolve(null) : api.getFeaturedIdeas().catch(() => []),
        ]);
        const rows = (page.results || []) as BazaarIdea[];
        setIdeas((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(!!page.has_more);
        if (featuredRows) setFeatured(featuredRows as BazaarIdea[]);
      } catch {
        if (!append) {
          setIdeas([]);
          setLoadError(true);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [tab, category, ideas.length],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [tab, category]),
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = tab === 'needs_help' ? ideas.filter((idea) => (idea.roles_needed?.length || 0) > 0) : ideas;
    if (q) {
      list = list.filter(
        (idea) =>
          idea.title.toLowerCase().includes(q) ||
          (idea.description || '').toLowerCase().includes(q) ||
          (idea.owner?.username || '').toLowerCase().includes(q),
      );
    }
    list = [...list];
    if (sortBy === 'funded') list.sort((a, b) => (b.funding_raised || 0) - (a.funding_raised || 0));
    if (sortBy === 'supporters') list.sort((a, b) => (b.supporters || 0) - (a.supporters || 0));
    return list;
  }, [ideas, tab, search, sortBy]);

  const shownFeatured = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return featured;
    return featured.filter(
      (idea) => idea.title.toLowerCase().includes(q) || (idea.description || '').toLowerCase().includes(q),
    );
  }, [featured, search]);

  const openIdea = (idea: BazaarIdea, openPledge = false) =>
    navigation.navigate('BazaarDetail', { ideaId: idea.id, openPledge });

  const handleVote = async (idea: BazaarIdea) => {
    try {
      const data = await api.voteIdea(idea.id);
      patchIdea(idea.id, { is_voted: !!data.voted, supporters: data.supporters ?? idea.supporters });
    } catch {
      setActionError(t('bazaar.voteFailed'));
    }
  };

  const handleSave = async (idea: BazaarIdea) => {
    try {
      const data = await api.toggleIdeaSave(idea.id);
      patchIdea(idea.id, { is_saved: !!(data.saved ?? data.is_saved) });
    } catch {
      setActionError(t('bazaar.saveFailed'));
    }
  };

  const canManage = (idea: BazaarIdea) =>
    !!(idea.is_owner || (user?.id && idea.owner?.id && Number(user.id) === Number(idea.owner.id)));

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: C.white, borderColor: C.line }]}>
            <Ionicons name="chevron-back" size={20} color={C.brownDk} />
            <Text style={{ color: C.brownDk, fontWeight: '700' }}>{t('common.back')}</Text>
          </Pressable>
        </View>

        {loading && ideas.length === 0 && !loadError ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={{ color: C.text2, marginTop: 10 }}>{t('bazaar.loading')}</Text>
          </View>
        ) : (
          <FlatList
            key={view}
            data={shown}
            keyExtractor={(item) => String(item.id)}
            numColumns={view === 'grid' ? 2 : 1}
            columnWrapperStyle={view === 'grid' ? styles.gridRow : undefined}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load(false);
                }}
                tintColor={C.brown}
              />
            }
            ListHeaderComponent={
              <View>
                <View style={styles.headerRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.eyebrow, { color: C.brown }]}>{t('bazaar.eyebrow')}</Text>
                    <Text style={[styles.title, { color: C.text }]}>{t('bazaar.title')}</Text>
                    <Text style={[styles.subtitle, { color: C.text2 }]}>{t('bazaar.subtitle')}</Text>
                  </View>
                  <Pressable onPress={() => setCreateOpen(true)}>
                    <LinearGradient colors={[C.brown, C.brownDk]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createBtn}>
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.createText}>{t('bazaar.createIdea')}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>

                {actionError ? (
                  <Pressable onPress={() => setActionError('')} style={styles.errorBanner}>
                    <Text style={styles.errorText}>{actionError}</Text>
                  </Pressable>
                ) : null}

                <View style={[styles.searchBar, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Ionicons name="search-outline" size={18} color={C.text2} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('bazaar.search')}
                    placeholderTextColor={C.text2}
                    style={[styles.searchInput, { color: C.text }]}
                  />
                </View>

                <View style={[styles.tabs, { borderColor: C.line }]}>
                  {TABS.map((item) => {
                    const active = tab === item.key;
                    return (
                      <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.tab}>
                        <Text style={{ color: active ? C.brown : C.text2, fontWeight: '800', fontSize: 14 }}>
                          {t(item.labelKey)}
                        </Text>
                        {active ? <View style={[styles.tabLine, { backgroundColor: C.brown }]} /> : null}
                      </Pressable>
                    );
                  })}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {BAZAAR_CATEGORIES.map((item) => {
                    const active = category === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setCategory(item.key)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active ? C.brown : C.white,
                            borderColor: active ? C.brown : C.line,
                          },
                        ]}
                      >
                        <Text style={{ color: active ? '#fff' : C.text2, fontWeight: '700', fontSize: 13 }}>
                          {locale === 'ar' ? item.ar : item.en}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <View style={styles.toolbar}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {SORT_OPTIONS.map((item) => {
                      const active = sortBy === item.key;
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => setSortBy(item.key)}
                          style={[styles.sortChip, { backgroundColor: active ? C.white : C.card2, borderColor: C.line }]}
                        >
                          <Text style={{ color: active ? C.brown : C.text2, fontWeight: '700', fontSize: 12 }}>
                            {t(item.labelKey)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <View style={[styles.viewToggle, { backgroundColor: C.card2 }]}>
                    <Pressable
                      onPress={() => setView('grid')}
                      style={[styles.viewBtn, view === 'grid' && { backgroundColor: C.white }]}
                    >
                      <Ionicons name="grid-outline" size={16} color={view === 'grid' ? C.brown : C.text2} />
                    </Pressable>
                    <Pressable
                      onPress={() => setView('list')}
                      style={[styles.viewBtn, view === 'list' && { backgroundColor: C.white }]}
                    >
                      <Ionicons name="list-outline" size={16} color={view === 'list' ? C.brown : C.text2} />
                    </Pressable>
                  </View>
                </View>

                {!loading && !search.trim() && shownFeatured[0] ? (
                  <FeaturedHero
                    idea={shownFeatured[0]}
                    C={C}
                    t={t}
                    locale={locale}
                    onOpen={() => openIdea(shownFeatured[0])}
                  />
                ) : null}

                {loadError ? (
                  <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                    <Text style={{ color: C.text, fontWeight: '700', marginBottom: 10 }}>{t('bazaar.loadError')}</Text>
                    <Pressable onPress={() => void load(false)} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                      <Text style={{ color: '#fff', fontWeight: '800' }}>{t('bazaar.retry')}</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              loading || loadError ? null : (
                <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Text style={{ color: C.text2, textAlign: 'center' }}>
                    {search.trim() ? t('bazaar.noSearch') : t('bazaar.empty')}
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <View style={view === 'grid' ? styles.gridItem : undefined}>
                <IdeaCard
                  idea={item}
                  view={view}
                  C={C}
                  t={t}
                  locale={locale}
                  canManage={canManage(item)}
                  onOpen={() => openIdea(item)}
                  onVote={() => void handleVote(item)}
                  onSave={() => void handleSave(item)}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setDeleting(item)}
                  onPledge={() => openIdea(item, true)}
                />
              </View>
            )}
            ListFooterComponent={
              <View>
                {hasMore ? (
                  <Pressable
                    onPress={() => void load(true)}
                    disabled={loadingMore}
                    style={[styles.retry, { backgroundColor: C.brownDk, alignSelf: 'center', marginBottom: 16, opacity: loadingMore ? 0.7 : 1 }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>
                      {loadingMore ? t('common.loading') : t('feed.loadMoreFeed')}
                    </Text>
                  </Pressable>
                ) : null}
                <FeaturedRail ideas={shownFeatured} C={C} t={t} onOpen={openIdea} />
                <View style={[styles.sideCard, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.sideTitle, { color: C.text }]}>{t('bazaar.categories')}</Text>
                  <View style={styles.wrapChips}>
                    {BAZAAR_CATEGORIES.filter((item) => item.key !== 'all').map((item) => (
                      <Pressable
                        key={item.key}
                        onPress={() => setCategory(item.key)}
                        style={[styles.chip, { backgroundColor: C.card2, borderColor: C.card2 }]}
                      >
                        <Text style={{ color: C.text, fontWeight: '600', fontSize: 12 }}>
                          {locale === 'ar' ? item.ar : item.en}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <LinearGradient colors={[C.card, C.card2, C.white]} style={[styles.footer, { borderColor: C.line }]}>
                  <Text style={[styles.eyebrow, { color: C.brown }]}>{t('bazaar.footerEyebrow')}</Text>
                  <Text style={[styles.footerTitle, { color: C.text }]}>{t('bazaar.footerTitle')}</Text>
                  <Text style={[styles.subtitle, { color: C.text2, marginTop: 8 }]}>{t('bazaar.footerBody')}</Text>
                  <Pressable onPress={() => setCreateOpen(true)} style={{ marginTop: 14 }}>
                    <LinearGradient colors={[C.brown, C.brownDk]} style={styles.createBtn}>
                      <Ionicons name="add" size={16} color="#fff" />
                      <Text style={styles.createText}>{t('bazaar.footerCta')}</Text>
                    </LinearGradient>
                  </Pressable>
                </LinearGradient>
              </View>
            }
          />
        )}
      </SafeAreaView>

      <CreateIdeaModal
        visible={createOpen}
        C={C}
        t={t}
        locale={locale}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load(false)}
      />
      {editing ? (
        <EditIdeaModal
          idea={editing}
          C={C}
          t={t}
          locale={locale}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load(false);
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteIdeaDialog
          idea={deleting}
          C={C}
          t={t}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void load(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    minHeight: 36,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 6 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  createText: { color: '#fff', fontWeight: '800' },
  errorBanner: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 10, marginBottom: 12 },
  errorText: { color: '#B91C1C', fontSize: 13 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 46,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginTop: 8 },
  tab: { paddingHorizontal: 12, paddingVertical: 10, position: 'relative' },
  tabLine: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 2, borderRadius: 2 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  sortChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  viewToggle: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  viewBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  empty: { borderRadius: 18, borderWidth: 1, padding: 28, alignItems: 'center', marginBottom: 16 },
  retry: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  gridRow: { gap: 10 },
  gridItem: { flex: 1, minWidth: 0 },
  sideCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 14 },
  sideTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 12 },
  footerTitle: { fontSize: 20, fontWeight: '800' },
});
