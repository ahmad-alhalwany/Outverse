import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
  WorldPill,
} from '@/components/world/WorldChrome';

type VideoUser = { id?: number; username?: string; first_name?: string; last_name?: string };
type Chapter = { id?: number | string; title?: string; start_seconds?: number; start?: number; order?: number };
type Playlist = { id: number | string; title?: string; user?: VideoUser };
type LongFormVideo = {
  id: number | string;
  title?: string;
  description?: string;
  video?: string;
  video_url?: string;
  thumbnail?: string | null;
  status?: string;
  premiere_at?: string | null;
  published_at?: string | null;
  views?: number;
  is_premiere?: boolean;
  is_owner?: boolean;
  user?: VideoUser | null;
  chapters?: Chapter[];
};

type PremiereChoice = 0 | 1 | 24;

function listFrom<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: T[] }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

function creatorName(user: VideoUser | null | undefined, fallback: string) {
  if (!user) return fallback;
  const full = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  return full || user.username || fallback;
}

function videoUri(item: LongFormVideo) {
  return mediaUrl(item.video_url || item.video || '');
}

function formatSeconds(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatCountdown(ms: number, soonLabel: string) {
  if (ms <= 0) return soonLabel;
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function isPremierePending(video: LongFormVideo, now: number) {
  const premiereAtMs = video.premiere_at ? new Date(video.premiere_at).getTime() : null;
  const premiereInMs = premiereAtMs ? premiereAtMs - now : 0;
  return (
    video.status === 'scheduled' ||
    (premiereAtMs != null && premiereInMs > 0) ||
    (!!video.is_premiere && !video.published_at)
  );
}

export default function VideosScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  const focusVideoId = route.params?.videoId;
  const [videos, setVideos] = useState<LongFormVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [premiereHours, setPremiereHours] = useState<PremiereChoice>(0);
  const [message, setMessage] = useState('');
  const [playing, setPlaying] = useState<LongFormVideo | null>(null);
  const openedFocusRef = useRef<string | number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const page = await api.getVideos({ limit: 40, offset: 0 });
      setVideos(listFrom<LongFormVideo>(page.results ?? page));
    } catch {
      setVideos([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusVideoId == null || openedFocusRef.current === focusVideoId) return;
    const hit = videos.find((video) => String(video.id) === String(focusVideoId));
    if (hit) {
      openedFocusRef.current = focusVideoId;
      setPlaying(hit);
      return;
    }
    void api
      .getVideo(focusVideoId)
      .then((video) => {
        openedFocusRef.current = focusVideoId;
        setPlaying(video as LongFormVideo);
      })
      .catch(() => undefined);
  }, [focusVideoId, videos]);

  const pickVideo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('videos.uploadVideo'), t('videos.uploadFailed'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setFile(asset);
    if (!title.trim()) setTitle(asset.fileName?.replace(/\.[^/.]+$/, '') || '');
  };

  const uploadVideo = async () => {
    if (!title.trim() || !file || submitting) return;
    setSubmitting(true);
    setMessage('');
    try {
      const form = new FormData();
      form.append('title', title.trim());
      form.append('description', description.trim());
      form.append('visibility', 'public');
      form.append('status', premiereHours ? 'scheduled' : 'published');
      form.append('video', {
        uri: file.uri,
        type: file.mimeType || 'video/mp4',
        name: file.fileName || `video-${Date.now()}.mp4`,
      } as any);
      const created = (await api.createVideo(form)) as LongFormVideo;
      if (premiereHours) {
        await api.premiereVideo(created.id, new Date(Date.now() + premiereHours * 3600 * 1000).toISOString());
      } else {
        await api.publishVideo(created.id);
      }
      setTitle('');
      setDescription('');
      setFile(null);
      setPremiereHours(0);
      setMessage(t('videos.uploaded'));
      await load(true);
    } catch {
      setMessage(t('videos.uploadFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('videos.title')}
          subtitle={t('nav.videos')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        {loading && videos.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('videos.loadingVideos')}</Text>
          </View>
        ) : (
          <FlatList
            data={videos}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void load(true);
                }}
                tintColor={colors.primary}
              />
            }
            ListHeaderComponent={
              <>
                <WorldHero tone="default" eyebrow={t('nav.videos')} title={t('videos.title')} body={t('videos.subtitle')} />
                <View style={[styles.upload, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.uploadHead}>
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
                    <Text style={[styles.uploadTitle, { color: colors.textSecondary }]}>{t('videos.uploadVideo')}</Text>
                  </View>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder={t('videos.titleLabel')}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder={t('videos.descriptionLabel')}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[styles.input, styles.area, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  <Pressable onPress={() => void pickVideo()} style={[styles.fileBtn, { borderColor: colors.border }]}>
                    <Ionicons name="film-outline" size={16} color={colors.primary} />
                    <Text style={[styles.fileBtnText, { color: colors.text }]} numberOfLines={1}>
                      {file ? file.fileName || t('videos.changeVideo') : t('videos.pickVideo')}
                    </Text>
                  </Pressable>
                  <Text style={[styles.kicker, { color: colors.textSecondary }]}>{t('videos.optionalPremiere')}</Text>
                  <View style={styles.pills}>
                    {([
                      [0, t('videos.premiereNone')],
                      [1, t('videos.premiereIn1h')],
                      [24, t('videos.premiereIn24h')],
                    ] as const).map(([hours, label]) => (
                      <WorldPill
                        key={hours}
                        label={label}
                        active={premiereHours === hours}
                        onPress={() => setPremiereHours(hours)}
                      />
                    ))}
                  </View>
                  <View style={styles.uploadFooter}>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
                    <Pressable
                      onPress={() => void uploadVideo()}
                      disabled={submitting || !title.trim() || !file}
                      style={[styles.uploadBtn, { opacity: submitting || !title.trim() || !file ? 0.5 : 1 }]}
                    >
                      <Text style={styles.uploadBtnText}>
                        {submitting ? t('videos.uploading') : t('videos.upload')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.sectionRow}>
                  <Text style={[styles.section, { color: colors.textSecondary }]}>{t('videos.publishedVideos')}</Text>
                  <Pressable onPress={() => navigation.navigate('Playlists')} hitSlop={8}>
                    <Text style={[styles.seePlaylists, { color: colors.primary }]}>{t('videos.playlistsLink')}</Text>
                  </Pressable>
                </View>
              </>
            }
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>{t('videos.empty')}</Text>}
            renderItem={({ item }) => (
              <VideoCard
                video={item}
                colors={colors}
                t={t}
                onOpen={() => setPlaying(item)}
              />
            )}
          />
        )}
        <VideoPlayerModal
          video={playing}
          onClose={() => setPlaying(null)}
          onUpdated={(next) => {
            setPlaying(next);
            setVideos((prev) => prev.map((v) => (String(v.id) === String(next.id) ? { ...v, ...next } : v)));
          }}
        />
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function VideoCard({
  video,
  colors,
  t,
  onOpen,
}: {
  video: LongFormVideo;
  colors: { text: string; textSecondary: string; surface: string; border: string; primary: string };
  t: (key: string, vars?: Record<string, string | number>) => string;
  onOpen: () => void;
}) {
  const thumb = mediaUrl(video.thumbnail || '');
  const pending = isPremierePending(video, Date.now());
  return (
    <Pressable onPress={onOpen} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.thumbWrap}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} />
        ) : (
          <LinearGradient colors={['rgba(124,58,237,0.55)', 'rgba(34,211,238,0.28)']} style={styles.thumb} />
        )}
        <View style={styles.playVeil}>
          <Ionicons name="play-circle" size={44} color="#fff" />
        </View>
        {pending ? (
          <View style={styles.premiereBadge}>
            <Text style={styles.premiereBadgeText}>{t('videos.premiereLabel')}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {video.title || t('videos.title')}
        </Text>
        <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {creatorName(video.user, t('videos.creatorFallback'))} · {video.views ?? 0} {t('videos.views')}
        </Text>
        {video.premiere_at ? (
          <Text style={[styles.cardPremiere, { color: colors.primary }]}>
            {t('videos.premieres', { date: new Date(video.premiere_at).toLocaleString() })}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function VideoPlayerModal({
  video,
  onClose,
  onUpdated,
}: {
  video: LongFormVideo | null;
  onClose: () => void;
  onUpdated: (video: LongFormVideo) => void;
}) {
  const { colors, isDark } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const playerRef = useRef<Video>(null);
  const [detail, setDetail] = useState<LongFormVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterStart, setChapterStart] = useState('');
  const [chapterBusy, setChapterBusy] = useState(false);
  const [chapterMessage, setChapterMessage] = useState('');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [playlistMessage, setPlaylistMessage] = useState('');

  const current = detail || video;

  useEffect(() => {
    if (!video) {
      setDetail(null);
      setChapterMessage('');
      setPlaylistMessage('');
      return;
    }
    setLoading(true);
    void api
      .getVideo(video.id)
      .then((data) => {
        const next = data as LongFormVideo;
        setDetail(next);
        onUpdated(next);
      })
      .catch(() => setDetail(video))
      .finally(() => setLoading(false));
  }, [video?.id]);

  useEffect(() => {
    if (!video) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [video]);

  useEffect(() => {
    if (!user) return;
    void api
      .getPlaylists({ limit: 40 })
      .then((page) => {
        const rows = listFrom<Playlist>(page.results ?? page).filter(
          (p) => !p.user?.id || String(p.user.id) === String(user.id),
        );
        setPlaylists(rows);
        setSelectedPlaylistId((cur) => cur || (rows[0] ? String(rows[0].id) : ''));
      })
      .catch(() => setPlaylists([]));
  }, [user?.id]);

  const isOwner = useMemo(() => {
    if (!current || !user) return false;
    if (current.is_owner) return true;
    return current.user?.id != null && String(current.user.id) === String(user.id);
  }, [current, user]);

  const pending = current ? isPremierePending(current, now) : false;
  const premiereInMs = current?.premiere_at ? new Date(current.premiere_at).getTime() - now : 0;
  const chapters = useMemo(
    () =>
      (current?.chapters || [])
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.start_seconds ?? 0) - (b.start_seconds ?? 0)),
    [current?.chapters],
  );
  const src = current ? videoUri(current) : '';

  const addChapter = async () => {
    if (!current || !chapterTitle.trim() || chapterBusy) return;
    const start = Number(chapterStart);
    if (!Number.isFinite(start) || start < 0) {
      setChapterMessage(t('videos.chapterStartError'));
      return;
    }
    setChapterBusy(true);
    setChapterMessage('');
    try {
      const created = (await api.addVideoChapter(current.id, {
        title: chapterTitle.trim(),
        start_seconds: Math.floor(start),
      })) as Chapter;
      const next = { ...current, chapters: [...(current.chapters || []), created] };
      setDetail(next);
      onUpdated(next);
      setChapterTitle('');
      setChapterStart('');
      setChapterMessage(t('videos.chapterAdded'));
    } catch {
      setChapterMessage(t('videos.couldNotAddChapter'));
    } finally {
      setChapterBusy(false);
    }
  };

  const addToPlaylist = async () => {
    if (!current || !selectedPlaylistId || playlistBusy) return;
    setPlaylistBusy(true);
    setPlaylistMessage('');
    try {
      await api.addPlaylistItem(selectedPlaylistId, current.id);
      setPlaylistMessage(t('videos.addedToPlaylist'));
    } catch {
      setPlaylistMessage(t('videos.couldNotAddToPlaylist'));
    } finally {
      setPlaylistBusy(false);
    }
  };

  const seekTo = (seconds: number) => {
    void playerRef.current?.setPositionAsync(Math.max(0, seconds) * 1000);
  };

  return (
    <Modal visible={!!video} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.playerSafe, { backgroundColor: isDark ? '#05030a' : colors.background }]} edges={['top']}>
        <Pressable onPress={onClose} style={styles.closeRow} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={[styles.closeText, { color: colors.primary }]}>{t('videos.backToVideos')}</Text>
        </Pressable>
        {!current || loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('videos.loadingVideo')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.playerBody}>
            {pending ? (
              <LinearGradient colors={['rgba(124,58,237,0.35)', 'rgba(34,211,238,0.18)']} style={styles.premiereLock}>
                <Text style={styles.premiereKicker}>{t('videos.premiereLabel')}</Text>
                <Text style={[styles.premiereTitle, { color: colors.text }]}>
                  {current.premiere_at
                    ? t('videos.premiereIn', { countdown: formatCountdown(premiereInMs, t('videos.premiereSoon')) })
                    : t('videos.premiereScheduled')}
                </Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>{t('videos.premiereUnlockHint')}</Text>
              </LinearGradient>
            ) : src ? (
              <Video
                ref={playerRef}
                source={{ uri: src }}
                style={styles.player}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                posterSource={current.thumbnail ? { uri: mediaUrl(current.thumbnail) } : undefined}
              />
            ) : (
              <View style={[styles.premiereLock, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.textSecondary }}>{t('videos.fileUnavailable')}</Text>
              </View>
            )}

            <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.detailTitle, { color: colors.text }]}>{current.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {current.views ?? 0} {t('videos.views')}
                {current.published_at ? ` · ${t('videos.published', { date: new Date(current.published_at).toLocaleString() })}` : ''}
              </Text>
              {current.description ? (
                <Text style={[styles.desc, { color: colors.textSecondary }]}>{current.description}</Text>
              ) : null}
            </View>

            {user ? (
              <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.blockTitle, { color: colors.textSecondary }]}>{t('videos.addToPlaylist')}</Text>
                {playlists.length === 0 ? (
                  <Pressable onPress={() => { onClose(); navigation.navigate('Playlists'); }}>
                    <Text style={[styles.cardMeta, { color: colors.primary }]}>
                      {t('videos.noPlaylists')} {t('videos.createOne')}
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                      {playlists.map((p) => (
                        <WorldPill
                          key={String(p.id)}
                          label={p.title || String(p.id)}
                          active={selectedPlaylistId === String(p.id)}
                          onPress={() => setSelectedPlaylistId(String(p.id))}
                        />
                      ))}
                    </ScrollView>
                    <Pressable
                      onPress={() => void addToPlaylist()}
                      disabled={playlistBusy || !selectedPlaylistId}
                      style={[styles.uploadBtn, { opacity: playlistBusy ? 0.6 : 1, alignSelf: 'flex-start', marginTop: 10 }]}
                    >
                      <Text style={styles.uploadBtnText}>{playlistBusy ? t('videos.adding') : t('videos.addItem')}</Text>
                    </Pressable>
                  </>
                )}
                {playlistMessage ? <Text style={[styles.message, { color: colors.textSecondary }]}>{playlistMessage}</Text> : null}
              </View>
            ) : null}

            <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.blockTitle, { color: colors.textSecondary }]}>{t('videos.chapters')}</Text>
              {isOwner ? (
                <View style={styles.chapterForm}>
                  <TextInput
                    value={chapterTitle}
                    onChangeText={setChapterTitle}
                    placeholder={t('videos.chapterTitlePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  <TextInput
                    value={chapterStart}
                    onChangeText={setChapterStart}
                    placeholder={t('videos.secondsPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    style={[styles.input, { width: 90, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  <Pressable
                    onPress={() => void addChapter()}
                    disabled={chapterBusy}
                    style={[styles.uploadBtn, { opacity: chapterBusy ? 0.6 : 1 }]}
                  >
                    <Text style={styles.uploadBtnText}>{chapterBusy ? t('videos.adding') : t('videos.add')}</Text>
                  </Pressable>
                </View>
              ) : null}
              {chapterMessage ? <Text style={[styles.message, { color: colors.textSecondary }]}>{chapterMessage}</Text> : null}
              {chapters.length === 0 ? (
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>{t('videos.noChapters')}</Text>
              ) : (
                chapters.map((ch) => (
                  <Pressable
                    key={String(ch.id)}
                    onPress={() => seekTo(Number(ch.start_seconds ?? ch.start ?? 0))}
                    disabled={pending || !src}
                    style={[styles.chapterRow, { backgroundColor: colors.background, opacity: pending ? 0.45 : 1 }]}
                  >
                    <Text style={[styles.chapterName, { color: colors.text }]}>{ch.title}</Text>
                    <Text style={[styles.chapterTime, { color: colors.textSecondary }]}>
                      {formatSeconds(Number(ch.start_seconds ?? ch.start ?? 0))}
                    </Text>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 13, textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  upload: { borderRadius: 22, borderWidth: 1, padding: 14, gap: 10, marginBottom: 18 },
  uploadHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadTitle: { fontSize: 13, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  area: { minHeight: 72, textAlignVertical: 'top' },
  fileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fileBtnText: { flex: 1, fontSize: 14, fontWeight: '600' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uploadFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  message: { flex: 1, fontSize: 12 },
  uploadBtn: { backgroundColor: '#7C3AED', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10 },
  uploadBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  seePlaylists: { fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  card: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, marginBottom: 14 },
  thumbWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#12081f' },
  thumb: { ...StyleSheet.absoluteFillObject },
  playVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,6,20,0.18)',
  },
  premiereBadge: {
    position: 'absolute',
    top: 10,
    start: 10,
    backgroundColor: '#7C3AED',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiereBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardMeta: { fontSize: 12, marginTop: 4 },
  cardPremiere: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  playerSafe: { flex: 1 },
  closeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 10 },
  closeText: { fontSize: 14, fontWeight: '700' },
  playerBody: { paddingHorizontal: 16, paddingBottom: 36, gap: 14 },
  player: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' },
  premiereLock: {
    aspectRatio: 16 / 9,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 8,
  },
  premiereKicker: { color: '#C4B5FD', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  premiereTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  metaCard: { borderRadius: 18, borderWidth: 1, padding: 14 },
  detailTitle: { fontSize: 22, fontWeight: '800' },
  desc: { fontSize: 14, lineHeight: 21, marginTop: 10 },
  blockTitle: { fontSize: 13, fontWeight: '800', marginBottom: 10 },
  chapterForm: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chapterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  chapterName: { flex: 1, fontSize: 14, fontWeight: '600', marginEnd: 8 },
  chapterTime: { fontSize: 12, fontWeight: '700' },
});
