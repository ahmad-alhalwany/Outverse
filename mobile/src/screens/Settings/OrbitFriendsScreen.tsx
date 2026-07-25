import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';

type Friend = { id: number; username: string; avatar?: string | null };
type SearchUser = { id: number; username: string; name?: string; avatar?: string | null };

/** Inner orbit = Close Friends — who sees Orbit-only stories. */
export default function OrbitFriendsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getCloseFriends();
      setFriends(rows);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const users = await api.searchUsers(q);
        setResults(users.slice(0, 8));
      } catch {
        setResults([]);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  const add = async (friendId: number) => {
    setBusy(true);
    try {
      await api.addCloseFriend(friendId);
      setQuery('');
      setResults([]);
      await load();
    } catch {
      Alert.alert('Error', 'Could not add this person to your orbit.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (friendId: number) => {
    setBusy(true);
    try {
      await api.removeCloseFriend(friendId);
      await load();
    } catch {
      Alert.alert('Error', 'Could not remove from orbit.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Inner Orbit</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        People in your inner orbit see stories marked Orbit-only — your closest signals.
      </Text>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search people to add…"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.search,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          autoCapitalize="none"
        />
        {results.length > 0 ? (
          <View style={[styles.results, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {results.map((u) => (
              <Pressable
                key={u.id}
                style={styles.resultRow}
                onPress={() => void add(u.id)}
                disabled={busy}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>@{u.username}</Text>
                <Text style={{ color: '#A78BFA', fontWeight: '800' }}>Add</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color="#A78BFA" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(f) => String(f.id)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 24 }}>
              No one in your orbit yet — add people you trust.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.avatar}>
                {item.avatar ? (
                  <Image
                    source={{ uri: mediaUrl(item.avatar) || item.avatar }}
                    style={StyleSheet.absoluteFillObject}
                  />
                ) : (
                  <Text style={{ color: '#A78BFA', fontWeight: '800' }}>
                    {(item.username || '?')[0].toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={{ flex: 1, color: colors.text, fontWeight: '700' }}>@{item.username}</Text>
              <Pressable onPress={() => void remove(item.id)} disabled={busy}>
                <Text style={{ color: '#F472B6', fontWeight: '800' }}>Remove</Text>
              </Pressable>
            </View>
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '800' },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, zIndex: 2 },
  search: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  results: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.14)',
  },
});
