import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import PostCard from '@/components/PostCard';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';
import type { ReactionType } from '@/lib/reactions';
import {
  asSavedFolders,
  asSavedIdea,
  asSavedItems,
  asSavedPost,
  SAVED_TABS,
  useSavedPalette,
  visibleSavedItems,
  type SavedCollectionKey,
  type SavedFolder,
  type SavedItem,
} from '@/lib/saved';
import { FolderChip, SavedIdeaCard, SavedSimpleCard } from './savedParts';

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useSavedPalette(isDark);
  const { t, locale } = useLocale();

  const [active, setActive] = useState<SavedCollectionKey>('all');
  const [activeFolder, setActiveFolder] = useState<number | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [folders, setFolders] = useState<SavedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [updatingFolderId, setUpdatingFolderId] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      if (activeFolder != null) {
        const rows = await api.getSavedPosts(activeFolder);
        setItems(
          asSavedItems(
            (Array.isArray(rows) ? rows : []).map((row) => ({
              ...(row as Record<string, unknown>),
              saved_type: 'post',
              saved_id: `post_${(row as { id?: number }).id}`,
            })),
          ),
        );
      } else {
        setItems(asSavedItems(await api.getSavedItems(active)));
      }
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [active, activeFolder]);

  const loadFolders = useCallback(async () => {
    try {
      setFolders(asSavedFolders(await api.getCollections()));
    } catch {
      setFolders([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void loadFolders();
    }, [load, loadFolders]),
  );

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(''), 3500);
    return () => clearTimeout(timer);
  }, [actionError]);

  const visible = useMemo(
    () => visibleSavedItems(items, active, activeFolder),
    [items, active, activeFolder],
  );

  const handleUnsave = async (savedId: string) => {
    const prev = items;
    setItems((rows) => rows.filter((item) => item.saved_id !== savedId));
    try {
      await api.unsaveItem(savedId);
    } catch {
      setItems(prev);
      setActionError(t('saved.loadError'));
    }
  };

  const handleUnsaveIdea = async (ideaId: number | string) => {
    const savedId = `idea_${ideaId}`;
    const prev = items;
    setItems((rows) => rows.filter((item) => item.saved_id !== savedId));
    try {
      await api.toggleIdeaSave(ideaId);
    } catch {
      setItems(prev);
      setActionError(t('saved.unsaveIdeaFailed'));
    }
  };

  const toggleFolderPublic = async (folder: SavedFolder) => {
    if (updatingFolderId) return;
    setUpdatingFolderId(folder.id);
    try {
      const updated = await api.updateCollection(folder.id, { is_public: !folder.is_public });
      setFolders((rows) => rows.map((row) => (row.id === folder.id ? { ...row, ...updated } : row)));
      setActionError('');
    } catch {
      setActionError(t('saved.toggleVisibilityFailed'));
    } finally {
      setUpdatingFolderId(null);
    }
  };

  const handleReact = (item: SavedItem, type: ReactionType) => {
    const post = asSavedPost(item);
    if (!post) return;
    const wasSame = post.my_reaction === type;
    setItems((prev) =>
      prev.map((row) =>
        row.saved_id === item.saved_id
          ? {
              ...row,
              my_reaction: wasSame ? null : type,
              likes_count: wasSame
                ? Math.max(0, Number(row.likes_count ?? 0) - 1)
                : Number(row.likes_count ?? 0) + (row.my_reaction ? 0 : 1),
            }
          : row,
      ),
    );
    api
      .reactToPost(post.id, wasSame ? null : type)
      .then((data) => {
        setItems((prev) =>
          prev.map((row) =>
            row.saved_id === item.saved_id
              ? {
                  ...row,
                  my_reaction: data.my_reaction,
                  likes_count: data.total,
                  reaction_counts: data.reaction_counts,
                }
              : row,
          ),
        );
      })
      .catch(() => void load());
  };

  const renderItem = ({ item }: { item: SavedItem }) => {
    if (item.saved_type === 'idea') {
      const idea = asSavedIdea(item);
      if (!idea) return null;
      return (
        <SavedIdeaCard
          idea={idea}
          C={C}
          t={t}
          locale={locale}
          onOpen={() => navigation.navigate('BazaarDetail', { ideaId: idea.id })}
          onUnsave={() => void handleUnsaveIdea(idea.id)}
        />
      );
    }
    if (item.saved_type === 'post') {
      const post = asSavedPost(item);
      if (!post) return null;
      return (
        <View style={styles.cardWrap}>
          <PostCard
            post={post}
            onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
            onComment={() => navigation.navigate('PostDetail', { postId: post.id })}
            onUserPress={() => openProfile(navigation, post.user?.username)}
            onReact={(type) => handleReact(item, type)}
            onSave={() => void handleUnsave(item.saved_id)}
          />
        </View>
      );
    }
    return (
      <SavedSimpleCard
        item={item}
        C={C}
        t={t}
        onOpen={() => {
          if (item.saved_type === 'reel') {
            navigation.navigate('Reels', { focusId: item.id });
          } else {
            navigation.navigate('StoryMap', { storyId: item.id });
          }
        }}
        onUnsave={() => void handleUnsave(item.saved_id)}
      />
    );
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('saved.header')}
          subtitle={t('saved.subtitle')}
          tone="vault"
          onBack={() => navigation.goBack()}
          right={
            <Pressable
              onPress={() => void load(true)}
              disabled={loading}
              hitSlop={8}
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <Ionicons name="refresh-outline" size={20} color={C.muted} />
            </Pressable>
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {SAVED_TABS.map((tab) => {
            const selected = active === tab.key && activeFolder == null;
            return (
              <Pressable
                key={tab.key}
                disabled={activeFolder != null}
                onPress={() => {
                  setActive(tab.key);
                  setActiveFolder(null);
                }}
                style={[
                  styles.tab,
                  {
                    backgroundColor: selected ? C.accent : C.chipBg,
                    opacity: activeFolder != null ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={[styles.tabText, { color: selected ? '#fff' : C.muted }]}>
                  {t(tab.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {folders.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.folders}
          >
            <Text style={[styles.folderLabel, { color: C.muted }]}>{t('collections.title')}:</Text>
            <Pressable
              onPress={() => setActiveFolder(null)}
              style={[styles.tab, { backgroundColor: activeFolder == null ? C.bazaar : C.chipBg }]}
            >
              <Text style={[styles.tabText, { color: activeFolder == null ? '#fff' : C.muted }]}>
                {t('collections.all')}
              </Text>
            </Pressable>
            {folders.map((folder) => (
              <FolderChip
                key={folder.id}
                folder={folder}
                active={activeFolder === folder.id}
                C={C}
                t={t}
                updating={updatingFolderId === folder.id}
                onSelect={() => setActiveFolder(folder.id)}
                onTogglePublic={() => void toggleFolderPublic(folder)}
                onOpenBoard={() => navigation.navigate('PublicBoard', { collectionId: folder.id })}
              />
            ))}
          </ScrollView>
        ) : null}

        {actionError ? (
          <View style={[styles.banner, { backgroundColor: `${C.danger}18`, borderColor: `${C.danger}33` }]}>
            <Text style={[styles.bannerText, { color: C.danger }]}>{actionError}</Text>
          </View>
        ) : null}

        {loading && items.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.accent} />
            <Text style={[styles.hint, { color: C.muted }]}>{t('saved.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[styles.hint, { color: C.muted }]}>{t('saved.loadError')}</Text>
            <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.accent }]}>
              <Text style={styles.retryText}>{t('saved.tryAgain')}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.saved_id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.accent} />
            }
            ListEmptyComponent={
              <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]}>
                <Text style={styles.emoji}>🔖</Text>
                <Text style={[styles.emptyTitle, { color: C.text }]}>{t('saved.emptyTitle')}</Text>
                <Text style={[styles.emptyBody, { color: C.muted }]}>{t('saved.emptyBody')}</Text>
                <Pressable
                  onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
                  style={[styles.retry, { backgroundColor: C.accent }]}
                >
                  <Text style={styles.retryText}>{t('saved.exploreFeed')}</Text>
                </Pressable>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 16, paddingBottom: 8, gap: 8, alignItems: 'center' },
  folders: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, alignItems: 'center' },
  folderLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabText: { fontSize: 13, fontWeight: '700' },
  banner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  bannerText: { fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 12, paddingBottom: 36 },
  cardWrap: { marginBottom: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  hint: { fontSize: 14, marginTop: 12, textAlign: 'center' },
  retry: { marginTop: 14, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { marginTop: 20, borderRadius: 20, borderWidth: 1, padding: 28, alignItems: 'center' },
  emoji: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyBody: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 },
});
