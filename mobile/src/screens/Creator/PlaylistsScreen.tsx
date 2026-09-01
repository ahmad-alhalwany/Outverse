import React, { useCallback, useEffect, useState } from 'react';
import {
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
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import {
  asPlaylist,
  asPlaylists,
  playlistFieldError,
  usePlaylistsPalette,
  type Playlist,
} from '@/lib/playlists';

export default function PlaylistsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = usePlaylistsPalette(isDark);
  const { t } = useLocale();
  const { user } = useAuth();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [videoId, setVideoId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublic, setEditPublic] = useState(true);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const page = await api.getPlaylists({ limit: 60, offset: 0 });
      const rows = asPlaylists(page);
      setPlaylists(rows);
      setActiveId((current) => current ?? rows[0]?.id ?? null);
    } catch {
      setPlaylists([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    setEditing(false);
  }, [activeId]);

  const active = playlists.find((playlist) => playlist.id === activeId) || null;
  const isOwner = Boolean(active && user && String(active.user?.id) === String(user.id));

  const createPlaylist = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const created = asPlaylist(
        await api.createPlaylist({
          title: title.trim(),
          description: description.trim(),
          is_public: isPublic,
        }),
      );
      setTitle('');
      setDescription('');
      setIsPublic(true);
      await load(true);
      if (created) setActiveId(created.id);
      setMessage(t('playlists.created'));
    } catch (error) {
      setMessage(playlistFieldError(error, t('playlists.createFailed')));
    } finally {
      setBusy(false);
    }
  };

  const addVideo = async () => {
    if (!activeId || !videoId.trim() || busy) return;
    const parsed = Number(videoId);
    if (!Number.isFinite(parsed)) return;
    setBusy(true);
    setMessage('');
    try {
      await api.addPlaylistItem(activeId, parsed);
      setVideoId('');
      setMessage(t('playlists.videoAdded'));
      await load(true);
    } catch (error) {
      setMessage(playlistFieldError(error, t('playlists.addVideoFailed')));
    } finally {
      setBusy(false);
    }
  };

  const removeVideo = async (itemId: number) => {
    if (!activeId || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await api.removePlaylistItem(activeId, itemId);
      setMessage(t('playlists.videoRemoved'));
      await load(true);
    } catch (error) {
      setMessage(playlistFieldError(error, t('playlists.removeVideoFailed')));
    } finally {
      setBusy(false);
    }
  };

  const startEditing = () => {
    if (!active) return;
    setEditTitle(active.title);
    setEditDescription(active.description);
    setEditPublic(active.is_public);
    setEditing(true);
  };

  const saveEdits = async () => {
    if (!activeId || !editTitle.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await api.updatePlaylist(activeId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        is_public: editPublic,
      });
      setEditing(false);
      setMessage(t('playlists.edited'));
      await load(true);
    } catch (error) {
      setMessage(playlistFieldError(error, t('playlists.editFailed')));
    } finally {
      setBusy(false);
    }
  };

  const deletePlaylist = () => {
    if (!activeId || busy) return;
    Alert.alert(t('playlists.deletePlaylist'), t('playlists.deleteConfirm'), [
      { text: t('playlists.cancelEdit'), style: 'cancel' },
      {
        text: t('playlists.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            setMessage('');
            try {
              await api.deletePlaylist(activeId);
              setActiveId(null);
              setEditing(false);
              setMessage(t('playlists.deleted'));
              await load(true);
            } catch (error) {
              setMessage(playlistFieldError(error, t('playlists.deleteFailed')));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('playlists.title')}
          subtitle={t('playlists.subtitle')}
          tone="vault"
          onBack={() => navigation.goBack()}
          right={
            <Pressable onPress={() => navigation.navigate('Videos')} hitSlop={8}>
              <Text style={[styles.link, { color: C.accent }]}>{t('playlists.videosLink')}</Text>
            </Pressable>
          }
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.accent} />
          }
        >
          <View style={[styles.form, { backgroundColor: C.card, borderColor: C.border }]}>
            <Text style={[styles.formTitle, { color: C.muted }]}>{t('playlists.create')}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('playlists.titlePlaceholder')}
              placeholderTextColor={C.muted}
              style={[styles.input, { backgroundColor: C.inputBg, color: C.text, borderColor: C.border }]}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('playlists.descriptionPlaceholder')}
              placeholderTextColor={C.muted}
              multiline
              style={[
                styles.input,
                styles.textarea,
                { backgroundColor: C.inputBg, color: C.text, borderColor: C.border },
              ]}
            />
            <View style={styles.formFooter}>
              <Pressable onPress={() => setIsPublic((prev) => !prev)} style={styles.switchRow}>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: C.chipBg, true: C.accent }}
                  thumbColor="#fff"
                />
                <Text style={[styles.switchLabel, { color: C.muted }]}>{t('playlists.public')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void createPlaylist()}
                disabled={busy || !title.trim()}
                style={[styles.primary, { backgroundColor: C.accent, opacity: busy || !title.trim() ? 0.5 : 1 }]}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.primaryText}>{t('playlists.create')}</Text>
              </Pressable>
            </View>
          </View>

          {message ? <Text style={[styles.message, { color: C.muted }]}>{message}</Text> : null}

          {loading && playlists.length === 0 ? (
            <Text style={[styles.hint, { color: C.muted }]}>{t('playlists.loading')}</Text>
          ) : playlists.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.hint, { color: C.muted }]}>{t('playlists.empty')}</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {playlists.map((playlist) => {
                const selected = playlist.id === activeId;
                return (
                  <Pressable
                    key={playlist.id}
                    onPress={() => setActiveId(playlist.id)}
                    style={[
                      styles.row,
                      {
                        backgroundColor: selected ? `${C.accent}22` : C.card,
                        borderColor: selected ? C.accent : C.border,
                      },
                    ]}
                  >
                    <Text style={[styles.rowTitle, { color: C.text }]} numberOfLines={1}>
                      {playlist.title}
                    </Text>
                    <Text style={[styles.rowMeta, { color: C.muted }]}>
                      {t('playlists.videoCount', { count: playlist.items.length })} -{' '}
                      {playlist.is_public ? t('playlists.public') : t('playlists.private')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={[styles.detail, { backgroundColor: C.card, borderColor: C.border }]}>
            {!active ? (
              <Text style={[styles.hint, { color: C.muted }]}>{t('playlists.selectOrCreate')}</Text>
            ) : editing ? (
              <>
                <TextInput
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder={t('playlists.titlePlaceholder')}
                  placeholderTextColor={C.muted}
                  style={[styles.input, { backgroundColor: C.inputBg, color: C.text, borderColor: C.border }]}
                />
                <TextInput
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder={t('playlists.descriptionPlaceholder')}
                  placeholderTextColor={C.muted}
                  multiline
                  style={[
                    styles.input,
                    styles.textarea,
                    { backgroundColor: C.inputBg, color: C.text, borderColor: C.border },
                  ]}
                />
                <Pressable onPress={() => setEditPublic((prev) => !prev)} style={styles.switchRow}>
                  <Switch
                    value={editPublic}
                    onValueChange={setEditPublic}
                    trackColor={{ false: C.chipBg, true: C.accent }}
                    thumbColor="#fff"
                  />
                  <Text style={[styles.switchLabel, { color: C.muted }]}>{t('playlists.public')}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void saveEdits()}
                    disabled={busy || !editTitle.trim()}
                    style={[styles.primary, { backgroundColor: C.accent, opacity: busy || !editTitle.trim() ? 0.5 : 1 }]}
                  >
                    <Text style={styles.primaryText}>{t('playlists.save')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditing(false)}
                    style={[styles.ghost, { borderColor: C.border }]}
                  >
                    <Text style={[styles.ghostText, { color: C.muted }]}>{t('playlists.cancelEdit')}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.detailHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailTitle, { color: C.text }]}>{active.title}</Text>
                    {active.description ? (
                      <Text style={[styles.detailBody, { color: C.muted }]}>{active.description}</Text>
                    ) : null}
                  </View>
                  {isOwner ? (
                    <View style={styles.iconRow}>
                      <Pressable onPress={startEditing} hitSlop={8} accessibilityLabel={t('playlists.editPlaylist')}>
                        <Ionicons name="pencil-outline" size={18} color={C.muted} />
                      </Pressable>
                      <Pressable onPress={deletePlaylist} hitSlop={8} accessibilityLabel={t('playlists.deletePlaylist')}>
                        <Ionicons name="trash-outline" size={18} color={C.danger} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {isOwner ? (
                  <View style={styles.addRow}>
                    <TextInput
                      value={videoId}
                      onChangeText={setVideoId}
                      placeholder={t('playlists.videoIdPlaceholder')}
                      placeholderTextColor={C.muted}
                      keyboardType="number-pad"
                      style={[
                        styles.input,
                        styles.addInput,
                        { backgroundColor: C.inputBg, color: C.text, borderColor: C.border },
                      ]}
                    />
                    <Pressable
                      onPress={() => void addVideo()}
                      disabled={busy || !videoId.trim()}
                      style={[styles.primary, { backgroundColor: C.accent, opacity: busy || !videoId.trim() ? 0.5 : 1 }]}
                    >
                      <Text style={styles.primaryText}>{t('playlists.addVideo')}</Text>
                    </Pressable>
                  </View>
                ) : null}

                {active.items.length === 0 ? (
                  <Text style={[styles.hint, { color: C.muted, marginTop: 12 }]}>{t('playlists.noVideos')}</Text>
                ) : (
                  <View style={styles.items}>
                    {active.items.map((item) => (
                      <View
                        key={item.id}
                        style={[styles.item, { backgroundColor: C.inputBg, borderColor: C.border }]}
                      >
                        {item.video ? (
                          <Pressable
                            onPress={() => navigation.navigate('Videos', { videoId: item.video?.id })}
                            style={{ flex: 1 }}
                          >
                            <Text style={[styles.itemTitle, { color: C.text }]} numberOfLines={1}>
                              {item.video.title}
                            </Text>
                          </Pressable>
                        ) : (
                          <Text style={[styles.itemTitle, { color: C.muted, flex: 1 }]}>
                            {t('playlists.videoUnavailable')}
                          </Text>
                        )}
                        {isOwner ? (
                          <Pressable
                            onPress={() => void removeVideo(item.id)}
                            disabled={busy}
                            hitSlop={8}
                            accessibilityLabel={t('playlists.removeVideo')}
                          >
                            <Ionicons name="close" size={18} color={C.muted} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  link: { fontSize: 13, fontWeight: '700' },
  form: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10, marginBottom: 12 },
  formTitle: { fontSize: 13, fontWeight: '700' },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { minHeight: 64, textAlignVertical: 'top' },
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
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  message: { fontSize: 13, marginBottom: 12 },
  hint: { fontSize: 13, textAlign: 'center' },
  empty: { borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 12 },
  list: { gap: 8, marginBottom: 14 },
  row: { borderRadius: 16, borderWidth: 1, padding: 14 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { fontSize: 12, marginTop: 4 },
  detail: { borderRadius: 18, borderWidth: 1, padding: 16 },
  detailHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailTitle: { fontSize: 18, fontWeight: '800' },
  detailBody: { fontSize: 13, lineHeight: 20, marginTop: 6 },
  iconRow: { flexDirection: 'row', gap: 12 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
  addInput: { flex: 1 },
  items: { marginTop: 14, gap: 8 },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemTitle: { fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  ghost: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  ghostText: { fontSize: 13, fontWeight: '700' },
});
