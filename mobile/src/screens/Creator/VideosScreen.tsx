import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';

type LongFormVideo = {
  id: string | number;
  title?: string;
  description?: string;
  video?: string;
  video_url?: string;
  status?: string;
  premiere_at?: string | null;
  views?: number;
  visibility?: string;
  user?: { username?: string };
  created_at?: string;
  chapters?: VideoChapter[];
};

type VideoChapter = {
  id?: string | number;
  title?: string;
  start_seconds?: number;
  start?: number;
  time?: number;
};

function videoUri(item: LongFormVideo) {
  return mediaUrl(item.video_url || item.video || '');
}

function premiereCountdown(premiereAt?: string | null, now = Date.now()) {
  if (!premiereAt) return '';
  const diff = new Date(premiereAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return '';
  const totalSeconds = Math.ceil(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

export default function VideosScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const playerRef = useRef<any>(null);
  const [videos, setVideos] = useState<LongFormVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [playing, setPlaying] = useState<LongFormVideo | null>(null);
  const [now, setNow] = useState(Date.now());
  const [chapterDrafts, setChapterDrafts] = useState<Record<string, { title: string; start_seconds: string }>>({});
  const [chapterBusy, setChapterBusy] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const page = await api.getVideos({ limit: 40, offset: 0, mine: scope === 'mine' });
      setVideos((page.results || []) as LongFormVideo[]);
    } catch {
      Alert.alert('Error', 'Could not load videos.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow media library access to upload a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled) {
      setSelectedVideo(result.assets[0]);
      if (!title.trim()) setTitle(result.assets[0].fileName?.replace(/\.[^/.]+$/, '') || 'New video');
    }
  };

  const uploadVideo = async () => {
    if (!selectedVideo) {
      Alert.alert('Choose a video', 'Pick a video file first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Title required', 'Add a title before uploading.');
      return;
    }
    try {
      setUploading(true);
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('visibility', 'public');
      form.append('video', {
        uri: selectedVideo.uri,
        type: selectedVideo.mimeType || 'video/mp4',
        name: selectedVideo.fileName || `video-${Date.now()}.mp4`,
      } as unknown as Blob);
      await api.createVideo(form);
      setTitle('');
      setDescription('');
      setSelectedVideo(null);
      Alert.alert('Uploaded', 'Your video is ready in Studio.');
      void load(true);
    } catch {
      Alert.alert('Error', 'Could not upload video.');
    } finally {
      setUploading(false);
    }
  };

  const premiere = async (item: LongFormVideo, hours: number) => {
    try {
      const premiereAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const updated = await api.premiereVideo(item.id, premiereAt);
      setVideos((prev) => prev.map((v) => (String(v.id) === String(item.id) ? updated : v)));
      Alert.alert('Premiere set', `Premiere scheduled in ${hours}h.`);
    } catch {
      Alert.alert('Error', 'Could not schedule premiere.');
    }
  };

  const updateChapterDraft = (
    videoId: string | number,
    patch: Partial<{ title: string; start_seconds: string }>,
  ) => {
    const key = String(videoId);
    setChapterDrafts((prev) => ({
      ...prev,
      [key]: { title: prev[key]?.title ?? '', start_seconds: prev[key]?.start_seconds ?? '', ...patch },
    }));
  };

  const addChapter = async (item: LongFormVideo) => {
    const key = String(item.id);
    const draft = chapterDrafts[key] || { title: '', start_seconds: '' };
    const seconds = Number.parseInt(draft.start_seconds.trim(), 10);
    if (!draft.title.trim() || !Number.isFinite(seconds) || seconds < 0) {
      Alert.alert('Chapter details', 'Add a title and a non-negative start time in seconds.');
      return;
    }
    setChapterBusy(key);
    try {
      const created = await api.addVideoChapter(item.id, {
        title: draft.title.trim(),
        start_seconds: seconds,
      });
      setVideos((prev) =>
        prev.map((video) =>
          String(video.id) === key
            ? { ...video, chapters: [...(video.chapters || []), created] }
            : video,
        ),
      );
      setPlaying((prev) =>
        prev && String(prev.id) === key
          ? { ...prev, chapters: [...(prev.chapters || []), created] }
          : prev,
      );
      setChapterDrafts((prev) => ({ ...prev, [key]: { title: '', start_seconds: '' } }));
    } catch {
      Alert.alert('Error', 'Could not add chapter.');
    } finally {
      setChapterBusy(null);
    }
  };

  const openVideo = async (item: LongFormVideo) => {
    const countdown = premiereCountdown(item.premiere_at, now);
    if (item.status === 'scheduled' && countdown) {
      Alert.alert('Premiere scheduled', `This video premieres in ${countdown}.`);
      return;
    }
    setPlaying(item);
    try {
      const detail = (await api.getVideo(item.id)) as LongFormVideo;
      setPlaying(detail);
      setVideos((prev) => prev.map((v) => (String(v.id) === String(item.id) ? { ...v, ...detail } : v)));
    } catch {
      // Playback can continue with the list row if detail fetch is unavailable.
    }
  };

  const seekToChapter = (chapter: VideoChapter) => {
    const seconds = Number(chapter.start_seconds ?? chapter.start ?? chapter.time ?? 0);
    if (Number.isFinite(seconds)) {
      playerRef.current?.seek?.(Math.max(0, seconds));
    }
  };

  const renderVideo = ({ item }: { item: LongFormVideo }) => {
    const countdown = item.status === 'scheduled' ? premiereCountdown(item.premiere_at, now) : '';
    const locked = !!countdown;
    const canAuthorChapters = scope === 'mine';
    const draft = chapterDrafts[String(item.id)] || { title: '', start_seconds: '' };

    return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => void openVideo(item)}
        disabled={locked}
        style={[styles.videoPreview, locked && styles.videoPreviewLocked]}
      >
        <Text style={styles.playIcon}>▶</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
          {item.title || `Video #${item.id}`}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {item.status || 'draft'} · {item.views || 0} views
        </Text>
        {item.premiere_at ? (
          <Text style={[styles.meta, { color: colors.primary }]}>
            Premieres {new Date(item.premiere_at).toLocaleString()}
          </Text>
        ) : null}
        {locked ? (
          <Text style={[styles.countdown, { color: colors.primary }]}>
            Starts in {countdown}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => void premiere(item, 1)} style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={[styles.chipText, { color: colors.text }]}>+1h</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void premiere(item, 24)} style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={[styles.chipText, { color: colors.text }]}>+24h</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void openVideo(item)}
            disabled={locked}
            style={[styles.chip, { borderColor: colors.primary, opacity: locked ? 0.45 : 1 }]}
          >
            <Text style={[styles.chipText, { color: colors.primary }]}>Play</Text>
          </TouchableOpacity>
        </View>
        {canAuthorChapters ? (
          <View style={styles.chapterForm}>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>Add chapter</Text>
            <View style={styles.chapterInputs}>
              <TextInput
                value={draft.title}
                onChangeText={(text) => updateChapterDraft(item.id, { title: text })}
                placeholder="Title"
                placeholderTextColor={colors.textSecondary}
                style={[styles.chapterInput, { color: colors.text, borderColor: colors.border }]}
              />
              <TextInput
                value={draft.start_seconds}
                onChangeText={(text) => updateChapterDraft(item.id, { start_seconds: text })}
                placeholder="Start sec"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                style={[styles.chapterTimeInput, { color: colors.text, borderColor: colors.border }]}
              />
            </View>
            <TouchableOpacity
              onPress={() => void addChapter(item)}
              disabled={chapterBusy === String(item.id)}
              style={[styles.addChapterBtn, { backgroundColor: colors.primary, opacity: chapterBusy === String(item.id) ? 0.6 : 1 }]}
            >
              <Text style={styles.addChapterText}>{chapterBusy === String(item.id) ? 'Adding...' : 'Add chapter'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.titleText, { color: colors.text }]}>Videos</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.uploadBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Video title"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Description"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
        />
        <View style={styles.uploadRow}>
          <TouchableOpacity onPress={pickVideo} style={[styles.secondaryBtn, { borderColor: colors.border }]}>
            <Text style={[styles.secondaryText, { color: colors.text }]}>
              {selectedVideo ? 'Change video' : 'Pick video'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={uploadVideo} disabled={uploading} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryText}>{uploading ? 'Uploading...' : 'Upload'}</Text>
          </TouchableOpacity>
        </View>
        {selectedVideo ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            {selectedVideo.fileName || selectedVideo.uri}
          </Text>
        ) : null}
      </View>

      <View style={styles.tabs}>
        {(['all', 'mine'] as const).map((key) => (
          <TouchableOpacity
            key={key}
            onPress={() => setScope(key)}
            style={[styles.tab, scope === key && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tabText, { color: scope === key ? '#fff' : colors.text }]}>
              {key === 'all' ? 'Public + Mine' : 'Mine'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderVideo}
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
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No videos yet.</Text>}
        />
      )}

      <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(null)}>
        <SafeAreaView style={styles.playerWrap}>
          <TouchableOpacity onPress={() => setPlaying(null)} style={styles.closeBtn}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          {playing && videoUri(playing) ? (
            <>
              <Video
                ref={playerRef}
                source={{ uri: videoUri(playing) }}
                style={styles.player}
                controls
                resizeMode="contain"
              />
              {playing.chapters?.length ? (
                <View style={styles.chapterBar}>
                  <Text style={styles.chapterTitle}>Chapters</Text>
                  <FlatList
                    horizontal
                    data={playing.chapters}
                    keyExtractor={(item, index) => String(item.id ?? `${item.title || 'chapter'}-${index}`)}
                    renderItem={({ item, index }) => (
                      <TouchableOpacity onPress={() => seekToChapter(item)} style={styles.chapterChip}>
                        <Text style={styles.chapterChipText} numberOfLines={1}>
                          {item.title || `Chapter ${index + 1}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                    showsHorizontalScrollIndicator={false}
                  />
                </View>
              ) : null}
            </>
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
  backBtn: { width: 44, alignItems: 'center' },
  titleText: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  uploadBox: { margin: 16, borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  uploadRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  secondaryText: { fontWeight: '700' },
  primaryBtn: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#e5e7eb' },
  tabText: { fontWeight: '700', fontSize: 13 },
  list: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12 },
  videoPreview: { width: 82, height: 82, borderRadius: 14, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  videoPreviewLocked: { opacity: 0.55 },
  playIcon: { color: '#fff', fontSize: 22 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 3 },
  countdown: { fontSize: 13, fontWeight: '800', marginTop: 5 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '700' },
  chapterForm: { marginTop: 10, gap: 7 },
  chapterInputs: { flexDirection: 'row', gap: 8 },
  chapterInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  chapterTimeInput: { width: 86, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  addChapterBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  addChapterText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { padding: 30, textAlign: 'center' },
  playerWrap: { flex: 1, backgroundColor: '#05030a' },
  closeBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 12 },
  closeText: { color: '#fff', fontWeight: '800' },
  player: { flex: 1, width: '100%' },
  chapterBar: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  chapterTitle: { color: '#fff', fontWeight: '800', fontSize: 13 },
  chapterChip: { maxWidth: 180, borderRadius: 999, backgroundColor: 'rgba(167,139,250,0.25)', paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  chapterChipText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
