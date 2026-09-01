import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api, type OrbitList } from '@/api/client';
import PostCard from '@/components/PostCard';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';
import {
  asOrbitList,
  asOrbitLists,
  asOrbitPost,
  orbitFieldError,
  ORBIT_TABS,
  useOrbitListsPalette,
  type OrbitTab,
} from '@/lib/orbitLists';
import type { Post } from '@/types';

export default function OrbitListsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useOrbitListsPalette(isDark);
  const { t } = useLocale();

  const [tab, setTab] = useState<OrbitTab>('mine');
  const [lists, setLists] = useState<OrbitList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [feed, setFeed] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Array<{ id: number; username: string }>>([]);
  const [addingMember, setAddingMember] = useState(false);
  const [followingId, setFollowingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const active = lists.find((list) => list.id === activeId) || null;

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setLists(asOrbitLists(await api.getOrbitLists(tab)));
    } catch {
      setLists([]);
      setError(t('signal.loadListsFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openFeed = async (listId: number) => {
    setActiveId(listId);
    setFeedLoading(true);
    try {
      const page = await api.getOrbitListFeed(listId, { limit: 20, offset: 0 });
      setFeed((page.results || []).map(asOrbitPost).filter((row): row is Post => Boolean(row)));
      const detail = asOrbitList(await api.getOrbitList(listId));
      if (detail) {
        setLists((prev) => prev.map((row) => (row.id === detail.id ? { ...row, ...detail } : row)));
      }
    } catch {
      setFeed([]);
    } finally {
      setFeedLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      const created = asOrbitList(
        await api.createOrbitList({
          title: title.trim(),
          description: description.trim(),
          is_private: isPrivate,
        }),
      );
      setTitle('');
      setDescription('');
      setIsPrivate(false);
      if (tab !== 'mine') setTab('mine');
      else await load(true);
      if (created) {
        setActiveId(created.id);
        void openFeed(created.id);
      }
    } catch (err) {
      setError(orbitFieldError(err, t('signal.loadListsFailed')));
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    const q = memberQuery.trim();
    if (q.length < 2 || /^\d+$/.test(q)) {
      setMemberResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const users = await api.searchUsers(q);
        setMemberResults(users.slice(0, 8));
      } catch {
        setMemberResults([]);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [memberQuery]);

  const addMember = async (userId: number) => {
    if (!activeId) return;
    setAddingMember(true);
    setError('');
    try {
      const updated = asOrbitList(await api.addOrbitListMember(activeId, userId));
      if (updated) {
        setLists((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
        setMemberQuery('');
        setMemberResults([]);
      }
    } catch (err) {
      setError(orbitFieldError(err, t('signal.addMemberFailed')));
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (!activeId) return;
    setError('');
    try {
      await api.removeOrbitListMember(activeId, userId);
      setLists((prev) =>
        prev.map((row) =>
          row.id === activeId
            ? {
                ...row,
                members: (row.members || []).filter((member) => member.id !== userId),
                member_count: Math.max(0, (row.member_count || 1) - 1),
              }
            : row,
        ),
      );
    } catch (err) {
      setError(orbitFieldError(err, t('signal.removeMemberFailed')));
    }
  };

  const toggleFollow = async (listId: number) => {
    if (followingId) return;
    setFollowingId(listId);
    setError('');
    try {
      const data = await api.toggleFollowOrbitList(listId);
      const following = Boolean(data?.following);
      if (tab === 'discover') {
        setLists((prev) => prev.map((row) => (row.id === listId ? { ...row, is_following: following } : row)));
      } else {
        setLists((prev) => prev.filter((row) => row.id !== listId));
        if (activeId === listId) {
          setActiveId(null);
          setFeed([]);
        }
      }
    } catch (err) {
      setError(orbitFieldError(err, t('signal.followListFailed')));
    } finally {
      setFollowingId(null);
    }
  };

  const removeList = (list: OrbitList) => {
    Alert.alert(t('signal.deleteList'), list.title, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setError('');
            try {
              await api.deleteOrbitList(list.id);
              setLists((prev) => prev.filter((row) => row.id !== list.id));
              if (activeId === list.id) {
                setActiveId(null);
                setFeed([]);
              }
            } catch (err) {
              setError(orbitFieldError(err, t('signal.deleteListFailed')));
            }
          })();
        },
      },
    ]);
  };

  const numericMemberId = Number(memberQuery.trim());
  const canAddById = Number.isFinite(numericMemberId) && numericMemberId > 0;

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('signal.orbitListsTitle')}
          subtitle={t('signal.orbitListsHint')}
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
          <View style={[styles.form, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={[styles.formTitle, { color: C.text2 }]}>{t('signal.createList')}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('signal.listTitle')}
              placeholderTextColor={C.text2}
              style={[styles.input, { backgroundColor: C.card2, color: C.text, borderColor: C.line }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('signal.listDesc')}
              placeholderTextColor={C.text2}
              style={[styles.input, { backgroundColor: C.card2, color: C.text, borderColor: C.line }]}
            />
            <View style={styles.formFooter}>
              <Pressable onPress={() => setIsPrivate((prev) => !prev)} style={styles.switchRow}>
                <Switch
                  value={isPrivate}
                  onValueChange={setIsPrivate}
                  trackColor={{ false: C.card, true: C.brown }}
                  thumbColor="#fff"
                />
                <Text style={[styles.switchLabel, { color: C.text2 }]}>{t('signal.privateList')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleCreate()}
                disabled={creating || !title.trim()}
                style={[styles.primary, { backgroundColor: C.brownDk, opacity: creating || !title.trim() ? 0.5 : 1 }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryText}>{t('signal.createList')}</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {ORBIT_TABS.map((item) => {
              const selected = tab === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setTab(item.key);
                    setActiveId(null);
                    setFeed([]);
                  }}
                  style={[styles.tab, { backgroundColor: selected ? C.brown : C.white }]}
                >
                  <Text style={[styles.tabText, { color: selected ? '#fff' : C.text2 }]}>{t(item.labelKey)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {error ? <Text style={[styles.error, { color: C.danger }]}>{error}</Text> : null}

          {loading && lists.length === 0 ? (
            <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
          ) : lists.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: C.card2 }]}>
              <Text style={[styles.hint, { color: C.text2 }]}>
                {tab === 'discover' ? t('signal.noDiscoverLists') : t('signal.emptyLists')}
              </Text>
            </View>
          ) : (
            <View style={styles.listCol}>
              {lists.map((list) => {
                const selected = list.id === activeId;
                return (
                  <View
                    key={list.id}
                    style={[
                      styles.listCard,
                      {
                        backgroundColor: selected ? `${C.brown}22` : C.white,
                        borderColor: selected ? C.brown : C.line,
                      },
                    ]}
                  >
                    <Pressable onPress={() => void openFeed(list.id)}>
                      <Text style={[styles.listTitle, { color: C.text }]}>{list.title}</Text>
                      <Text style={[styles.listMeta, { color: C.text2 }]}>
                        {list.member_count} {t('signal.members')}
                        {list.is_private ? ` · ${t('signal.privateList')}` : ''}
                        {tab === 'discover' && list.owner?.username ? ` · @${list.owner.username}` : ''}
                      </Text>
                    </Pressable>
                    {tab === 'mine' ? (
                      <Pressable onPress={() => removeList(list)} style={styles.listAction}>
                        <Ionicons name="trash-outline" size={14} color={C.danger} />
                        <Text style={[styles.actionText, { color: C.danger }]}>{t('signal.deleteList')}</Text>
                      </Pressable>
                    ) : null}
                    {tab === 'following' ? (
                      <Pressable
                        onPress={() => void toggleFollow(list.id)}
                        disabled={followingId === list.id}
                        style={styles.listAction}
                      >
                        <Text style={[styles.actionText, { color: C.danger }]}>{t('signal.unfollowList')}</Text>
                      </Pressable>
                    ) : null}
                    {tab === 'discover' ? (
                      <Pressable
                        onPress={() => void toggleFollow(list.id)}
                        disabled={followingId === list.id}
                        style={styles.listAction}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            { color: list.is_following ? C.text2 : C.brownDk, fontWeight: '800' },
                          ]}
                        >
                          {list.is_following ? t('signal.unfollowList') : t('signal.followList')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )}

          {active && tab === 'mine' ? (
            <View style={[styles.memberBox, { backgroundColor: C.white, borderColor: C.line }]}>
              <Text style={[styles.listTitle, { color: C.text }]}>{active.title}</Text>
              <Text style={[styles.listMeta, { color: C.text2, marginBottom: 12 }]}>
                {active.description || '—'}
              </Text>
              <View style={styles.addRow}>
                <TextInput
                  value={memberQuery}
                  onChangeText={setMemberQuery}
                  placeholder={t('signal.searchMembers')}
                  placeholderTextColor={C.text2}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                  style={[styles.input, { flex: 1, backgroundColor: C.card2, color: C.text, borderColor: C.line }]}
                />
                {canAddById ? (
                  <Pressable
                    onPress={() => void addMember(numericMemberId)}
                    disabled={addingMember}
                    style={[styles.ghost, { backgroundColor: C.card2 }]}
                  >
                    <Ionicons name="person-add-outline" size={16} color={C.brownDk} />
                    <Text style={[styles.ghostText, { color: C.text }]}>{t('signal.add')}</Text>
                  </Pressable>
                ) : null}
              </View>
              {memberResults.map((user) => (
                <Pressable
                  key={user.id}
                  onPress={() => void addMember(user.id)}
                  disabled={addingMember}
                  style={styles.memberRow}
                >
                  <Text style={[styles.memberName, { color: C.text }]}>@{user.username}</Text>
                  <Text style={[styles.actionText, { color: C.brownDk, fontWeight: '800' }]}>{t('signal.add')}</Text>
                </Pressable>
              ))}
              {(active.members || []).map((member) => (
                <View key={member.id} style={styles.memberRow}>
                  <Pressable onPress={() => openProfile(navigation, member.username)}>
                    <Text style={[styles.memberName, { color: C.text }]}>@{member.username}</Text>
                  </Pressable>
                  <Pressable onPress={() => void removeMember(member.id)}>
                    <Text style={[styles.actionText, { color: C.danger }]}>{t('signal.remove')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {feedLoading ? (
            <ActivityIndicator color={C.brown} style={{ marginTop: 16 }} />
          ) : !activeId ? (
            <Text style={[styles.hint, { color: C.text2, marginTop: 8 }]}>{t('signal.openFeed')}</Text>
          ) : feed.length === 0 ? (
            <Text style={[styles.hint, { color: C.text2, marginTop: 8 }]}>{t('signal.noFeed')}</Text>
          ) : (
            <View style={styles.feed}>
              {feed.map((post) => (
                <PostCard
                  key={String(post.id)}
                  post={post}
                  onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                  onComment={() => navigation.navigate('PostDetail', { postId: post.id })}
                  onUserPress={() => openProfile(navigation, post.user?.username)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  form: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10, marginBottom: 14 },
  formTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  formFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 13, fontWeight: '600' },
  primary: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  tabs: { gap: 8, paddingBottom: 14 },
  tab: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabText: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 13, marginBottom: 12 },
  hint: { fontSize: 14, textAlign: 'center' },
  empty: { borderRadius: 18, padding: 22, marginBottom: 12 },
  listCol: { gap: 8, marginBottom: 14 },
  listCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  listTitle: { fontSize: 15, fontWeight: '800' },
  listMeta: { fontSize: 12, marginTop: 4 },
  listAction: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  actionText: { fontSize: 12, fontWeight: '700' },
  memberBox: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  ghost: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ghostText: { fontSize: 13, fontWeight: '700' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  memberName: { fontSize: 14, fontWeight: '700' },
  feed: { gap: 12 },
});
