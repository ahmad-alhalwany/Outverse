import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  STORY_BRUSH_COLORS,
  STORY_FILTERS,
  STORY_MOODS,
  STORY_STICKERS,
  uid,
  type StoryOverlay,
  type StoryStroke,
} from '@/lib/storyStudio';

const { width: W, height: H } = Dimensions.get('window');
const STAGE_H = Math.min(H * 0.62, 520);

type Tool = 'stickers' | 'text' | 'poll' | 'draw' | 'none';

export default function StoryStudioScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();

  const initialUri = route.params?.uri as string | undefined;
  const initialType = (route.params?.mediaType as 'image' | 'video') || 'image';

  const [uri, setUri] = useState(initialUri || '');
  const [mediaType, setMediaType] = useState<'image' | 'video'>(initialType);
  const [tool, setTool] = useState<Tool>('stickers');
  const [overlays, setOverlays] = useState<StoryOverlay[]>([]);
  const [strokes, setStrokes] = useState<StoryStroke[]>([]);
  const [brushColor, setBrushColor] = useState(STORY_BRUSH_COLORS[1]);
  const [filter, setFilter] = useState<string>('cosmic');
  const [mood, setMood] = useState<string>('✨');
  const [audience, setAudience] = useState<'everyone' | 'close_friends'>('everyone');
  const [textDraft, setTextDraft] = useState('');
  const [pollQ, setPollQ] = useState('This or that?');
  const [pollA, setPollA] = useState('Yes');
  const [pollB, setPollB] = useState('No');
  const [busy, setBusy] = useState(false);
  const currentStroke = useRef<StoryStroke | null>(null);

  const pick = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission', 'Camera / library access is required.');
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
        });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUri(asset.uri);
    setMediaType(asset.type === 'video' ? 'video' : 'image');
  };

  const addSticker = (emoji: string) => {
    setOverlays((prev) => [
      ...prev,
      { id: uid('st'), type: 'sticker', x: 40 + Math.random() * 20, y: 35 + Math.random() * 20, emoji, scale: 1 },
    ]);
  };

  const addText = () => {
    if (!textDraft.trim()) return;
    setOverlays((prev) => [
      ...prev,
      {
        id: uid('tx'),
        type: 'text',
        x: 50,
        y: 50,
        text: textDraft.trim().slice(0, 80),
        color: '#ffffff',
        fontSize: 28,
        fontWeight: 700,
        align: 'center',
      },
    ]);
    setTextDraft('');
  };

  const addPoll = () => {
    setOverlays((prev) => [
      ...prev,
      {
        id: uid('pl'),
        type: 'poll',
        x: 50,
        y: 70,
        question: pollQ.trim() || 'This or that?',
        options: [pollA.trim() || 'A', pollB.trim() || 'B'],
      },
    ]);
    setTool('none');
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => tool === 'draw',
        onMoveShouldSetPanResponder: () => tool === 'draw',
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          const stroke: StoryStroke = {
            id: uid('dr'),
            color: brushColor,
            width: 4,
            points: [{ x: (locationX / W) * 100, y: (locationY / STAGE_H) * 100 }],
          };
          currentStroke.current = stroke;
          setStrokes((s) => [...s, stroke]);
        },
        onPanResponderMove: (e) => {
          if (!currentStroke.current) return;
          const { locationX, locationY } = e.nativeEvent;
          const pt = { x: (locationX / W) * 100, y: (locationY / STAGE_H) * 100 };
          currentStroke.current.points.push(pt);
          const id = currentStroke.current.id;
          setStrokes((all) =>
            all.map((s) => (s.id === id ? { ...s, points: [...currentStroke.current!.points] } : s)),
          );
        },
        onPanResponderRelease: () => {
          currentStroke.current = null;
        },
      }),
    [tool, brushColor],
  );

  const pathFrom = (stroke: StoryStroke) => {
    if (!stroke.points.length) return '';
    return stroke.points
      .map((p, i) => {
        const x = (p.x / 100) * W;
        const y = (p.y / 100) * STAGE_H;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  };

  const publish = useCallback(async () => {
    if (!uri) {
      Alert.alert('Add media', 'Pick a photo/video or open the camera first.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      const name = mediaType === 'video' ? 'story.mp4' : 'story.jpg';
      const type = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
      form.append(mediaType === 'video' ? 'video' : 'image', { uri, name, type } as any);
      form.append('overlays', JSON.stringify(overlays));
      form.append('drawing', JSON.stringify(strokes));
      form.append('filter_style', filter);
      form.append('mood', mood);
      form.append('audience', audience);
      form.append('background_style', 'cosmic-violet');
      const story = await api.createStory(form);
      const buttons = story?.id
        ? [
            {
              text: 'Submit Spotlight',
              onPress: () => {
                void (async () => {
                  try {
                    await api.submitSpotlight(story.id);
                    Alert.alert('Spotlight', 'Story submitted to Spotlight.');
                  } catch {
                    Alert.alert('Spotlight', 'Could not submit this story.');
                  } finally {
                    navigation.navigate('MainTabs', { screen: 'Home' });
                  }
                })();
              },
            },
            { text: 'Done', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) },
          ]
        : [{ text: 'OK', onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) }];
      Alert.alert('Signal live', 'Your story is in orbit for 24h.', buttons);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not publish story.');
    } finally {
      setBusy(false);
    }
  }, [uri, mediaType, overlays, strokes, filter, mood, audience, navigation]);

  if (!uri) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: '#0c0818' }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.topBtn}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Story Studio</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Launch a story signal</Text>
          <Text style={styles.emptySub}>Camera or gallery — then stickers, draw & polls</Text>
          <Pressable style={styles.primaryBtn} onPress={() => void pick(true)}>
            <Text style={styles.primaryBtnText}>Open camera</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => void pick(false)}>
            <Text style={styles.secondaryBtnText}>Choose from library</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: '#0c0818' }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.topBtn}>Close</Text>
        </Pressable>
        <Text style={styles.title}>Story Studio</Text>
        <Pressable onPress={() => void publish()} disabled={busy}>
          {busy ? <ActivityIndicator color="#A78BFA" /> : <Text style={[styles.topBtn, { color: '#A78BFA' }]}>Share</Text>}
        </Pressable>
      </View>

      <View style={styles.stage} {...pan.panHandlers}>
        <Image source={{ uri }} style={styles.media} resizeMode="cover" />
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          {strokes.map((s) => (
            <Path key={s.id} d={pathFrom(s)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" />
          ))}
        </Svg>
        {overlays.map((o) => {
          if (o.type === 'sticker') {
            return (
              <Text
                key={o.id}
                style={[styles.overlayAbs, { left: `${o.x}%`, top: `${o.y}%`, fontSize: 36 * o.scale }]}
              >
                {o.emoji}
              </Text>
            );
          }
          if (o.type === 'text') {
            return (
              <Text
                key={o.id}
                style={[
                  styles.overlayAbs,
                  {
                    left: `${o.x}%`,
                    top: `${o.y}%`,
                    color: o.color,
                    fontSize: o.fontSize * 0.55,
                    fontWeight: '800',
                    textShadowColor: 'rgba(0,0,0,0.5)',
                    textShadowRadius: 6,
                  },
                ]}
              >
                {o.text}
              </Text>
            );
          }
          return (
            <View
              key={o.id}
              style={[styles.pollCard, { left: `${o.x - 30}%`, top: `${o.y}%` }]}
            >
              <Text style={styles.pollQ}>{o.question}</Text>
              <Text style={styles.pollOpt}>{o.options[0]}</Text>
              <Text style={styles.pollOpt}>{o.options[1]}</Text>
            </View>
          );
        })}
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>{filter}</Text>
          <Text style={styles.badge}>{mood}</Text>
          <Text style={styles.badge}>{audience === 'close_friends' ? 'Orbit' : 'Public'}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolRow}>
        {(['stickers', 'text', 'poll', 'draw'] as Tool[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTool(t)}
            style={[styles.toolChip, tool === t && styles.toolChipOn]}
          >
            <Text style={styles.toolChipText}>{t}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => void pick(true)} style={styles.toolChip}>
          <Text style={styles.toolChipText}>camera</Text>
        </Pressable>
        <Pressable onPress={() => setOverlays([])} style={styles.toolChip}>
          <Text style={styles.toolChipText}>clear</Text>
        </Pressable>
      </ScrollView>

      {tool === 'stickers' ? (
        <ScrollView horizontal contentContainerStyle={styles.stickerRow}>
          {STORY_STICKERS.map((e) => (
            <Pressable key={e} onPress={() => addSticker(e)} style={styles.stickerBtn}>
              <Text style={{ fontSize: 26 }}>{e}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {tool === 'text' ? (
        <View style={styles.inlineForm}>
          <TextInput
            value={textDraft}
            onChangeText={setTextDraft}
            placeholder="Add text…"
            placeholderTextColor="#94a3b8"
            style={[styles.input, { color: colors.text, backgroundColor: '#1B1836' }]}
          />
          <Pressable style={styles.miniBtn} onPress={addText}>
            <Text style={styles.miniBtnText}>Add</Text>
          </Pressable>
        </View>
      ) : null}

      {tool === 'poll' ? (
        <View style={styles.pollForm}>
          <TextInput value={pollQ} onChangeText={setPollQ} placeholder="Question" placeholderTextColor="#94a3b8" style={[styles.input, { color: '#fff', backgroundColor: '#1B1836' }]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={pollA} onChangeText={setPollA} placeholder="A" placeholderTextColor="#94a3b8" style={[styles.input, { flex: 1, color: '#fff', backgroundColor: '#1B1836' }]} />
            <TextInput value={pollB} onChangeText={setPollB} placeholder="B" placeholderTextColor="#94a3b8" style={[styles.input, { flex: 1, color: '#fff', backgroundColor: '#1B1836' }]} />
          </View>
          <Pressable style={styles.miniBtn} onPress={addPoll}>
            <Text style={styles.miniBtnText}>Place poll</Text>
          </Pressable>
        </View>
      ) : null}

      {tool === 'draw' ? (
        <ScrollView horizontal contentContainerStyle={styles.stickerRow}>
          {STORY_BRUSH_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setBrushColor(c)}
              style={[styles.swatch, { backgroundColor: c, borderColor: brushColor === c ? '#A78BFA' : 'transparent' }]}
            />
          ))}
          <Pressable onPress={() => setStrokes((s) => s.slice(0, -1))} style={styles.toolChip}>
            <Text style={styles.toolChipText}>undo</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <ScrollView horizontal contentContainerStyle={styles.metaRow}>
        {STORY_FILTERS.map((f) => (
          <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.metaChip, filter === f.key && styles.metaChipOn]}>
            <Text style={styles.metaChipText}>{f.label}</Text>
          </Pressable>
        ))}
        {STORY_MOODS.map((m) => (
          <Pressable key={m} onPress={() => setMood(m)} style={[styles.metaChip, mood === m && styles.metaChipOn]}>
            <Text style={{ fontSize: 16 }}>{m}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setAudience((a) => (a === 'everyone' ? 'close_friends' : 'everyone'))}
          style={[styles.metaChip, audience === 'close_friends' && styles.metaChipOrbit]}
        >
          <Text style={styles.metaChipText}>{audience === 'close_friends' ? 'Inner orbit' : 'Everyone'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topBtn: { color: '#E9D5FF', fontWeight: '700', fontSize: 15 },
  title: { color: '#F5F3FF', fontWeight: '800', fontSize: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { color: '#F5F3FF', fontSize: 22, fontWeight: '800' },
  emptySub: { color: '#A78BFA', textAlign: 'center', marginBottom: 8 },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#E9D5FF', fontWeight: '700' },
  stage: {
    width: W,
    height: STAGE_H,
    backgroundColor: '#16102c',
    overflow: 'hidden',
  },
  media: { width: '100%', height: '100%' },
  overlayAbs: {
    position: 'absolute',
    transform: [{ translateX: -20 }, { translateY: -12 }],
  },
  pollCard: {
    position: 'absolute',
    width: '60%',
    backgroundColor: 'rgba(20,16,42,0.85)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  pollQ: { color: '#fff', fontWeight: '700', marginBottom: 6, fontSize: 13 },
  pollOpt: {
    color: '#E9D5FF',
    backgroundColor: 'rgba(124,58,237,0.35)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeRow: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 },
  badge: {
    color: '#F5F3FF',
    backgroundColor: 'rgba(15,10,31,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  toolRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  toolChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    marginRight: 8,
  },
  toolChipOn: { backgroundColor: 'rgba(124,58,237,0.45)', borderColor: '#A78BFA' },
  toolChipText: { color: '#E9D5FF', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  stickerRow: { paddingHorizontal: 12, gap: 6, paddingBottom: 6 },
  stickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 6,
  },
  inlineForm: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, alignItems: 'center' },
  pollForm: { paddingHorizontal: 12, gap: 8 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  miniBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  miniBtnText: { color: '#fff', fontWeight: '800' },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 2,
  },
  metaRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 8,
  },
  metaChipOn: { backgroundColor: 'rgba(124,58,237,0.4)' },
  metaChipOrbit: { backgroundColor: 'rgba(52,211,153,0.25)', borderWidth: 1, borderColor: '#34D399' },
  metaChipText: { color: '#E9D5FF', fontSize: 12, fontWeight: '700' },
});
