import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  FlatList,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import StoryViewer from '@/components/StoryViewer';

type Constellation = {
  id: number;
  title: string;
  cover?: string | null;
  stories_count?: number;
};

/** Manual Highlights manager — Cosmory “Constellations”. */
export default function HighlightsManagerScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const userId = route.params?.userId;
  const isOwner = !!route.params?.isOwner;

  const [items, setItems] = useState<Constellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [archive, setArchive] = useState<any[]>([]);
  const [pickingFor, setPickingFor] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getConstellations(userId);
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    try {
      await api.createConstellation(title.trim());
      setTitle('');
      await load();
    } catch {
      Alert.alert('Error', 'Could not create highlight.');
    }
  };

  const open = async (id: number) => {
    try {
      const data = await api.getConstellation(id);
      const stories = (data.stories || []).map((s: any) => ({
        ...s,
        media: s.image || s.video,
        media_type: s.video ? 'video' : 'image',
      }));
      if (!stories.length) {
        Alert.alert('Empty', 'No stories in this highlight yet.');
        return;
      }
      setPlaylist(stories);
      setViewerOpen(true);
    } catch {
      Alert.alert('Error', 'Could not open highlight.');
    }
  };

  const startAdd = async (constellationId: number) => {
    try {
      const rows = await api.getStoryArchive();
      setArchive(rows);
      setPickingFor(constellationId);
    } catch {
      Alert.alert('Error', 'Could not load archive.');
    }
  };

  const addStory = async (storyId: number) => {
    if (!pickingFor) return;
    try {
      await api.addStoryToConstellation(pickingFor, storyId);
      setPickingFor(null);
      await load();
      Alert.alert('Added', 'Story pinned to highlight.');
    } catch {
      Alert.alert('Error', 'Could not add story.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Constellations</Text>
        <View style={{ width: 40 }} />
      </View>

      {isOwner ? (
        <View style={styles.createRow}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="New highlight name"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          <Pressable style={styles.createBtn} onPress={() => void create()}>
            <Text style={styles.createBtnText}>Create</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color="#A78BFA" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
              No highlights yet — pin lasting signals here.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => void open(item.id)}
            >
              <View style={styles.cover}>
                {item.cover ? (
                  <Image source={{ uri: mediaUrl(item.cover) || item.cover }} style={StyleSheet.absoluteFillObject} />
                ) : (
                  <Text style={{ fontSize: 28 }}>✨</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{item.title}</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {item.stories_count ?? 0} signals
                </Text>
              </View>
              {isOwner ? (
                <Pressable onPress={() => void startAdd(item.id)} style={styles.addBtn}>
                  <Text style={{ color: '#A78BFA', fontWeight: '800' }}>+ Story</Text>
                </Pressable>
              ) : null}
            </Pressable>
          )}
        />
      )}

      {pickingFor != null ? (
        <View style={styles.picker}>
          <View style={styles.pickerHead}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Pick from archive</Text>
            <Pressable onPress={() => setPickingFor(null)}>
              <Text style={{ color: '#A78BFA' }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            horizontal
            data={archive}
            keyExtractor={(s) => String(s.id)}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item }) => {
              const uri = mediaUrl(item.image || item.video) || '';
              return (
                <Pressable onPress={() => void addStory(item.id)} style={styles.archiveThumb}>
                  {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}

      <StoryViewer
        visible={viewerOpen}
        stories={playlist}
        startIndex={0}
        onClose={() => setViewerOpen(false)}
      />
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
  },
  title: { fontSize: 17, fontWeight: '800' },
  createRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  createBtnText: { color: '#fff', fontWeight: '800' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  cover: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B1836',
    borderWidth: 2,
    borderColor: '#A78BFA',
  },
  addBtn: { padding: 8 },
  picker: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#12101F',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 24,
  },
  pickerHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  archiveThumb: {
    width: 72,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1B1836',
    marginRight: 8,
  },
});
