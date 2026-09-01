import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import Avatar from '@/components/Avatar';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';

type SearchTab =
  | 'all'
  | 'users'
  | 'posts'
  | 'reels'
  | 'ideas'
  | 'stories'
  | 'challenges'
  | 'shop'
  | 'bottles';

type SearchResults = {
  users: Array<{ id: number; username: string; name?: string; avatar?: string | null }>;
  posts: Array<{ id: number; snippet?: string; author?: string; tags?: string[] }>;
  reels: Array<{ id: number; caption?: string; author?: string; tags?: string[] }>;
  ideas: Array<{ id: number; title?: string; description?: string; owner?: string }>;
  stories: Array<{ id: number; title?: string; description?: string; owner?: string }>;
  bottles: Array<{ id: number; message?: string; emotion_type?: string; sender?: string }>;
  shop: Array<{ id: number; name?: string; description?: string; creator?: string; price?: number }>;
  challenges: Array<{ id: number; title?: string; description?: string; type?: string }>;
};

type ResultRow = {
  key: string;
  kind: Exclude<SearchTab, 'all'>;
  title: string;
  subtitle: string;
  id: number;
  avatar?: string | null;
};

const EMPTY: SearchResults = {
  users: [],
  posts: [],
  reels: [],
  ideas: [],
  stories: [],
  bottles: [],
  shop: [],
  challenges: [],
};

const TAB_META: Array<{
  key: SearchTab;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'all', labelKey: 'search.all', icon: 'apps-outline' },
  { key: 'users', labelKey: 'search.creators', icon: 'person-outline' },
  { key: 'posts', labelKey: 'search.posts', icon: 'document-text-outline' },
  { key: 'ideas', labelKey: 'search.ideas', icon: 'bulb-outline' },
  { key: 'stories', labelKey: 'search.stories', icon: 'book-outline' },
  { key: 'challenges', labelKey: 'search.challenges', icon: 'flame-outline' },
  { key: 'reels', labelKey: 'search.signals', icon: 'play-circle-outline' },
  { key: 'shop', labelKey: 'search.shopTab', icon: 'cart-outline' },
  { key: 'bottles', labelKey: 'search.vaultTab', icon: 'archive-outline' },
];

const PAGINATED: Array<Exclude<SearchTab, 'all'>> = [
  'users',
  'posts',
  'reels',
  'ideas',
  'stories',
  'bottles',
  'shop',
  'challenges',
];

function flatten(results: SearchResults, tab: SearchTab, t: (key: string) => string): ResultRow[] {
  const rows: ResultRow[] = [];
  if (tab === 'all' || tab === 'users') {
    results.users.forEach((u) =>
      rows.push({
        key: `user-${u.id}`,
        kind: 'users',
        id: u.id,
        title: u.name || u.username,
        subtitle: `@${u.username}`,
        avatar: u.avatar,
      }),
    );
  }
  if (tab === 'all' || tab === 'posts') {
    results.posts.forEach((p) =>
      rows.push({
        key: `post-${p.id}`,
        kind: 'posts',
        id: p.id,
        title: p.snippet || t('search.untitledPost'),
        subtitle: p.author ? `@${p.author}` : t('search.posts'),
      }),
    );
  }
  if (tab === 'all' || tab === 'reels') {
    results.reels.forEach((r) =>
      rows.push({
        key: `reel-${r.id}`,
        kind: 'reels',
        id: r.id,
        title: r.caption || t('search.untitledReel'),
        subtitle: r.author ? `@${r.author}` : t('search.signals'),
      }),
    );
  }
  if (tab === 'all' || tab === 'ideas') {
    results.ideas.forEach((i) =>
      rows.push({
        key: `idea-${i.id}`,
        kind: 'ideas',
        id: i.id,
        title: i.title || t('search.ideas'),
        subtitle: i.owner ? `@${i.owner}` : i.description || t('search.ideas'),
      }),
    );
  }
  if (tab === 'all' || tab === 'stories') {
    results.stories.forEach((s) =>
      rows.push({
        key: `story-${s.id}`,
        kind: 'stories',
        id: s.id,
        title: s.title || t('search.stories'),
        subtitle: s.owner ? `@${s.owner}` : s.description || t('search.stories'),
      }),
    );
  }
  if (tab === 'all' || tab === 'challenges') {
    results.challenges.forEach((c) =>
      rows.push({
        key: `challenge-${c.id}`,
        kind: 'challenges',
        id: c.id,
        title: c.title || t('search.challenges'),
        subtitle: c.type || c.description || t('search.challenges'),
      }),
    );
  }
  if (tab === 'all' || tab === 'shop') {
    results.shop.forEach((s) =>
      rows.push({
        key: `shop-${s.id}`,
        kind: 'shop',
        id: s.id,
        title: s.name || t('search.shopTab'),
        subtitle: s.creator
          ? `@${s.creator}${s.price != null ? ` · ${s.price}` : ''}`
          : s.description || t('search.shopTab'),
      }),
    );
  }
  if (tab === 'all' || tab === 'bottles') {
    results.bottles.forEach((b) =>
      rows.push({
        key: `bottle-${b.id}`,
        kind: 'bottles',
        id: b.id,
        title: b.message || t('search.vaultTab'),
        subtitle: b.sender ? `@${b.sender}` : b.emotion_type || t('search.vaultTab'),
      }),
    );
  }
  return rows;
}

function tabCount(results: SearchResults, key: SearchTab) {
  if (key === 'all') {
    return (
      results.users.length +
      results.posts.length +
      results.reels.length +
      results.ideas.length +
      results.stories.length +
      results.bottles.length +
      results.shop.length +
      results.challenges.length
    );
  }
  return results[key].length;
}

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { t, isRTL } = useLocale();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTab>('all');
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    setQuery(trimmed);
    Keyboard.dismiss();
    if (!trimmed) {
      setResults(EMPTY);
      setHasMore(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await api.search(trimmed);
      const next = {
        users: data.users || [],
        posts: data.posts || [],
        reels: data.reels || [],
        ideas: data.ideas || [],
        stories: data.stories || [],
        bottles: data.bottles || [],
        shop: data.shop || [],
        challenges: data.challenges || [],
      };
      setResults(next);
      const firstWithResults = TAB_META.find((item) => item.key !== 'all' && next[item.key].length > 0);
      if (firstWithResults) setTab(firstWithResults.key);
      else setTab('all');
      setHasMore(false);
    } catch {
      setResults(EMPTY);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query || tab === 'all') return;
    const list = results[tab];
    setHasMore(Array.isArray(list) && list.length >= 5);
  }, [tab, query, results]);

  const rows = useMemo(() => flatten(results, tab, t), [results, tab, t]);
  const total = tabCount(results, 'all');
  const subtitle = query
    ? t('search.resultsForQuery', {
        count: t(total === 1 ? 'search.resultCount' : 'search.resultCountPlural', { count: total }),
        query,
      })
    : t('search.exploreCosonova');

  const openRow = (row: ResultRow) => {
    switch (row.kind) {
      case 'users':
        openProfile(navigation, row.subtitle.replace(/^@/, ''));
        break;
      case 'posts':
        navigation.navigate('PostDetail', { postId: row.id });
        break;
      case 'reels':
        navigation.navigate('Reels');
        break;
      case 'ideas':
        navigation.navigate('BazaarDetail', { ideaId: row.id });
        break;
      case 'stories':
        navigation.navigate('ForgeDetail', { storyId: row.id });
        break;
      case 'challenges':
        navigation.navigate('Lab');
        break;
      case 'shop':
        navigation.navigate('ShopProduct', { productId: row.id });
        break;
      case 'bottles':
        navigation.navigate('Bottles', { bottleId: row.id });
        break;
      default:
        break;
    }
  };

  const loadMore = async () => {
    if (tab === 'all' || !query || !PAGINATED.includes(tab) || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const offset = results[tab].length;
      const page = await api.search(query, { category: tab, offset, limit: 20 });
      const next = Array.isArray(page.results) ? page.results : [];
      setResults((prev) => ({
        ...prev,
        [tab]: [...prev[tab], ...next],
      }));
      setHasMore(Boolean(page.has_more));
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  };

  const visibleTabs = query
    ? TAB_META.filter((item) => item.key === 'all' || tabCount(results, item.key) > 0)
    : TAB_META;

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <WorldHeader title={t('search.pageTitle')} subtitle={subtitle} onBack={() => navigation.goBack()} />

          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                borderColor: colors.border,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
          >
            <Pressable
              onPress={() => void runSearch(draft)}
              accessibilityRole="button"
              accessibilityLabel={t('common.search')}
              hitSlop={8}
              style={styles.iconHit}
            >
              <Ionicons name="search-outline" size={20} color={colors.primary} />
            </Pressable>
            <TextInput
              style={[
                styles.input,
                { color: colors.text, textAlign: isRTL ? 'right' : 'left' },
              ]}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('search.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => void runSearch(draft)}
              accessibilityLabel={t('search.searchPlaceholder')}
            />
            {draft ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('search.clearSearch')}
                hitSlop={10}
                onPress={() => {
                  setDraft('');
                  setQuery('');
                  setResults(EMPTY);
                  setError(false);
                  setTab('all');
                }}
                style={styles.iconHit}
              >
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.tabsWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.tabs, isRTL && { flexDirection: 'row-reverse' }]}
            >
              {visibleTabs.map((item) => {
                const selected = tab === item.key;
                const count = tabCount(results, item.key);
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityLabel={t(item.labelKey)}
                    accessibilityState={{ selected }}
                    onPress={() => setTab(item.key)}
                    style={({ pressed }) => [
                      styles.tab,
                      {
                        backgroundColor: selected
                          ? isDark
                            ? 'rgba(196,181,253,0.18)'
                            : 'rgba(124,58,237,0.12)'
                          : isDark
                            ? 'rgba(255,255,255,0.04)'
                            : '#FFFFFF',
                        borderColor: selected ? colors.primary : colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={14}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={{
                        color: selected ? colors.primary : colors.text,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {t(item.labelKey)}
                    </Text>
                    {query ? (
                      <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '600' }}>{count}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{t('search.loading')}</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.10)' }]}>
                <Ionicons name="cloud-offline-outline" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('search.loadError')}</Text>
              <Pressable
                onPress={() => void runSearch(draft || query)}
                style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.retryText}>{t('search.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              style={styles.flex}
              data={rows}
              keyExtractor={(item) => item.key}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.list}
              ListEmptyComponent={
                <View style={styles.center}>
                  <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.10)' }]}>
                    <Ionicons name={query ? 'search-outline' : 'planet-outline'} size={28} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {query ? t('search.noResults', { query }) : t('search.startTyping')}
                  </Text>
                  <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
                    {query ? t('search.noResultsHint') : t('search.startTypingHint')}
                  </Text>
                </View>
              }
              ListFooterComponent={
                tab !== 'all' && hasMore && query ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('search.viewMore')}
                    onPress={() => void loadMore()}
                    style={({ pressed }) => [
                      styles.moreBtn,
                      { backgroundColor: colors.primary, opacity: pressed || loadingMore ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={styles.retryText}>
                      {loadingMore ? t('search.loadingMore') : t('search.viewMore')}
                    </Text>
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => {
                const meta = TAB_META.find((entry) => entry.key === item.kind);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item.title}
                    onPress={() => openRow(item)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: isDark ? 'rgba(26,22,48,0.88)' : '#FFFFFF',
                        borderColor: colors.border,
                        opacity: pressed ? 0.88 : 1,
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      },
                    ]}
                  >
                    {item.kind === 'users' ? (
                      <Avatar uri={mediaUrl(item.avatar) || undefined} name={item.title} size="md" />
                    ) : (
                      <View
                        style={[
                          styles.kindChip,
                          { backgroundColor: isDark ? 'rgba(196,181,253,0.14)' : 'rgba(124,58,237,0.10)' },
                        ]}
                      >
                        <Ionicons name={meta?.icon || 'ellipse-outline'} size={18} color={colors.primary} />
                      </View>
                    )}
                    <View style={styles.rowBody}>
                      <View
                        style={[
                          styles.kindPill,
                          { backgroundColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.08)' },
                        ]}
                      >
                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: '800' }}>
                          {t(meta?.labelKey || 'search.all')}
                        </Text>
                      </View>
                      <Text
                        style={[styles.rowTitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 12, textAlign: isRTL ? 'right' : 'left' }}
                        numberOfLines={1}
                      >
                        {item.subtitle}
                      </Text>
                    </View>
                    <Ionicons
                      name={isRTL ? 'chevron-back' : 'chevron-forward'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </Pressable>
                );
              }}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  searchBar: {
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    minHeight: 52,
    gap: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  iconHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrap: {
    height: 48,
    marginBottom: 8,
  },
  tabs: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  row: {
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  kindChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 8,
  },
  moreBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: '#fff', fontWeight: '700' },
});
