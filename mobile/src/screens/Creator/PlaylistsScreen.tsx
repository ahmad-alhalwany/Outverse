import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';

type PlaylistVideo = {
  id: string | number;
  title?: string;
  description?: string;
  video?: string;
  video_url?: string;
  status?: string;
  views?: number;
};

type PlaylistItem = {
  id?: string | number;
  order?: number;
  video?: PlaylistVideo | string | number;
  video_detail?: PlaylistVideo;
};

type Playlist = {
  id: string | number;
  title?: string;
  name?: string;
  description?: string;
  is_public?: boolean;
  item_count?: number;
  items?: PlaylistItem[];
  videos?: PlaylistVideo[];
};

function playlistTitle(item: Playlist) {
  return item.title || item.name || `Playlist #${item.id}`;
}

function itemVideo(item: PlaylistItem): PlaylistVideo | null {
  if (item.video_detail) return item.video_detail;
  if (item.video && typeof item.video === 'object') return item.video;
  return null;
}

function videoUri(item: PlaylistVideo | null) {
  return mediaUrl(item?.video_url || item?.video || '');
}

export default function PlaylistsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoId, setVideoId] = useState('');
  const [playing, setPlaying] = useState<PlaylistVideo | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const page = await api.getPlaylists({ limit: 40, offset: 0 });
      setPlaylists((page.results || []) as Playlist[]);
    } catch {
      Alert.alert('Error', 'Could not load playlists.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createPlaylist = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Add a playlist title.');
      return;
    }
    setSaving(true);
    try {
      const created = await api.createPlaylist({
        title: title.trim(),
        description: description.trim(),
        is_public: true,
      });
      setPlaylists((prev) => [created as Playlist, ...prev]);
      setSelected(created as Playlist);
      setTitle('');
      setDescription('');
    } catch {
      Alert.alert('Error', 'Could not create playlist.');
    } finally {
      setSaving(false);
    }
  };

  const openPlaylist = async (playlist: Playlist) => {
    setSelected(playlist);
    try {
      const detail = await api.getPlaylist(playlist.id);
      setSelected(detail as Playlist);
      setPlaylists((prev) => prev.map((row) => (String(row.id) === String(playlist.id) ? (detail as Playlist) : row)));
    } catch {
      // Keep the list response open if the detail endpoint is not available.
    }
  };

  const addVideo = async () => {
    if (!selected || !videoId.trim()) return;
    setSaving(true);
    try {
      await api.addPlaylistItem(selected.id, videoId.trim());
      setVideoId('');
      await openPlaylist(selected);
    } catch {
      Alert.alert('Error', 'Could not add that video.');
    } finally {
      setSaving(false);
    }
  };

  const selectedItems: PlaylistItem[] =
    selected?.items ||
    selected?.videos?.map((video, index) => ({ id: `${video.id}-${index}`, video })) ||
    [];

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      onPress={() => void openPlaylist(item)}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: selected?.id === item.id ? colors.primary : colors.border }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
          {playlistTitle(item)}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.description || 'No description'}
        </Text>
      </View>
      <Text style={[styles.pill, { color: colors.primary, borderColor: colors.primary }]}>
        {item.item_count ?? item.items?.length ?? item.videos?.length ?? 0}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.text }}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.titleText, { color: colors.text }]}>Playlists</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.formBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.text }]}>Create playlist</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <TouchableOpacity
          onPress={() => void createPlaylist()}
          disabled={saving || !title.trim()}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving || !title.trim() ? 0.5 : 1 }]}
        >
          <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Create'}</Text>
        </TouchableOpacity>
      </View>

      {selected ? (
        <View style={[styles.detailBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.formTitle, { color: colors.text }]} numberOfLines={1}>
            {playlistTitle(selected)}
          </Text>
          <View style={styles.addRow}>
            <TextInput
              value={videoId}
              onChangeText={setVideoId}
              placeholder="Video id"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[styles.input, styles.addInput, { color: colors.text, borderColor: colors.border }]}
            />
            <TouchableOpacity
              onPress={() => void addVideo()}
              disabled={saving || !videoId.trim()}
              style={[styles.addBtn, { backgroundColor: colors.primary, opacity: saving || !videoId.trim() ? 0.5 : 1 }]}
            >
              <Text style={styles.primaryText}>Add</Text>
            </TouchableOpacity>
          </View>
          {selectedItems.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No playlist items yet.</Text>
          ) : (
            selectedItems.map((item, index) => {
              const video = itemVideo(item);
              const id = item.id ?? video?.id ?? index;
              return (
                <TouchableOpacity
                  key={String(id)}
                  onPress={() => {
                    if (videoUri(video)) setPlaying(video);
                    else if (video?.id) navigation.navigate('Videos', { videoId: video.id });
                  }}
                  style={[styles.itemRow, { borderColor: colors.border }]}
                >
                  <Text style={[styles.itemOrder, { color: colors.textSecondary }]}>
                    {item.order ?? index + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                      {video?.title || `Video ${typeof item.video === 'string' || typeof item.video === 'number' ? item.video : video?.id || ''}`}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      Tap to open
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPlaylist}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No playlists yet.</Text>}
        />
      )}

      <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(null)}>
        <SafeAreaView style={styles.playerWrap}>
          <TouchableOpacity onPress={() => setPlaying(null)} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          {playing && videoUri(playing) ? (
            <Video source={{ uri: videoUri(playing) }} style={styles.player} controls resizeMode="contain" />
          ) : (
            <View style={styles.center}>
              <Text style={{ color: '#fff' }}>Video unavailable</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 58, alignItems: 'center' },
  titleText: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  formBox: { margin: 16, borderWidth: 1, borderRadius: 16, padding: 12, gap: 9 },
  detailBox: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  formTitle: { fontSize: 15, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  primaryBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  primaryText: { color: '#fff', fontWeight: '800' },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: { flex: 1 },
  addBtn: { borderRadius: 999, paddingHorizontal: 16, justifyContent: 'center' },
  list: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  row: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTitle: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 3 },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontWeight: '800', overflow: 'hidden' },
  itemRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemOrder: { width: 26, fontSize: 12, fontWeight: '800' },
  empty: { padding: 18, textAlign: 'center' },
  playerWrap: { flex: 1, backgroundColor: '#05030a' },
  closeBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 12 },
  closeText: { color: '#fff', fontWeight: '800' },
  player: { flex: 1, width: '100%' },
});
