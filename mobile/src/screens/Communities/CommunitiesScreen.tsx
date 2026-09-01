import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import { asCommunities, useCommunitiesPalette, type CommunityRow } from '@/lib/communities';

type SortKey = 'popular' | 'trending';

export default function CommunitiesScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useCommunitiesPalette(isDark);
  const { t } = useLocale();

  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrivacy, setNewPrivacy] = useState<'public' | 'private'>('public');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [joinBusy, setJoinBusy] = useState<string | null>(null);

  const load = useCallback(async (opts?: { q?: string; sort?: SortKey; refresh?: boolean }) => {
    const nextSort = opts?.sort ?? sort;
    const nextQ = opts?.q ?? query;
    if (opts?.refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const page = await api.getCommunities({
        q: nextQ.trim() || undefined,
        ordering: nextSort === 'trending' ? 'trending' : undefined,
        limit: 60,
      });
      setCommunities(asCommunities(page.results ?? page));
    } catch {
      setCommunities([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, sort]);

  useEffect(() => {
    const timer = setTimeout(() => void load({ q: query, sort }), 300);
    return () => clearTimeout(timer);
  }, [query, sort, load]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || createBusy) return;
    setCreateBusy(true);
    setCreateError('');
    try {
      const community = (await api.createCommunity({
        name,
        description: newDescription.trim(),
        privacy: newPrivacy,
      })) as CommunityRow;
      setNewName('');
      setNewDescription('');
      setNewPrivacy('public');
      setCreating(false);
      if (community?.slug) {
        navigation.navigate('CommunityDetail', { slug: community.slug });
      } else {
        void load({ refresh: true });
      }
    } catch {
      setCreateError(t('communities.createFailed'));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleJoin = async (item: CommunityRow) => {
    if (joinBusy || item.is_member || item.is_pending || item.is_banned) return;
    setJoinBusy(item.slug);
    try {
      const updated = await api.joinCommunity(item.slug);
      setCommunities((prev) =>
        prev.map((c) => (c.slug === item.slug ? { ...c, ...updated } : c)),
      );
    } catch {
      /* keep list */
    } finally {
      setJoinBusy(null);
    }
  };

  const membershipLabel = (item: CommunityRow) => {
    if (item.is_banned) return t('communities.banned');
    if (item.is_member) return t('communities.memberBadge');
    if (item.is_pending) return t('communities.pendingApproval');
    return item.privacy === 'private' ? t('communities.requestToJoin') : t('communities.join');
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('communities.title')}
          subtitle={t('nav.communities')}
          tone="vault"
          onBack={() => navigation.goBack()}
          right={
            <Pressable onPress={() => setCreating((v) => !v)} hitSlop={8} accessibilityLabel={t('communities.create')}>
              <Ionicons name="add" size={22} color={C.brown} />
            </Pressable>
          }
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {loading && communities.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.brown} />
              <Text style={{ color: C.text2, marginTop: 8 }}>{t('common.loading')}</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => void load({ refresh: true })} tintColor={C.brown} />
              }
            >
              <WorldHero
                tone="vault"
                title={t('communities.title')}
                body={t('communities.subtitle')}
                action={
                  <WorldPrimaryButton
                    label={t('communities.create')}
                    tone="vault"
                    onPress={() => setCreating(true)}
                  />
                }
              />

              {creating ? (
                <View style={[styles.createBox, { backgroundColor: C.white, borderColor: C.line }]}>
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={t('communities.namePlaceholder')}
                    placeholderTextColor={C.text2}
                    style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
                  />
                  <TextInput
                    value={newDescription}
                    onChangeText={setNewDescription}
                    placeholder={t('communities.descriptionPlaceholder')}
                    placeholderTextColor={C.text2}
                    multiline
                    style={[styles.input, styles.area, { color: C.text, borderColor: C.line, backgroundColor: C.card2 }]}
                  />
                  <View style={styles.privacyRow}>
                    {(['public', 'private'] as const).map((key) => (
                      <Pressable
                        key={key}
                        onPress={() => setNewPrivacy(key)}
                        style={[
                          styles.privacyBtn,
                          { backgroundColor: newPrivacy === key ? C.brownDk : C.card },
                        ]}
                      >
                        <Text style={{ color: newPrivacy === key ? '#fff' : C.text, fontWeight: '700' }}>
                          {key === 'public' ? t('communities.public') : t('communities.private')}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {createError ? <Text style={styles.error}>{createError}</Text> : null}
                  <View style={styles.createActions}>
                    <Pressable onPress={() => setCreating(false)} style={[styles.ghost, { backgroundColor: C.card }]}>
                      <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleCreate()}
                      disabled={createBusy || !newName.trim()}
                      style={[styles.primary, { backgroundColor: C.brownDk, opacity: createBusy || !newName.trim() ? 0.55 : 1 }]}
                    >
                      {createBusy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryText}>{t('communities.create')}</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={C.text2} style={styles.searchIcon} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('communities.searchPlaceholder')}
                  placeholderTextColor={C.text2}
                  style={[styles.search, { color: C.text, backgroundColor: C.white, borderColor: C.line }]}
                />
              </View>

              <View style={styles.sortRow}>
                {(['popular', 'trending'] as const).map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => setSort(key)}
                    style={[styles.sortChip, { backgroundColor: sort === key ? C.brownDk : C.card }]}
                  >
                    <Text style={{ color: sort === key ? '#fff' : C.text2, fontWeight: '800', fontSize: 13 }}>
                      {key === 'popular' ? t('communities.popular') : t('communities.trending')}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {error ? (
                <Pressable onPress={() => void load()} style={[styles.empty, { backgroundColor: C.card }]}>
                  <Text style={{ color: C.text, fontWeight: '700' }}>{t('communities.retry')}</Text>
                </Pressable>
              ) : communities.length === 0 ? (
                <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.line }]}>
                  <Text style={{ fontSize: 28 }}>🌌</Text>
                  <Text style={[styles.emptyTitle, { color: C.text }]}>{t('communities.empty')}</Text>
                  <WorldPrimaryButton label={t('communities.create')} tone="vault" onPress={() => setCreating(true)} />
                </View>
              ) : (
                communities.map((item) => {
                  const cover = item.cover_url ? mediaUrl(item.cover_url) : '';
                  const canJoin = !item.is_member && !item.is_pending && !item.is_banned;
                  return (
                    <Pressable
                      key={String(item.id)}
                      onPress={() => navigation.navigate('CommunityDetail', { slug: item.slug })}
                      style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}
                    >
                      {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : null}
                      <View style={styles.cardBody}>
                        <View style={styles.cardTop}>
                          <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.is_nsfw ? (
                            <Text style={[styles.nsfw, { color: C.brown }]}>{t('communities.nsfwBadge')}</Text>
                          ) : null}
                        </View>
                        {item.description ? (
                          <Text style={[styles.desc, { color: C.text2 }]} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                        <View style={styles.metaRow}>
                          <Text style={[styles.meta, { color: C.text2 }]}>
                            {t('communities.memberCount', { count: item.members_count ?? 0 })}
                            {' · '}
                            {item.privacy === 'private' ? t('communities.private') : t('communities.public')}
                          </Text>
                          {canJoin ? (
                            <Pressable
                              onPress={() => void handleJoin(item)}
                              disabled={joinBusy === item.slug}
                              style={[styles.join, { backgroundColor: C.brownDk }]}
                            >
                              <Text style={styles.joinText}>
                                {joinBusy === item.slug ? '…' : membershipLabel(item)}
                              </Text>
                            </Pressable>
                          ) : (
                            <Text style={[styles.badge, { color: item.is_banned ? '#F87171' : C.brownDk }]}>
                              {membershipLabel(item)}
                            </Text>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  createBox: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  area: { minHeight: 72, textAlignVertical: 'top' },
  privacyRow: { flexDirection: 'row', gap: 8 },
  privacyBtn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  error: { color: '#F87171', fontSize: 12, fontWeight: '600' },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  ghost: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  primary: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, minWidth: 88, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  searchWrap: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 14, top: 14, zIndex: 1 },
  search: { borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 38, fontSize: 14 },
  sortRow: { flexDirection: 'row', gap: 8 },
  sortChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  empty: { borderRadius: 18, borderWidth: 1, padding: 22, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', height: 92 },
  cardBody: { padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '800' },
  nsfw: { fontSize: 10, fontWeight: '800' },
  desc: { fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  meta: { flex: 1, fontSize: 12, fontWeight: '600' },
  join: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  joinText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  badge: { fontSize: 12, fontWeight: '800' },
});
