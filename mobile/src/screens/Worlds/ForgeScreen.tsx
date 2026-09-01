import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
  WorldPill,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import { ForgeCreateModal, ForgeDeleteDialog, ForgeEditModal, ForgeFeaturedCard, ForgeSpotlightCard, ForgeStoryCard } from './forgeParts';
import {
  FORGE_GENRES,
  FORGE_TABS,
  asForgeStories,
  useForgePalette,
  type ForgeStory,
} from '@/lib/forge';

const MY_KINDS = [
  { key: 'all', labelKey: 'forge.myAll' },
  { key: 'owned', labelKey: 'forge.myOwned' },
  { key: 'saved', labelKey: 'forge.mySaved' },
  { key: 'collaborating', labelKey: 'forge.myCollaborating' },
] as const;

export default function ForgeScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useForgePalette(isDark);
  const { t } = useLocale();
  const [tab, setTab] = useState<(typeof FORGE_TABS)[number]['key']>('trending');
  const [genre, setGenre] = useState<(typeof FORGE_GENRES)[number]['key']>('all');
  const [myKind, setMyKind] = useState<(typeof MY_KINDS)[number]['key']>('all');
  const [stories, setStories] = useState<ForgeStory[]>([]);
  const [featured, setFeatured] = useState<ForgeStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ForgeStory | null>(null);
  const [deleting, setDeleting] = useState<ForgeStory | null>(null);

  const openStory = (id: number) => navigation.navigate('ForgeDetail', { storyId: id });

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(false);
    try {
      const data =
        tab === 'my'
          ? await api.getMyForgeStories(myKind)
          : await api.getForgeStories({
              ordering: tab === 'new' ? 'new' : 'trending',
              genre,
              status: tab === 'completed' ? 'completed' : 'all',
            });
      setStories(asForgeStories(data));
    } catch {
      setStories([]);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, genre, myKind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        setFeatured(asForgeStories(await api.getFeaturedForgeStories()));
      } catch {
        setFeatured([]);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter((s) =>
      `${s.title} ${s.premise} ${s.genre} ${s.genre_display || ''}`.toLowerCase().includes(q),
    );
  }, [search, stories]);

  const spotlight = featured[0] || filtered[0] || stories[0] || null;

  return (
    <WorldBackdrop tone="story">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader title={t('forge.title')} subtitle={t('forge.eyebrow')} tone="story" onBack={() => navigation.goBack()} />
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />}
          ListHeaderComponent={
            <>
              <WorldHero
                tone="story"
                eyebrow={t('forge.eyebrow')}
                title={t('forge.title')}
                body={t('forge.subtitle')}
                action={
                  <WorldPrimaryButton label={t('forge.startStory')} tone="story" onPress={() => setCreateOpen(true)} />
                }
              />

              <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
                <Text style={[styles.panelTitle, { color: C.text }]}>{t('forge.activeStories')}</Text>
                <Text style={[styles.panelHint, { color: C.text2 }]}>{t('forge.activeStoriesHint')}</Text>
                <View style={[styles.searchBar, { backgroundColor: C.card2, borderColor: C.line }]}>
                  <Ionicons name="search" size={16} color={C.text2} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder={t('forge.searchPlaceholder')}
                    placeholderTextColor={C.text2}
                    style={[styles.searchInput, { color: C.text }]}
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {FORGE_TABS.map((tabDef) => (
                    <WorldPill key={tabDef.key} label={t(tabDef.labelKey)} active={tab === tabDef.key} tone="story" onPress={() => setTab(tabDef.key)} />
                  ))}
                </ScrollView>
                {tab === 'my' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {MY_KINDS.map((k) => (
                      <WorldPill key={k.key} label={t(k.labelKey)} active={myKind === k.key} tone="story" onPress={() => setMyKind(k.key)} />
                    ))}
                  </ScrollView>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {FORGE_GENRES.map((g) => (
                    <WorldPill key={g.key} label={t(g.labelKey)} active={genre === g.key} tone="story" onPress={() => setGenre(g.key)} />
                  ))}
                </ScrollView>
              </View>

              {spotlight ? <ForgeSpotlightCard story={spotlight} onOpen={() => openStory(spotlight.id)} /> : null}

              {featured.length > 0 ? (
                <>
                  <View style={styles.sectionHead}>
                    <Text style={[styles.sectionTitle, { color: C.text }]}>{t('forge.featuredThisWeek')}</Text>
                    <Text style={[styles.sectionHint, { color: C.text2 }]}>{t('forge.curatedPicks')}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featRow}>
                    {featured.map((s) => (
                      <ForgeFeaturedCard key={s.id} story={s} onOpen={() => openStory(s.id)} />
                    ))}
                  </ScrollView>
                </>
              ) : null}

              <View style={styles.sectionHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.sectionTitle, { color: C.text }]}>{t('forge.storyBoard')}</Text>
                  <Text style={[styles.sectionHint, { color: C.text2 }]}>{t('forge.storyBoardHint')}</Text>
                </View>
                <Text style={[styles.countChip, { backgroundColor: C.card2, color: C.brown }]}>
                  {filtered.length} {t('forge.storiesCount')}
                </Text>
              </View>
            </>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={C.brown} style={{ marginTop: 24 }} />
            ) : loadError ? (
              <View style={styles.center}>
                <Text style={[styles.emptyTitle, { color: C.text }]}>{t('forge.couldNotLoad')}</Text>
                <Pressable onPress={() => void load()}><Text style={[styles.retry, { color: C.brown }]}>{t('common.tryAgain')}</Text></Pressable>
              </View>
            ) : (
              <Text style={[styles.emptyBody, { color: C.text2 }]}>{t('forge.noMatch')}</Text>
            )
          }
          renderItem={({ item }) => (
            <ForgeStoryCard
              story={item}
              onOpen={() => openStory(item.id)}
              onEdit={() => setEditing(item)}
              onDelete={() => setDeleting(item)}
            />
          )}
        />
        <ForgeCreateModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            void load(true);
            if (id) openStory(id);
          }}
        />
        {editing ? <ForgeEditModal story={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load(true); }} /> : null}
        {deleting ? <ForgeDeleteDialog story={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); void load(true); }} /> : null}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48, gap: 14 },
  panel: { borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 2 },
  panelTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  panelHint: { fontSize: 13, lineHeight: 19, fontWeight: '500', marginTop: 4, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 44,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8, fontWeight: '500' },
  chips: { gap: 8, paddingBottom: 8 },
  featRow: { gap: 12, paddingBottom: 4, paddingRight: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6, marginBottom: 2, gap: 10 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  sectionHint: { fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 3 },
  countChip: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: '600' },
  center: { padding: 28, alignItems: 'center' },
  emptyTitle: { fontWeight: '600', fontSize: 16, marginBottom: 8 },
  emptyBody: { textAlign: 'center', padding: 24, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  retry: { fontWeight: '600', fontSize: 14 },
});
