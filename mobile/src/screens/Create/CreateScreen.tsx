import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, Alert, Image, Dimensions, ActivityIndicator, Modal } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const BACKDROP_PRESETS = [
  { key: 'nebula', label: 'Nebula', color: '#6D28D9' },
  { key: 'orbit', label: 'Orbit', color: '#0891B2' },
  { key: 'void', label: 'Void', color: '#111827' },
  { key: 'aurora', label: 'Aurora', color: '#10B981' },
  { key: 'sunset', label: 'Sunset', color: '#F97316' },
];

type Visibility = 'public' | 'followers' | 'mentioned' | 'subscribers';
type CreatorTier = {
  id: string | number;
  name: string;
  price_usd?: number;
  price_usd_cents?: number;
  is_active?: boolean;
};

export default function CreateScreen({ navigation }: any) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const route = useRoute<any>();
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<Array<{ uri: string; type: 'image' | 'video' }>>([]);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [creatorTiers, setCreatorTiers] = useState<CreatorTier[]>([]);
  const [requiredTier, setRequiredTier] = useState<string | number | null>(null);
  const [replyControl, setReplyControl] = useState<'everyone' | 'followers' | 'nobody'>('everyone');
  const [threadParts, setThreadParts] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [mode, setMode] = useState<'hub' | 'post' | 'story' | 'reel'>(
    route.params?.mode === 'story' || route.params?.mode === 'reel' || route.params?.mode === 'post'
      ? route.params.mode
      : route.params?.inspiration
        ? 'post'
        : 'hub',
  );
  const remixOf = route.params?.remix_of != null ? Number(route.params.remix_of) : null;
  const stitchOf = route.params?.stitch_of != null ? Number(route.params.stitch_of) : null;
  const presetMusic = route.params?.music_track != null ? Number(route.params.music_track) : null;

  const [reelVideo, setReelVideo] = useState<{ uri: string; name?: string; type?: string } | null>(null);
  const [tracks, setTracks] = useState<Array<{ id: number; title: string; artist_label?: string }>>([]);
  const [musicTrack, setMusicTrack] = useState<number | null>(presetMusic);
  const [mood, setMood] = useState('cosmic');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [backdrop, setBackdrop] = useState('');
  const [chromaEnabled, setChromaEnabled] = useState(false);
  const [musicStartSeconds, setMusicStartSeconds] = useState('0');
  const [musicEndSeconds, setMusicEndSeconds] = useState('');
  const [scheduleHours, setScheduleHours] = useState<number | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledModalOpen, setScheduledModalOpen] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [postType, setPostType] = useState<'normal' | 'poll' | 'question'>('normal');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLng, setLocationLng] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);

  useEffect(() => {
    const inspiration = route.params?.inspiration as string | undefined;
    if (inspiration?.trim()) {
      setContent(inspiration.trim());
      setCharCount(inspiration.trim().length);
    }
  }, [route.params?.inspiration]);

  useEffect(() => {
    const nextMode = route.params?.mode;
    if (nextMode === 'reel' || nextMode === 'post' || nextMode === 'story') {
      setMode(nextMode);
    }
    if (route.params?.music_track != null) {
      setMusicTrack(Number(route.params.music_track));
    }
  }, [route.params?.mode, route.params?.music_track, route.params?.remix_of, route.params?.stitch_of]);

  useEffect(() => {
    if (musicTrack == null) {
      setMusicStartSeconds('0');
      setMusicEndSeconds('');
    }
  }, [musicTrack]);

  useEffect(() => {
    if (mode !== 'reel') return;
    void (async () => {
      try {
        const [rows, tpls] = await Promise.all([api.getReelMusic(), api.getReelTemplates()]);
        setTracks(rows);
        setTemplates(tpls);
        if (presetMusic) setMusicTrack(presetMusic);
      } catch {
        setTracks([]);
        setTemplates([]);
      }
    })();
  }, [mode, presetMusic]);

  useEffect(() => {
    if (mode !== 'post') return;
    void (async () => {
      try {
        const rows = (await api.getMyCreatorTiers()) as CreatorTier[];
        const active = rows.filter((tier) => tier.is_active !== false);
        setCreatorTiers(active);
        setRequiredTier((current) => current ?? active[0]?.id ?? null);
      } catch {
        setCreatorTiers([]);
        setRequiredTier(null);
      }
    })();
  }, [mode]);

  const applyTemplate = (tpl: any) => {
    setTemplateId(tpl.id);
    if (tpl.mood) setMood(tpl.mood);
    if (tpl.music_track) setMusicTrack(tpl.music_track);
    if (tpl.backdrop_preset) {
      setBackdrop(tpl.backdrop_preset);
      setChromaEnabled(true);
    }
  };

  const handleContentChange = useCallback((text: string) => {
    setContent(text);
    setCharCount(text.length);
  }, []);

  const pickMediaSource = (preferVideo = false) => {
    if (media.length >= 4) {
      Alert.alert('Limit reached', 'You can add up to 4 media items');
      return;
    }
    Alert.alert(preferVideo ? 'Capture video' : 'Add media', 'How do you want to capture?', [
      { text: 'Camera', onPress: () => void pickMedia(true, preferVideo) },
      { text: 'Library', onPress: () => void pickMedia(false, preferVideo) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickMedia = async (fromCamera = false, preferVideo = false) => {
    if (media.length >= 4) {
      Alert.alert('Limit reached', 'You can add up to 4 media items');
      return;
    }

    const permissionResult = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera / media access');
      return;
    }

    const mediaTypes = preferVideo
      ? ImagePicker.MediaTypeOptions.Videos
      : ImagePicker.MediaTypeOptions.All;

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes,
          quality: 0.8,
          videoMaxDuration: 60,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes,
          allowsMultipleSelection: false,
          quality: 0.8,
        });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      setMedia((prev) => [...prev, { uri: asset.uri, type }]);
    }
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const setSchedulePreset = (hours: number | null) => {
    setScheduleHours(hours);
    if (hours == null) {
      setScheduleDate('');
      setScheduleTime('');
    }
  };

  const getScheduledPublishAt = () => {
    if (postType === 'poll') return null;
    if (scheduleDate.trim() || scheduleTime.trim()) {
      const date = scheduleDate.trim();
      const time = scheduleTime.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return 'invalid';
      const parsed = new Date(`${date}T${time}:00`);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) return 'invalid';
      return parsed.toISOString();
    }
    if (scheduleHours != null) {
      return new Date(Date.now() + scheduleHours * 60 * 60 * 1000).toISOString();
    }
    return null;
  };

  const resetPostDraft = () => {
    setContent('');
    setMedia([]);
    setThreadParts(['']);
    setCharCount(0);
    setScheduleHours(null);
    setScheduleDate('');
    setScheduleTime('');
    setPostType('normal');
    setPollOptions(['', '']);
    setLocationName('');
    setLocationLat('');
    setLocationLng('');
    setShowLocationInput(false);
    setVisibility('public');
    setRequiredTier(null);
  };

  const activatePoll = () => {
    setPostType('poll');
    setThreadParts(['']);
    setScheduleHours(null);
    setScheduleDate('');
    setScheduleTime('');
  };

  const updateThreadPart = (partIndex: number, text: string) => {
    setThreadParts((prev) => {
      const next = [...prev];
      next[partIndex] = text;
      return next;
    });
  };

  const moveThreadPart = (partIndex: number, direction: -1 | 1) => {
    setThreadParts((prev) => {
      const next = [...prev];
      const target = partIndex + direction;
      if (partIndex <= 0 || target <= 0 || target >= next.length) return prev;
      [next[partIndex], next[target]] = [next[target], next[partIndex]];
      return next;
    });
  };

  const removeThreadPart = (partIndex: number) => {
    setThreadParts((prev) => prev.filter((_, i) => i !== partIndex));
  };

  const loadScheduledPosts = async () => {
    setScheduledLoading(true);
    try {
      setScheduledPosts(await api.getScheduledPosts());
    } catch {
      Alert.alert('Error', 'Could not load scheduled posts.');
    } finally {
      setScheduledLoading(false);
    }
  };

  const openScheduledModal = () => {
    setScheduledModalOpen(true);
    void loadScheduledPosts();
  };

  const cancelScheduledPost = async (id: string | number) => {
    try {
      await api.cancelScheduledPost(id);
      setScheduledPosts((prev) => prev.filter((item) => item.id !== id));
    } catch {
      Alert.alert('Error', 'Could not cancel this scheduled post.');
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const prefs = await api.getPreferences();
        const rc = prefs.default_reply_control;
        if (rc === 'everyone' || rc === 'followers' || rc === 'nobody') {
          setReplyControl(rc);
        }
      } catch {
        /* keep default */
      }
    })();
  }, []);

  const handlePost = async () => {
    const isPoll = postType === 'poll';
    const cleanedPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
    const parts = isPoll
      ? [content.trim()].filter(Boolean)
      : [content.trim(), ...threadParts.slice(1).map((p) => p.trim())].filter(Boolean);
    if (!parts.length && media.length === 0) {
      Alert.alert('Empty post', 'Add some content or media to post');
      return;
    }

    if (charCount > 280) {
      Alert.alert('Too long', 'Posts must be 280 characters or less');
      return;
    }

    if (isPoll && cleanedPollOptions.length < 2) {
      Alert.alert('Poll needs options', 'Add at least two poll options.');
      return;
    }

    const publishAt = getScheduledPublishAt();
    if (publishAt === 'invalid') {
      Alert.alert('Invalid schedule', 'Use YYYY-MM-DD and HH:MM, and choose a future time.');
      return;
    }

    const lat = locationLat.trim() ? Number.parseFloat(locationLat.trim()) : undefined;
    const lng = locationLng.trim() ? Number.parseFloat(locationLng.trim()) : undefined;
    if ((locationLat.trim() && !Number.isFinite(lat)) || (locationLng.trim() && !Number.isFinite(lng))) {
      Alert.alert('Invalid location', 'Latitude and longitude must be numbers.');
      return;
    }

    setLoading(true);
    try {
      if (publishAt) {
        await api.createScheduledPost(
          {
            text: parts[0] || content.trim(),
            visibility: visibility === 'mentioned' ? 'followers' : visibility,
            reply_control: replyControl,
            location_name: locationName.trim() || undefined,
            location_lat: lat,
            location_lng: lng,
            required_tier: visibility === 'subscribers' ? requiredTier : undefined,
          },
          publishAt,
        ).then(async (scheduled) => {
          if (media.length > 0 && scheduled?.id) {
            await api.addScheduledMedia(scheduled.id, media);
          }
        });
        resetPostDraft();
        Alert.alert('Scheduled', 'Signal queued for your selected time.');
        navigation.navigate('Home');
        return;
      }

      let parentId: string | number | undefined;
      const firstText = parts[0] || content.trim();
      const first = await api.createPost({
        text: firstText,
        post_type: postType,
        poll_options: isPoll ? cleanedPollOptions : undefined,
        location_name: locationName.trim() || undefined,
        location_lat: lat,
        location_lng: lng,
        visibility: visibility === 'mentioned' ? 'followers' : visibility,
        reply_control: replyControl,
        required_tier: visibility === 'subscribers' ? requiredTier : undefined,
        media,
      });
      parentId = first?.id;
      for (let i = 1; i < parts.length; i += 1) {
        if (!parentId) break;
        const next = await api.createPost({
          text: parts[i],
          visibility: visibility === 'mentioned' ? 'followers' : visibility,
          reply_control: replyControl,
          required_tier: visibility === 'subscribers' ? requiredTier : undefined,
          thread_parent: parentId,
        });
        parentId = next?.id ?? parentId;
      }
      resetPostDraft();
      navigation.navigate('Home');
    } catch (error) {
      console.error('Failed to create post:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const captureReelVideo = async (fromCamera: boolean) => {
    const permissionResult = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera / media access');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          videoMaxDuration: 60,
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsMultipleSelection: false,
          quality: 0.85,
          videoMaxDuration: 60,
        });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setReelVideo({
      uri: asset.uri,
      name: asset.fileName || 'clip.mp4',
      type: asset.mimeType || 'video/mp4',
    });
  };

  const publishReel = async () => {
    if (!reelVideo) {
      Alert.alert('Need video', 'Capture or pick a clip first.');
      return;
    }
    const trimStart = musicTrack != null ? Number.parseFloat(musicStartSeconds || '0') : 0;
    const trimEnd = musicTrack != null && musicEndSeconds.trim()
      ? Number.parseFloat(musicEndSeconds.trim())
      : null;
    if (
      musicTrack != null &&
      (!Number.isFinite(trimStart) || trimStart < 0 || (trimEnd != null && (!Number.isFinite(trimEnd) || trimEnd <= trimStart)))
    ) {
      Alert.alert('Invalid trim', 'Use positive seconds, and keep end after start.');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('video', {
        uri: reelVideo.uri,
        name: reelVideo.name || 'clip.mp4',
        type: reelVideo.type || 'video/mp4',
      } as any);
      if (content.trim()) form.append('caption', content.trim());
      form.append('mood', mood);
      if (musicTrack != null) {
        form.append('music_track', String(musicTrack));
        form.append('music_start_seconds', String(trimStart || 0));
        if (trimEnd != null) form.append('music_end_seconds', String(trimEnd));
      }
      const trackTitle = tracks.find((t) => t.id === musicTrack)?.title;
      form.append('sound_label', trackTitle || 'Original signal');
      if (remixOf != null) form.append('remix_of', String(remixOf));
      if (stitchOf != null) form.append('stitch_of', String(stitchOf));
      if (templateId != null) form.append('template', String(templateId));
      const tpl = templates.find((t) => t.id === templateId);
      const effectMeta: Record<string, unknown> = {};
      if (chromaEnabled && backdrop) {
        effectMeta.backdrop = backdrop;
        effectMeta.chroma_key = true;
      }
      if (tpl?.overlay_stickers?.length) effectMeta.overlays = tpl.overlay_stickers;
      if (tpl?.overlay_text) effectMeta.overlay_text = tpl.overlay_text;
      if (Object.keys(effectMeta).length) {
        form.append('effect_meta', JSON.stringify(effectMeta));
      }
      await api.createReel(form);
      Alert.alert('Signal launched', 'Your reel is live.');
      setContent('');
      setReelVideo(null);
      setMode('hub');
      navigation.navigate('Reels');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not create reel.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (mode === 'reel') {
      if (reelVideo || content.trim()) {
        Alert.alert('Discard signal?', 'Your draft will be lost.', [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setReelVideo(null);
              setMode('hub');
            },
          },
        ]);
        return;
      }
      setMode('hub');
      return;
    }
    if (mode !== 'hub' && mode !== 'post') {
      setMode('hub');
      return;
    }
    if (mode === 'post' && (content.trim() || media.length > 0)) {
      Alert.alert('Discard post?', 'Your draft will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', onPress: () => setMode('hub'), style: 'destructive' },
      ]);
      return;
    }
    if (mode === 'hub') navigation.goBack();
    else setMode('hub');
  };

  if (mode === 'hub') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.text }]}>Close</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Launch a Signal</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 8, lineHeight: 20 }}>
            Choose how your signal enters the Cosmory — not just another post.
          </Text>
          {[
            { key: 'post' as const, title: 'Post', desc: 'Share text, photos & polls to the feed', mark: '✦' },
            { key: 'story' as const, title: 'Story Studio', desc: 'Stickers, draw, polls & camera', mark: '◎' },
            { key: 'reel' as const, title: 'Reel', desc: 'Vertical pulse — camera, music, remix', mark: '▶' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => {
                if (opt.key === 'post') setMode('post');
                else if (opt.key === 'story') navigation.navigate('StoryStudio');
                else setMode('reel');
              }}
              style={{
                padding: 18,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: 'rgba(167,139,250,0.28)',
                backgroundColor: colors.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(124,58,237,0.16)',
                }}
              >
                <Text style={{ fontSize: 20, color: '#A78BFA' }}>{opt.mark}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{opt.title}</Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{opt.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'reel') {
    const selectedBackdropPreset = BACKDROP_PRESETS.find((preset) => preset.key === backdrop) || BACKDROP_PRESETS[0];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Launch pulse</Text>
          <TouchableOpacity
            onPress={() => void publishReel()}
            style={styles.headerButton}
            disabled={loading || !reelVideo}
          >
            {loading ? (
              <ActivityIndicator color="#A78BFA" />
            ) : (
              <Text style={[styles.headerButtonText, { color: reelVideo ? '#A78BFA' : colors.disabled }]}>
                Launch
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {remixOf != null ? (
            <Text style={{ color: '#A78BFA', fontWeight: '700' }}>↻ Remixing signal #{remixOf}</Text>
          ) : null}
          {stitchOf != null ? (
            <Text style={{ color: '#22D3EE', fontWeight: '700' }}>⧉ Weaving signal #{stitchOf}</Text>
          ) : null}

          <TouchableOpacity
            onPress={() =>
              Alert.alert('Capture reel', 'How do you want to capture?', [
                { text: 'Camera', onPress: () => void captureReelVideo(true) },
                { text: 'Library', onPress: () => void captureReelVideo(false) },
                { text: 'Cancel', style: 'cancel' },
              ])
            }
            style={{
              height: 180,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: 'rgba(167,139,250,0.35)',
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {reelVideo ? (
              <Text style={{ color: colors.text, fontWeight: '700' }}>Clip ready — tap to replace</Text>
            ) : (
              <Text style={{ color: colors.textSecondary }}>Camera or library · max 60s</Text>
            )}
          </TouchableOpacity>

          {templates.length > 0 ? (
            <>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Pulse packs</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {templates.map((tpl) => (
                  <TouchableOpacity
                    key={tpl.id}
                    onPress={() => applyTemplate(tpl)}
                    style={{
                      width: 140,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: templateId === tpl.id ? '#A78BFA' : colors.border,
                      backgroundColor:
                        templateId === tpl.id ? 'rgba(124,58,237,0.2)' : colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{tpl.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 4 }} numberOfLines={2}>
                      {tpl.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={{ color: colors.text, fontWeight: '800' }}>Green screen backdrop</Text>
          <TouchableOpacity
            onPress={() => {
              setChromaEnabled((v) => !v);
              if (!chromaEnabled && !backdrop) setBackdrop(BACKDROP_PRESETS[0].key);
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: chromaEnabled ? 'rgba(124,58,237,0.22)' : colors.surface,
              borderWidth: 1,
              borderColor: chromaEnabled ? '#A78BFA' : colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {chromaEnabled ? 'On — pick a cosmic backdrop' : 'Off — tap to enable'}
            </Text>
          </TouchableOpacity>
          {chromaEnabled ? (
            <>
              <View
                style={{
                  minHeight: 120,
                  borderRadius: 18,
                  padding: 14,
                  backgroundColor: selectedBackdropPreset.color,
                  overflow: 'hidden',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Preview backdrop</Text>
                  <TouchableOpacity
                    onPress={() => setChromaEnabled(false)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>On</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: 12, lineHeight: 17 }}>
                  Green screen metadata will use {selectedBackdropPreset.label}. Mobile preview is a backdrop note,
                  not live pixel processing.
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {BACKDROP_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.key}
                    onPress={() => setBackdrop(preset.key)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: backdrop === preset.key ? 'rgba(124,58,237,0.3)' : colors.surface,
                      borderWidth: 1,
                      borderColor: backdrop === preset.key ? '#A78BFA' : colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: preset.color,
                      }}
                    />
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{preset.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}

          <TextInput
            value={content}
            onChangeText={handleContentChange}
            placeholder="Caption your signal…"
            placeholderTextColor={colors.textSecondary}
            style={{
              minHeight: 80,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.text,
              padding: 14,
              textAlignVertical: 'top',
            }}
            multiline
            maxLength={280}
          />

          <Text style={{ color: colors.text, fontWeight: '800' }}>Signal track</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              onPress={() => setMusicTrack(null)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: musicTrack == null ? 'rgba(124,58,237,0.25)' : colors.surface,
                borderWidth: 1,
                borderColor: musicTrack == null ? '#A78BFA' : colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>Video audio</Text>
            </TouchableOpacity>
            {tracks.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setMusicTrack(t.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: musicTrack === t.id ? 'rgba(124,58,237,0.25)' : colors.surface,
                  borderWidth: 1,
                  borderColor: musicTrack === t.id ? '#A78BFA' : colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{t.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {musicTrack != null ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>Music trim</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>Start second</Text>
                  <TextInput
                    value={musicStartSeconds}
                    onChangeText={setMusicStartSeconds}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    style={[styles.compactInput, { color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 4 }}>End second</Text>
                  <TextInput
                    value={musicEndSeconds}
                    onChangeText={setMusicEndSeconds}
                    placeholder="Optional"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    style={[styles.compactInput, { color: colors.text, borderColor: colors.border, marginBottom: 0 }]}
                  />
                </View>
              </View>
            </View>
          ) : null}

          <Text style={{ color: colors.text, fontWeight: '800' }}>Mood</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['cosmic', 'pulse', 'void', 'spark', 'dream'].map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMood(m)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: mood === m ? 'rgba(124,58,237,0.25)' : colors.surface,
                  borderWidth: 1,
                  borderColor: mood === m ? '#A78BFA' : colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '700', textTransform: 'capitalize' }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode !== 'post') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const visibilityOptions: Array<{ value: Visibility; label: string; desc: string }> = [
    { value: 'public', label: '🌍 Public', desc: 'Everyone can see' },
    { value: 'followers', label: '👥 Followers', desc: 'Only your followers' },
    { value: 'subscribers', label: '⭐ Subscribers', desc: 'Only active subscribers or a selected tier' },
    { value: 'mentioned', label: '💬 Mentioned', desc: 'Only people you mention' },
  ];
  const isPoll = postType === 'poll';
  const cleanedPollOptions = pollOptions.map((option) => option.trim()).filter(Boolean);
  const hasSchedule = !isPoll && (scheduleHours != null || !!scheduleDate.trim() || !!scheduleTime.trim());
  const canSubmit =
    !loading &&
    (!!content.trim() || media.length > 0) &&
    charCount <= 280 &&
    (!isPoll || cleanedPollOptions.length >= 2);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardVerticalOffset={0}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={[styles.headerButtonText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Create Post</Text>
          <TouchableOpacity
            style={[styles.postButton, loading && styles.postButtonDisabled, { backgroundColor: colors.primary }]}
            onPress={handlePost}
            disabled={!canSubmit}
          >
            {loading ? (
              <View style={styles.postButtonLoading}>
                <View style={{ ...styles.spinner, borderColor: '#fff' }} />
              </View>
            ) : (
              <Text style={styles.postButtonText}>{hasSchedule ? 'Schedule' : 'Post'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Composer */}
          <View style={[styles.composer, { backgroundColor: colors.surface }]}>
            {user && user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.composerAvatar} />
            ) : (
              <View style={[styles.composerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <View style={styles.composerInputWrapper}>
              <TextInput
                style={[styles.composerInput, { color: colors.text, backgroundColor: 'transparent' }]}
                placeholder="What's happening?"
                placeholderTextColor={colors.textSecondary}
                value={content}
                onChangeText={handleContentChange}
                multiline
                maxLength={280}
                autoFocus
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: charCount > 250 ? colors.error : colors.textMuted }]}>
                {charCount}/280
              </Text>
            </View>
          </View>

          {/* Media Preview */}
          {media.length > 0 && (
            <View style={styles.mediaPreview}>
              {media.map((m, i) => (
                <View key={i} style={styles.mediaPreviewItem}>
                  {m.type === 'video' ? (
                    <View style={styles.mediaVideoPreview}>
                      <Image source={{ uri: m.uri }} style={styles.mediaPreviewImage} resizeMode="cover" />
                      <View style={styles.playOverlay}>
                        <Text style={{ fontSize: 28, color: '#fff' }}>▶</Text>
                      </View>
                    </View>
                  ) : (
                    <Image source={{ uri: m.uri }} style={styles.mediaPreviewImage} resizeMode="cover" />
                  )}
                  <TouchableOpacity onPress={() => removeMedia(i)} style={styles.removeMediaButton}>
                    <Text style={{ fontSize: 16, color: '#fff' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {isPoll ? (
            <View style={[styles.section, { backgroundColor: colors.surface, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 0 }]}>Poll options</Text>
                <TouchableOpacity
                  onPress={() => {
                    setPostType('normal');
                    setPollOptions(['', '']);
                  }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Remove</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.visibilityDesc, { color: colors.textSecondary, marginBottom: 10 }]}>
                Add 2–8 choices. Polls cannot be scheduled or threaded.
              </Text>
              {pollOptions.map((option, idx) => (
                <TextInput
                  key={`poll-${idx}`}
                  value={option}
                  onChangeText={(text) =>
                    setPollOptions((prev) => {
                      const next = [...prev];
                      next[idx] = text;
                      return next;
                    })
                  }
                  placeholder={`Option ${idx + 1}`}
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.compactInput, { color: colors.text, borderColor: colors.border }]}
                  maxLength={80}
                />
              ))}
              <View style={{ flexDirection: 'row', gap: 14, marginTop: 2 }}>
                {pollOptions.length < 8 ? (
                  <TouchableOpacity onPress={() => setPollOptions((prev) => [...prev, ''])}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Add option</Text>
                  </TouchableOpacity>
                ) : null}
                {pollOptions.length > 2 ? (
                  <TouchableOpacity onPress={() => setPollOptions((prev) => prev.slice(0, -1))}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Remove last</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          {showLocationInput || locationName ? (
            <View style={[styles.section, { backgroundColor: colors.surface, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Location</Text>
              <TextInput
                value={locationName}
                onChangeText={setLocationName}
                placeholder="Place name"
                placeholderTextColor={colors.textSecondary}
                style={[styles.compactInput, { color: colors.text, borderColor: colors.border }]}
                maxLength={80}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={locationLat}
                  onChangeText={setLocationLat}
                  placeholder="Lat (optional)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  style={[styles.compactInput, { flex: 1, color: colors.text, borderColor: colors.border }]}
                />
                <TextInput
                  value={locationLng}
                  onChangeText={setLocationLng}
                  placeholder="Lng (optional)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  style={[styles.compactInput, { flex: 1, color: colors.text, borderColor: colors.border }]}
                />
              </View>
            </View>
          ) : null}

          {/* Who can echo back */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Who can echo back?</Text>
            {([
              { value: 'everyone' as const, label: 'Everyone' },
              { value: 'followers' as const, label: 'Followers' },
              { value: 'nobody' as const, label: 'No one' },
            ]).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.visibilityOption, replyControl === opt.value && styles.visibilityOptionSelected, { borderColor: colors.border }]}
                onPress={() => setReplyControl(opt.value)}
              >
                <Text style={[styles.visibilityLabel, { color: colors.text }]}>{opt.label}</Text>
                {replyControl === opt.value && (
                  <View style={[styles.visibilityCheck, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Constellation thread parts */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Constellation thread</Text>
            {isPoll ? (
              <Text style={[styles.visibilityDesc, { color: colors.textSecondary }]}>
                Thread parts are disabled for polls.
              </Text>
            ) : (
              <>
                {threadParts.slice(1).map((part, idx) => {
                  const partIndex = idx + 1;
                  return (
                    <View key={`thread-${partIndex}`} style={[styles.threadCard, { borderColor: colors.border, backgroundColor: colors.background }]}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.visibilityLabel, { color: colors.text }]}>Part {partIndex + 1}</Text>
                        <Text style={[styles.visibilityDesc, { color: part.length > 250 ? colors.error : colors.textSecondary }]}>
                          {part.length}/280
                        </Text>
                      </View>
                      <TextInput
                        value={part}
                        onChangeText={(text) => updateThreadPart(partIndex, text)}
                        placeholder={`Continue part ${partIndex + 1}`}
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.threadInput, { color: colors.text, borderColor: colors.border }]}
                        multiline
                        maxLength={280}
                      />
                      <View style={styles.threadActions}>
                        <TouchableOpacity disabled={partIndex === 1} onPress={() => moveThreadPart(partIndex, -1)}>
                          <Text style={{ color: partIndex === 1 ? colors.disabled : colors.primary, fontWeight: '700' }}>Up</Text>
                        </TouchableOpacity>
                        <TouchableOpacity disabled={partIndex === threadParts.length - 1} onPress={() => moveThreadPart(partIndex, 1)}>
                          <Text style={{ color: partIndex === threadParts.length - 1 ? colors.disabled : colors.primary, fontWeight: '700' }}>Down</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeThreadPart(partIndex)}>
                          <Text style={{ color: colors.error, fontWeight: '700' }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
            {!isPoll && threadParts.length < 6 ? (
              <TouchableOpacity
                onPress={() => setThreadParts((prev) => [...prev, ''])}
                style={{ paddingVertical: 8 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>+ Add thread part</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Visibility Selector */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.text }]}>Who can see this?</Text>
            {visibilityOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.visibilityOption, visibility === opt.value && styles.visibilityOptionSelected, { borderColor: colors.border }]}
                onPress={() => setVisibility(opt.value)}
              >
                <View style={styles.visibilityOptionContent}>
                  <Text style={[styles.visibilityLabel, { color: colors.text }]}>{opt.label}</Text>
                  <Text style={[styles.visibilityDesc, { color: colors.textSecondary }]}>{opt.desc}</Text>
                </View>
                {visibility === opt.value && (
                  <View style={[styles.visibilityCheck, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            ))}
            {visibility === 'subscribers' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.visibilityDesc, { color: colors.textSecondary, marginBottom: 8 }]}>
                  Optional: require a specific creator tier.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => setRequiredTier(null)}
                    style={[
                      styles.tierChip,
                      {
                        borderColor: requiredTier == null ? colors.primary : colors.border,
                        backgroundColor: requiredTier == null ? 'rgba(124,58,237,0.18)' : colors.background,
                      },
                    ]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Any subscriber</Text>
                  </TouchableOpacity>
                  {creatorTiers.map((tier) => {
                    const selected = String(requiredTier) === String(tier.id);
                    return (
                      <TouchableOpacity
                        key={String(tier.id)}
                        onPress={() => setRequiredTier(tier.id)}
                        style={[
                          styles.tierChip,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? 'rgba(124,58,237,0.18)' : colors.background,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
                          {tier.name}
                          {tier.price_usd != null || tier.price_usd_cents != null
                            ? ` · $${Number(tier.price_usd ?? (tier.price_usd_cents || 0) / 100).toFixed(2)}`
                            : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {!creatorTiers.length ? (
                  <Text style={[styles.visibilityDesc, { color: colors.textSecondary, marginTop: 8 }]}>
                    No active tiers found. The post will be subscriber-only without a tier requirement.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Schedule */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: colors.text, marginBottom: 0 }]}>Schedule</Text>
              <TouchableOpacity onPress={openScheduledModal}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Scheduled</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.visibilityDesc, { color: colors.textSecondary, marginBottom: 8 }]}>
              {isPoll
                ? 'Scheduling is disabled for polls.'
                : hasSchedule
                  ? 'Queued for the selected time'
                  : 'Post now, pick a delay, or enter a precise time'}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { h: null as number | null, label: 'Now' },
                { h: 1, label: '1h' },
                { h: 3, label: '3h' },
                { h: 24, label: '24h' },
              ].map((opt) => {
                const active = opt.h == null
                  ? scheduleHours == null && !scheduleDate.trim() && !scheduleTime.trim()
                  : scheduleHours === opt.h;
                return (
                  <TouchableOpacity
                    key={String(opt.h)}
                    onPress={() => setSchedulePreset(opt.h)}
                    disabled={isPoll}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: active ? colors.primary : colors.background,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: isPoll ? 0.45 : 1,
                    }}
                  >
                    <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: 13 }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.scheduleInputs}>
              <TextInput
                value={scheduleDate}
                onChangeText={(text) => {
                  setScheduleDate(text);
                  setScheduleHours(null);
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                editable={!isPoll}
                style={[styles.scheduleInput, { color: colors.text, borderColor: colors.border, opacity: isPoll ? 0.45 : 1 }]}
              />
              <TextInput
                value={scheduleTime}
                onChangeText={(text) => {
                  setScheduleTime(text);
                  setScheduleHours(null);
                }}
                placeholder="HH:MM"
                placeholderTextColor={colors.textSecondary}
                editable={!isPoll}
                style={[styles.scheduleInput, { color: colors.text, borderColor: colors.border, opacity: isPoll ? 0.45 : 1 }]}
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={[styles.actionsSection, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TouchableOpacity style={styles.actionButton} onPress={() => pickMediaSource(false)} disabled={media.length >= 4}>
              <Text style={{ fontSize: 24, color: media.length >= 4 ? colors.disabled : colors.primary }}>📷</Text>
              <Text style={[styles.actionButtonLabel, { color: media.length >= 4 ? colors.disabled : colors.primary }]}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => pickMediaSource(true)} disabled={media.length >= 4}>
              <Text style={{ fontSize: 24, color: media.length >= 4 ? colors.disabled : colors.primary }}>🎥</Text>
              <Text style={[styles.actionButtonLabel, { color: media.length >= 4 ? colors.disabled : colors.primary }]}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => setShowLocationInput((value) => !value)}>
              <Text style={{ fontSize: 24, color: locationName ? colors.primary : colors.textSecondary }}>📍</Text>
              <Text style={[styles.actionButtonLabel, { color: locationName ? colors.primary : colors.textSecondary }]}>Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={activatePoll}>
              <Text style={{ fontSize: 24, color: isPoll ? colors.primary : colors.textSecondary }}>📊</Text>
              <Text style={[styles.actionButtonLabel, { color: isPoll ? colors.primary : colors.textSecondary }]}>Poll</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <Modal visible={scheduledModalOpen} animationType="slide" transparent onRequestClose={() => setScheduledModalOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.scheduledSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Scheduled posts</Text>
                <TouchableOpacity onPress={() => setScheduledModalOpen(false)}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
                </TouchableOpacity>
              </View>
              {scheduledLoading ? (
                <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
              ) : scheduledPosts.length ? (
                <ScrollView style={{ maxHeight: 360 }}>
                  {scheduledPosts.map((item) => (
                    <View key={String(item.id)} style={[styles.scheduledItem, { borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={2}>
                          {item.payload?.text || item.text || 'Scheduled signal'}
                        </Text>
                        <Text style={[styles.visibilityDesc, { color: colors.textSecondary }]}>
                          {item.publish_at ? new Date(item.publish_at).toLocaleString() : 'Pending'}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => void cancelScheduledPost(item.id)}>
                        <Text style={{ color: colors.error, fontWeight: '700' }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={[styles.visibilityDesc, { color: colors.textSecondary, marginVertical: 20 }]}>
                  No scheduled posts pending.
                </Text>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  headerButton: { padding: 8 },
  headerButtonText: { fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  postButton: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, minWidth: 72, alignItems: 'center' },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  postButtonLoading: { width: 20, height: 20 },
  spinner: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#fff', borderRightColor: 'transparent' },
  scrollContent: { paddingBottom: 100 },
  composer: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  composerAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  composerAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  composerInputWrapper: { flex: 1 },
  composerInput: { fontSize: 18, minHeight: 80, paddingVertical: 4 },
  charCount: { textAlign: 'right', fontSize: 13, fontWeight: '500', marginTop: 4 },
  mediaPreview: { paddingHorizontal: 16, paddingBottom: 16 },
  mediaPreviewItem: { position: 'relative', width: 100, height: 100, borderRadius: 12, overflow: 'hidden', marginRight: 12 },
  mediaPreviewImage: { width: '100%', height: '100%' },
  mediaVideoPreview: { width: '100%', height: '100%', position: 'relative' },
  playOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  removeMediaButton: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  section: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  visibilityOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  visibilityOptionSelected: { borderWidth: 2 },
  visibilityOptionContent: { flex: 1 },
  visibilityLabel: { fontSize: 15, fontWeight: '600' },
  visibilityDesc: { fontSize: 13, marginTop: 2 },
  visibilityCheck: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  compactInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, fontSize: 15 },
  threadCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  threadInput: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 72, fontSize: 16, textAlignVertical: 'top' },
  threadActions: { flexDirection: 'row', gap: 18, marginTop: 10 },
  tierChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  scheduleInputs: { flexDirection: 'row', gap: 8, marginTop: 10 },
  scheduleInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  actionsSection: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  actionButton: { flex: 1, flexDirection: 'column', alignItems: 'center', paddingVertical: 12 },
  actionButtonLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  scheduledSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, maxHeight: '78%' },
  scheduledItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
});