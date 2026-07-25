import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api, type OrbitList } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import PostCard from '@/components/PostCard';
import type { Post } from '@/types';

export default function OrbitListsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'mine' | 'following'>('mine');
  const [lists, setLists] = useState<OrbitList[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [active, setActive] = useState<OrbitList | null>(null);
  const [feed, setFeed] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [memberId, setMemberId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await api.getOrbitLists(tab === 'following'));
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const openFeed = async (list: OrbitList) => {
    setActive(list);
    setFeedLoading(true);
    try {
      const page = await api.getOrbitListFeed(list.id, { limit: 20, offset: 0 });
      setFeed((page.results || []) as Post[]);
      const detail = await api.getOrbitList(list.id);
      setActive(detail);
    } catch {
      setFeed([]);
    } finally {
      setFeedLoading(false);
    }
  };

  const createList = async () => {
    if (!title.trim()) return;
    try {
      const created = await api.createOrbitList({
        title: title.trim(),
        is_private: isPrivate,
      });
      setTitle('');
      setIsPrivate(false);
      setTab('mine');
      await load();
      void openFeed(created);
    } catch {
      Alert.alert('Error', 'Could not create Orbit List.');
    }
  };

  const addMember = async () => {
    if (!active || !memberId.trim()) return;
    try {
      const updated = await api.addOrbitListMember(active.id, Number(memberId));
      setActive(updated);
      setMemberId('');
    } catch {
      Alert.alert('Error', 'Could not add member.');
    }
  };

  const removeList = (list: OrbitList) => {
    Alert.alert('Delete list?', list.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await api.deleteOrbitList(list.id);
              if (active?.id === list.id) {
                setActive(null);
                setFeed([]);
              }
              await load();
            } catch {
              Alert.alert('Error', 'Could not delete list.');
            }
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Orbit Lists</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.createRow}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="New list title"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <View style={styles.privateRow}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Private</Text>
          <Switch value={isPrivate} onValueChange={setIsPrivate} />
        </View>
        <Pressable onPress={() => void createList()} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Create</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['mine', 'following'] as const).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && { backgroundColor: colors.primary }]}
          >
            <Text style={{ color: tab === key ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
              {key === 'mine' ? 'My lists' : 'Following'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => String(item.id)}
          style={{ maxHeight: 160 }}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, padding: 16 }}>No Orbit Lists yet.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => void openFeed(item)}
              onLongPress={() => (tab === 'mine' ? removeList(item) : undefined)}
              style={[
                styles.listChip,
                {
                  backgroundColor: active?.id === item.id ? 'rgba(124,58,237,0.2)' : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {item.member_count} members{item.is_private ? ' · private' : ''}
              </Text>
            </Pressable>
          )}
        />
      )}

      {active && tab === 'mine' ? (
        <View style={[styles.memberBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>{active.title} members</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={memberId}
              onChangeText={setMemberId}
              placeholder="User id"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border }]}
            />
            <Pressable onPress={() => void addMember()} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>
            </Pressable>
          </View>
          {(active.members || []).slice(0, 6).map((m) => (
            <Text key={m.id} style={{ color: colors.textSecondary, marginTop: 6 }}>
              @{m.username}
            </Text>
          ))}
        </View>
      ) : null}

      {feedLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            active ? (
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 24 }}>
                No public signals from members yet.
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
              onComment={() => navigation.navigate('PostDetail', { postId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '800' },
  createRow: { padding: 12, gap: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  privateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  createBtn: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e5e7eb' },
  listChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 120,
  },
  memberBox: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
});
