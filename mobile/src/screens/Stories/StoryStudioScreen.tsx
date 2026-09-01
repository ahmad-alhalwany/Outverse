import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useLocale } from '@/i18n/LocaleProvider';
import StoryOverlaysLayer from '@/components/stories/StoryOverlaysLayer';
import {
  CAPSULE_DURATIONS,
  COUNTDOWN_DURATIONS,
  STORY_BACKGROUNDS,
  STORY_BRUSH_COLORS,
  STORY_FILTERS,
  STORY_MAP_PRESETS,
  STORY_MOODS,
  STORY_STICKERS,
  STORY_TEMPLATES,
  STORY_TEXT_COLORS,
  backgroundColors,
  filterTint,
  newCountdownOverlay,
  newLocationOverlay,
  newMentionOverlay,
  newPollOverlay,
  newQuestionOverlay,
  newStickerOverlay,
  newTextOverlay,
  type StoryFilterKey,
  type StoryLocationOverlay,
  type StoryOverlay,
  type StoryStroke,
  type StoryTextOverlay,
} from '@/lib/storyStudio';

const { width: W, height: H } = Dimensions.get('window');
const STAGE_H = Math.min(H * 0.46, 420);

type Tool = 'none' | 'draw' | 'stickers' | 'mention-search';
type ExtraMedia = { uri: string; kind: 'image' | 'video' };

export default function StoryStudioScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { t } = useLocale();

  const initialUri = route.params?.uri as string | undefined;
  const initialType = (route.params?.mediaType as 'image' | 'video') || 'image';

  const [mode, setMode] = useState<'text' | 'media'>(initialUri ? 'media' : 'text');
  const [uri, setUri] = useState(initialUri || '');
  const [mediaType, setMediaType] = useState<'image' | 'video'>(initialType);
  const [extraMedia, setExtraMedia] = useState<ExtraMedia[]>([]);
  const [filterKey, setFilterKey] = useState<StoryFilterKey>('none');
  const [backgroundKey, setBackgroundKey] = useState(STORY_BACKGROUNDS[0].key);
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [drawing, setDrawing] = useState<StoryStroke[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('none');
  const [brushColor, setBrushColor] = useState(STORY_BRUSH_COLORS[0]);
  const [brushWidth, setBrushWidth] = useState(3);
  const [mood, setMood] = useState<string | null>(null);
  const [capsuleHours, setCapsuleHours] = useState<number | null>(null);
  const [audience, setAudience] = useState<'everyone' | 'close_friends'>('everyone');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<Array<{ id: number; username: string; name?: string }>>([]);
  const [showCloseFriends, setShowCloseFriends] = useState(false);
  const [closeFriends, setCloseFriends] = useState<Array<{ id: number; username: string; avatar?: string | null }>>([]);
  const [friendQuery, setFriendQuery] = useState('');
  const [friendResults, setFriendResults] = useState<Array<{ id: number; username: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const currentStroke = useRef<StoryStroke | null>(null);
  const selected = overlays.find((o) => o.id === selectedId) || null;

  const updateById = (id: string, patch: Partial<StoryOverlay>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? ({ ...o, ...patch } as StoryOverlay) : o)));
  };

  const updateSelected = (patch: Partial<StoryOverlay>) => {
    if (!selectedId) return;
    updateById(selectedId, patch);
  };

  const addOverlay = (el: StoryOverlay) => {
    setOverlays((prev) => [...prev, el]);
    setSelectedId(el.id);
    setTool('none');
  };

  const pick = async (fromCamera: boolean, append = false) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('stories.newTitle'), t('stories.permission'));
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.9,
          videoMaxDuration: 30,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.All,
          quality: 0.9,
          videoMaxDuration: 30,
          allowsMultipleSelection: !append,
          selectionLimit: 6,
        });
    if (result.canceled || !result.assets[0]) return;
    const [first, ...rest] = result.assets;
    if (append && uri) {
      setExtraMedia((prev) => [
        ...prev,
        ...result.assets.map((a) => ({
          uri: a.uri,
          kind: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
        })),
      ]);
      return;
    }
    setUri(first.uri);
    setMediaType(first.type === 'video' ? 'video' : 'image');
    setMode('media');
    if (rest.length) {
      setExtraMedia(
        rest.map((a) => ({
          uri: a.uri,
          kind: (a.type === 'video' ? 'video' : 'image') as 'image' | 'video',
        })),
      );
    }
  };

  const addLocation = async () => {
    const el = newLocationOverlay(t('stories.myLocation'));
    addOverlay(el);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      setOverlays((prev) =>
        prev.map((o) =>
          o.id === el.id && o.type === 'location'
            ? { ...o, lat: pos.coords.latitude, lng: pos.coords.longitude }
            : o,
        ),
      );
    } catch {
      /* user can pick a city preset */
    }
  };

  const applyTemplate = (tpl: (typeof STORY_TEMPLATES)[number]) => {
    setMode('text');
    setBackgroundKey(tpl.background);
    const existingText = overlays.find((o): o is StoryTextOverlay => o.type === 'text');
    if (existingText) {
      updateById(existingText.id, {
        color: tpl.textColor,
        fontWeight: tpl.fontWeight,
        fontSize: tpl.fontSize,
      });
      setSelectedId(existingText.id);
    } else {
      const el = newTextOverlay(t('stories.yourText'));
      el.color = tpl.textColor;
      el.fontWeight = tpl.fontWeight;
      el.fontSize = tpl.fontSize;
      addOverlay(el);
    }
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => tool === 'draw',
        onMoveShouldSetPanResponder: () => tool === 'draw',
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const stroke: StoryStroke = {
            points: [[(locationX / W) * 100, (locationY / STAGE_H) * 100]],
            color: brushColor,
            width: brushWidth,
          };
          currentStroke.current = stroke;
          setDrawing((d) => [...d, stroke]);
        },
        onPanResponderMove: (e) => {
          if (!currentStroke.current) return;
          const { locationX, locationY } = e.nativeEvent;
          currentStroke.current.points.push([(locationX / W) * 100, (locationY / STAGE_H) * 100]);
          const live = currentStroke.current;
          setDrawing((all) => {
            const next = all.slice();
            next[next.length - 1] = { ...live, points: [...live.points] };
            return next;
          });
        },
        onPanResponderRelease: () => {
          currentStroke.current = null;
        },
      }),
    [tool, brushColor, brushWidth],
  );

  const openCloseFriends = async () => {
    setShowCloseFriends(true);
    setFriendQuery('');
    setFriendResults([]);
    try {
      const friends = await api.getCloseFriends();
      setCloseFriends(
        (friends || []).map((f: any) => ({
          id: Number(f.id ?? f.friend?.id),
          username: f.username || f.friend?.username || '',
          avatar: f.avatar,
        })),
      );
    } catch {
      setCloseFriends([]);
    }
  };

  const searchMentions = async (q: string, forFriends = false) => {
    if (forFriends) setFriendQuery(q);
    else setMentionQuery(q);
    if (!q.trim()) {
      if (forFriends) setFriendResults([]);
      else setMentionResults([]);
      return;
    }
    try {
      const rows = await api.searchUsers(q.trim());
      if (forFriends) setFriendResults(rows);
      else setMentionResults(rows);
    } catch {
      if (forFriends) setFriendResults([]);
      else setMentionResults([]);
    }
  };

  const toggleCloseFriend = async (userId: number, username: string) => {
    const isMember = closeFriends.some((f) => f.id === userId);
    try {
      if (isMember) {
        await api.removeCloseFriend(userId);
        setCloseFriends((prev) => prev.filter((f) => f.id !== userId));
      } else {
        await api.addCloseFriend(userId);
        setCloseFriends((prev) => [...prev, { id: userId, username }]);
      }
    } catch {
      /* ignore */
    }
  };

  const appendMedia = (form: FormData, assetUri: string, kind: 'image' | 'video') => {
    form.append(kind === 'video' ? 'video' : 'image', {
      uri: assetUri,
      name: kind === 'video' ? 'story.mp4' : 'story.jpg',
      type: kind === 'video' ? 'video/mp4' : 'image/jpeg',
    } as any);
  };

  const publish = useCallback(async () => {
    const textOverlay = overlays.find((o): o is StoryTextOverlay => o.type === 'text');
    const locationOverlay = overlays.find(
      (o): o is StoryLocationOverlay => o.type === 'location' && !!o.label.trim(),
    );
    if (mode === 'media' && !uri) {
      setError(t('stories.needMedia'));
      return;
    }
    if (mode === 'text' && overlays.length === 0 && drawing.length === 0) {
      setError(t('stories.needContent'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      if (textOverlay?.text.trim()) form.append('text', textOverlay.text.trim());
      if (mode === 'media' && uri) {
        appendMedia(form, uri, mediaType);
        form.append('filter_style', filterKey);
      } else {
        form.append('background_style', backgroundKey);
      }
      form.append('overlays', JSON.stringify(overlays));
      form.append('drawing', JSON.stringify(drawing));
      form.append('audience', audience);
      if (locationOverlay) {
        form.append('location_name', locationOverlay.label.trim());
        if (typeof locationOverlay.lat === 'number') form.append('location_lat', String(locationOverlay.lat));
        if (typeof locationOverlay.lng === 'number') form.append('location_lng', String(locationOverlay.lng));
      }
      if (mood) form.append('mood', mood);
      if (capsuleHours) {
        form.append('unlock_at', new Date(Date.now() + capsuleHours * 3600 * 1000).toISOString());
      }
      const story = await api.createStory(form);

      let extraFailures = 0;
      for (const extra of extraMedia) {
        try {
          const extraForm = new FormData();
          appendMedia(extraForm, extra.uri, extra.kind);
          extraForm.append('overlays', '[]');
          extraForm.append('drawing', '[]');
          extraForm.append('audience', audience);
          if (locationOverlay) {
            extraForm.append('location_name', locationOverlay.label.trim());
            if (typeof locationOverlay.lat === 'number') extraForm.append('location_lat', String(locationOverlay.lat));
            if (typeof locationOverlay.lng === 'number') extraForm.append('location_lng', String(locationOverlay.lng));
          }
          if (mood) extraForm.append('mood', mood);
          if (capsuleHours) {
            extraForm.append('unlock_at', new Date(Date.now() + capsuleHours * 3600 * 1000).toISOString());
          }
          await api.createStory(extraForm);
        } catch {
          extraFailures += 1;
        }
      }

      const goHome = () => navigation.navigate('MainTabs', { screen: 'Home' });
      const extraMsg =
        extraFailures === 1
          ? t('stories.extraFailOne')
          : extraFailures > 1
            ? t('stories.extraFailMany', { count: extraFailures })
            : '';
      const buttons = story?.id
        ? [
            {
              text: t('stories.spotlight'),
              onPress: () => {
                void (async () => {
                  try {
                    await api.submitSpotlight(story.id);
                    Alert.alert(t('stories.spotlight'), t('stories.spotlightOk'));
                  } catch {
                    Alert.alert(t('stories.spotlight'), t('stories.spotlightFail'));
                  } finally {
                    goHome();
                  }
                })();
              },
            },
            { text: t('stories.done'), onPress: goHome },
          ]
        : [{ text: t('stories.done'), onPress: goHome }];
      Alert.alert(t('stories.liveTitle'), extraMsg || t('stories.liveBody'), buttons);
    } catch {
      setError(t('stories.publishError'));
    } finally {
      setBusy(false);
    }
  }, [
    audience,
    backgroundKey,
    capsuleHours,
    drawing,
    extraMedia,
    filterKey,
    mediaType,
    mode,
    mood,
    navigation,
    overlays,
    t,
    uri,
  ]);

  const chip = (active: boolean) => [styles.chip, active && styles.chipOn];

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="close" size={26} color="#E9D5FF" />
          </Pressable>
          <Text style={styles.title}>{t('stories.newTitle')}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.tabs}>
          <Pressable onPress={() => setMode('text')} style={[styles.tab, mode === 'text' && styles.tabOn]}>
            <Text style={[styles.tabText, mode === 'text' && styles.tabTextOn]}>{t('stories.modeText')}</Text>
          </Pressable>
          <Pressable
            onPress={() => (uri ? setMode('media') : void pick(false))}
            style={[styles.tab, mode === 'media' && styles.tabOn]}
          >
            <Text style={[styles.tabText, mode === 'media' && styles.tabTextOn]}>{t('stories.modeMedia')}</Text>
          </Pressable>
        </View>

        <View style={styles.stage} {...(tool === 'draw' ? pan.panHandlers : {})}>
          {mode === 'media' && uri ? (
            <>
              <Image source={{ uri }} style={styles.media} resizeMode="cover" />
              {filterKey !== 'none' ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filterTint(filterKey) }]} />
              ) : null}
            </>
          ) : (
            <LinearGradient colors={backgroundColors(backgroundKey)} style={StyleSheet.absoluteFill} />
          )}
          <StoryOverlaysLayer
            overlays={overlays}
            drawing={drawing}
            selectedId={selectedId}
            onSelect={(id) => {
              if (tool === 'draw') return;
              setSelectedId(id);
            }}
            onMove={(id, x, y) => updateById(id, { x, y })}
            draggable={tool !== 'draw'}
            stageW={W}
            stageH={STAGE_H}
          />
          {tool !== 'draw' && overlays.length === 0 && mode === 'text' ? (
            <Text style={styles.hint}>{t('stories.hint')}</Text>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          {selected ? (
            <View style={styles.panel}>
              {selected.type === 'text' ? (
                <>
                  <TextInput
                    value={selected.text}
                    onChangeText={(text) => updateSelected({ text })}
                    placeholder={t('stories.yourText')}
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    autoFocus
                  />
                  <View style={styles.row}>
                    {(['left', 'center', 'right'] as const).map((a) => (
                      <Pressable key={a} onPress={() => updateSelected({ align: a })} style={chip((selected.align || 'center') === a)}>
                        <Text style={styles.chipText}>{a === 'left' ? '⟸' : a === 'right' ? '⟹' : '☰'}</Text>
                      </Pressable>
                    ))}
                    {STORY_TEXT_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => updateSelected({ color: c })}
                        style={[styles.swatch, { backgroundColor: c }, selected.color === c && styles.swatchOn]}
                      />
                    ))}
                    <Pressable onPress={() => { setOverlays((p) => p.filter((o) => o.id !== selectedId)); setSelectedId(null); }}>
                      <Ionicons name="trash" size={18} color="#F472B6" />
                    </Pressable>
                  </View>
                </>
              ) : selected.type === 'sticker' ? (
                <View style={styles.row}>
                  <Pressable style={styles.mini} onPress={() => updateSelected({ scale: Math.max(0.5, (selected.scale || 1) - 0.2) })}>
                    <Text style={styles.chipText}>−</Text>
                  </Pressable>
                  <Text style={styles.meta}>{t('stories.size')}</Text>
                  <Pressable style={styles.mini} onPress={() => updateSelected({ scale: Math.min(3, (selected.scale || 1) + 0.2) })}>
                    <Text style={styles.chipText}>+</Text>
                  </Pressable>
                  <Pressable onPress={() => { setOverlays((p) => p.filter((o) => o.id !== selectedId)); setSelectedId(null); }}>
                    <Ionicons name="trash" size={18} color="#F472B6" />
                  </Pressable>
                </View>
              ) : selected.type === 'poll' ? (
                <>
                  <TextInput value={selected.question} onChangeText={(question) => updateSelected({ question })} placeholder={t('stories.askQuestion')} placeholderTextColor="#94a3b8" style={styles.input} />
                  <View style={styles.row}>
                    <TextInput value={selected.options[0]} onChangeText={(v) => updateSelected({ options: [v, selected.options[1]] })} placeholder={t('stories.optionA')} placeholderTextColor="#94a3b8" style={[styles.input, { flex: 1 }]} maxLength={30} />
                    <TextInput value={selected.options[1]} onChangeText={(v) => updateSelected({ options: [selected.options[0], v] })} placeholder={t('stories.optionB')} placeholderTextColor="#94a3b8" style={[styles.input, { flex: 1 }]} maxLength={30} />
                  </View>
                  <Pressable onPress={() => { setOverlays((p) => p.filter((o) => o.id !== selectedId)); setSelectedId(null); }}>
                    <Ionicons name="trash" size={18} color="#F472B6" />
                  </Pressable>
                </>
              ) : selected.type === 'question' ? (
                <>
                  <TextInput value={selected.prompt} onChangeText={(prompt) => updateSelected({ prompt })} placeholder={t('stories.askAnything')} placeholderTextColor="#94a3b8" style={styles.input} maxLength={80} />
                  <Pressable onPress={() => { setOverlays((p) => p.filter((o) => o.id !== selectedId)); setSelectedId(null); }}>
                    <Ionicons name="trash" size={18} color="#F472B6" />
                  </Pressable>
                </>
              ) : selected.type === 'location' ? (
                <>
                  <TextInput value={selected.label} onChangeText={(label) => updateSelected({ label })} placeholder={t('stories.addLocation')} placeholderTextColor="#94a3b8" style={styles.input} maxLength={60} />
                  <Text style={styles.hintInline}>
                    {typeof selected.lat === 'number' && typeof selected.lng === 'number'
                      ? t('stories.locationPinned', { lat: selected.lat.toFixed(3), lng: selected.lng.toFixed(3) })
                      : t('stories.locationPick')}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {STORY_MAP_PRESETS.map((city) => (
                      <Pressable key={city.label} onPress={() => updateSelected({ label: city.label, lat: city.lat, lng: city.lng })} style={styles.chip}>
                        <Text style={styles.chipText}>{city.label}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable onPress={() => { setOverlays((p) => p.filter((o) => o.id !== selectedId)); setSelectedId(null); }}>
                    <Ionicons name="trash" size={18} color="#F472B6" />
                  </Pressable>
                </>
              ) : selected.type === 'mention' ? (
                <View style={styles.row}>
                  <Text style={styles.meta}>@{selected.username}</Text>
                  <Pressable onPress={() => { setOverlays((p) => p.filter((o) => o.id !== selectedId)); setSelectedId(null); }}>
                    <Ionicons name="trash" size={18} color="#F472B6" />
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput value={selected.label} onChangeText={(label) => updateSelected({ label })} placeholder={t('stories.countdownWhat')} placeholderTextColor="#94a3b8" style={styles.input} maxLength={40} />
                  <View style={styles.row}>
                    {COUNTDOWN_DURATIONS.map((c) => (
                      <Pressable
                        key={c.hours}
                        onPress={() => updateSelected({ targetAt: new Date(Date.now() + c.hours * 3600 * 1000).toISOString() })}
                        style={styles.chip}
                      >
                        <Text style={styles.chipText}>{c.label}</Text>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => { setOverlays((p) => p.filter((o) => o.id !== selectedId)); setSelectedId(null); }}>
                      <Ionicons name="trash" size={18} color="#F472B6" />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          ) : null}

          {tool === 'draw' ? (
            <View style={styles.panel}>
              <View style={styles.row}>
                {STORY_BRUSH_COLORS.map((c) => (
                  <Pressable key={c} onPress={() => setBrushColor(c)} style={[styles.swatch, { backgroundColor: c }, brushColor === c && styles.swatchOn]} />
                ))}
                <Pressable style={styles.mini} onPress={() => setBrushWidth((w) => Math.max(1, w - 1))}>
                  <Text style={styles.chipText}>−</Text>
                </Pressable>
                <Text style={styles.meta}>{t('stories.brush')}</Text>
                <Pressable style={styles.mini} onPress={() => setBrushWidth((w) => Math.min(10, w + 1))}>
                  <Text style={styles.chipText}>+</Text>
                </Pressable>
                {drawing.length > 0 ? (
                  <Pressable onPress={() => setDrawing((d) => d.slice(0, -1))}>
                    <Ionicons name="arrow-undo" size={18} color="#E9D5FF" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Pressable style={styles.tool} onPress={() => addOverlay(newTextOverlay())}>
              <Text style={styles.toolIcon}>Aa</Text>
              <Text style={styles.toolLabel}>{t('stories.toolText')}</Text>
            </Pressable>
            <Pressable style={[styles.tool, tool === 'stickers' && styles.toolOn]} onPress={() => setTool((cur) => (cur === 'stickers' ? 'none' : 'stickers'))}>
              <Ionicons name="happy-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolSticker')}</Text>
            </Pressable>
            <Pressable
              style={[styles.tool, tool === 'draw' && styles.toolOn]}
              onPress={() => {
                setSelectedId(null);
                setTool((cur) => (cur === 'draw' ? 'none' : 'draw'));
              }}
            >
              <Ionicons name="brush-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolDraw')}</Text>
            </Pressable>
            <Pressable style={styles.tool} onPress={() => void pick(false)}>
              <Ionicons name="image-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolMedia')}</Text>
            </Pressable>
            <Pressable style={styles.tool} onPress={() => addOverlay(newPollOverlay())}>
              <Ionicons name="bar-chart-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolPoll')}</Text>
            </Pressable>
            <Pressable style={styles.tool} onPress={() => addOverlay(newQuestionOverlay())}>
              <Ionicons name="help-circle-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolQuestion')}</Text>
            </Pressable>
            <Pressable style={styles.tool} onPress={() => void addLocation()}>
              <Ionicons name="location-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolLocation')}</Text>
            </Pressable>
            <Pressable
              style={[styles.tool, tool === 'mention-search' && styles.toolOn]}
              onPress={() => {
                setMentionQuery('');
                setMentionResults([]);
                setTool((cur) => (cur === 'mention-search' ? 'none' : 'mention-search'));
              }}
            >
              <Ionicons name="at-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolMention')}</Text>
            </Pressable>
            <Pressable style={styles.tool} onPress={() => addOverlay(newCountdownOverlay())}>
              <Ionicons name="time-outline" size={18} color="#E9D5FF" />
              <Text style={styles.toolLabel}>{t('stories.toolCountdown')}</Text>
            </Pressable>
          </ScrollView>

          {tool === 'mention-search' ? (
            <View style={styles.panel}>
              <TextInput
                value={mentionQuery}
                onChangeText={(q) => void searchMentions(q)}
                placeholder={t('stories.searchUsername')}
                placeholderTextColor="#94a3b8"
                style={styles.input}
                autoFocus
              />
              {mentionResults.map((u) => (
                <Pressable key={u.id} style={styles.result} onPress={() => addOverlay(newMentionOverlay(u.id, u.username))}>
                  <Text style={styles.resultName}>@{u.username}</Text>
                  {u.name ? <Text style={styles.resultSub}>{u.name}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          {tool === 'stickers' ? (
            <View style={styles.stickerGrid}>
              {STORY_STICKERS.map((e) => (
                <Pressable key={e} style={styles.stickerBtn} onPress={() => addOverlay(newStickerOverlay(e))}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {mode === 'media' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {STORY_FILTERS.map((f) => (
                  <Pressable key={f.key} onPress={() => setFilterKey(f.key)} style={chip(filterKey === f.key)}>
                    <Text style={styles.chipText}>{f.emoji} {f.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {extraMedia.length > 0 ? (
                <>
                  <ScrollView horizontal contentContainerStyle={styles.row}>
                    {extraMedia.map((m, i) => (
                      <View key={`${m.uri}-${i}`} style={styles.queueThumb}>
                        <Image source={{ uri: m.uri }} style={styles.queueImg} />
                        <Pressable style={styles.queueX} onPress={() => setExtraMedia((p) => p.filter((_, idx) => idx !== i))}>
                          <Ionicons name="close" size={12} color="#fff" />
                        </Pressable>
                      </View>
                    ))}
                    <Pressable style={styles.queueAdd} onPress={() => void pick(false, true)}>
                      <Text style={styles.chipText}>+</Text>
                    </Pressable>
                  </ScrollView>
                  <Text style={styles.hintInline}>{t('stories.extraQueue', { count: extraMedia.length })}</Text>
                </>
              ) : null}
            </>
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {STORY_BACKGROUNDS.map((b) => (
                  <Pressable key={b.key} onPress={() => setBackgroundKey(b.key)} style={[styles.bgSwatch, backgroundKey === b.key && styles.swatchOn]}>
                    <LinearGradient colors={b.colors} style={styles.bgFill} />
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                {STORY_TEMPLATES.map((tpl) => (
                  <Pressable key={tpl.key} onPress={() => applyTemplate(tpl)} style={styles.chip}>
                    <LinearGradient colors={backgroundColors(tpl.background)} style={styles.tplBg}>
                      <Text style={styles.chipText}>✦ {tpl.label}</Text>
                    </LinearGradient>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {STORY_MOODS.map((m) => (
              <Pressable key={m.emoji} onPress={() => setMood((cur) => (cur === m.emoji ? null : m.emoji))} style={chip(mood === m.emoji)}>
                <Text style={styles.chipText}>{m.emoji} {m.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            <Pressable onPress={() => setCapsuleHours(null)} style={chip(capsuleHours === null)}>
              <Text style={styles.chipText}>{t('stories.noSeal')}</Text>
            </Pressable>
            {CAPSULE_DURATIONS.map((c) => (
              <Pressable key={c.hours} onPress={() => setCapsuleHours(c.hours)} style={chip(capsuleHours === c.hours)}>
                <Text style={styles.chipText}>🔒 {c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {capsuleHours ? <Text style={styles.hintInline}>{t('stories.sealHint', { hours: capsuleHours })}</Text> : null}

          <View style={styles.row}>
            <Pressable onPress={() => setAudience('everyone')} style={chip(audience === 'everyone')}>
              <Text style={styles.chipText}>{t('stories.everyone')}</Text>
            </Pressable>
            <Pressable onPress={() => setAudience('close_friends')} style={[styles.chip, audience === 'close_friends' && styles.chipOrbit]}>
              <Text style={styles.chipText}>{t('stories.closeFriends')}</Text>
            </Pressable>
            <Pressable onPress={() => void openCloseFriends()} style={styles.chip}>
              <Text style={styles.chipText}>{t('stories.manage')}</Text>
            </Pressable>
          </View>
          {audience === 'close_friends' ? (
            <Text style={styles.hintInline}>{t('stories.closeFriendsHint', { count: closeFriends.length })}</Text>
          ) : null}

          {showCloseFriends ? (
            <View style={styles.panel}>
              <View style={styles.rowBetween}>
                <Text style={styles.panelTitle}>{t('stories.closeFriends')}</Text>
                <Pressable onPress={() => setShowCloseFriends(false)}>
                  <Ionicons name="close" size={18} color="#E9D5FF" />
                </Pressable>
              </View>
              <TextInput
                value={friendQuery}
                onChangeText={(q) => void searchMentions(q, true)}
                placeholder={t('stories.searchPeople')}
                placeholderTextColor="#94a3b8"
                style={styles.input}
              />
              {friendResults.map((u) => {
                const isMember = closeFriends.some((f) => f.id === u.id);
                return (
                  <Pressable key={u.id} style={styles.result} onPress={() => void toggleCloseFriend(u.id, u.username)}>
                    <Text style={styles.resultName}>@{u.username}</Text>
                    <Text style={styles.resultSub}>{isMember ? `✓ ${t('stories.added')}` : t('stories.add')}</Text>
                  </Pressable>
                );
              })}
              {closeFriends.map((f) => (
                <Pressable key={f.id} style={styles.result} onPress={() => void toggleCloseFriend(f.id, f.username)}>
                  <Text style={styles.resultName}>@{f.username}</Text>
                  <Text style={styles.resultSub}>✓ {t('stories.remove')}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={busy} onPress={() => void publish()} style={styles.publish}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.publishText}>{capsuleHours ? t('stories.sealPublish') : t('stories.publish')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0818' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: { color: '#F5F3FF', fontWeight: '800', fontSize: 16 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', padding: 3, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(124,58,237,0.45)' },
  tabText: { color: '#B0A6D9', fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: '#F5F3FF' },
  stage: { width: W, height: STAGE_H, backgroundColor: '#16102c', overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    color: 'rgba(245,243,255,0.55)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  hintInline: { color: 'rgba(245,243,255,0.55)', fontSize: 12, paddingHorizontal: 4, marginBottom: 6 },
  sheet: { paddingHorizontal: 12, paddingBottom: 28, gap: 10 },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
  },
  panelTitle: { color: '#F5F3FF', fontWeight: '800' },
  input: {
    backgroundColor: '#1B1836',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.18)',
  },
  chipOn: { backgroundColor: 'rgba(124,58,237,0.45)', borderColor: '#A78BFA' },
  chipOrbit: { backgroundColor: 'rgba(52,211,153,0.25)', borderColor: '#34D399', borderWidth: 1 },
  chipText: { color: '#E9D5FF', fontWeight: '700', fontSize: 12 },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: '#fff' },
  mini: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  meta: { color: 'rgba(245,243,255,0.7)', fontSize: 12, fontWeight: '700' },
  tool: {
    minWidth: 68,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  toolOn: { backgroundColor: 'rgba(124,58,237,0.4)' },
  toolIcon: { color: '#F5F3FF', fontWeight: '800', fontSize: 16 },
  toolLabel: { color: '#E9D5FF', fontSize: 11, fontWeight: '700' },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  result: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  resultName: { color: '#F5F3FF', fontWeight: '700' },
  resultSub: { color: '#A78BFA', fontSize: 12 },
  bgSwatch: { width: 36, height: 36, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  bgFill: { flex: 1 },
  tplBg: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  queueThumb: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden' },
  queueImg: { width: '100%', height: '100%' },
  queueX: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueAdd: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#F472B6', fontSize: 13, fontWeight: '600' },
  publish: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  publishText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
