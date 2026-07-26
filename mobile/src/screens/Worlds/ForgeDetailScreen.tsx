import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';

export default function ForgeDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors } = useTheme();
  const storyId = route.params?.storyId;
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [segmentText, setSegmentText] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    try {
      const data = await api.getForgeStory(storyId);
      setStory(data);
      setSaved(Boolean(data?.is_saved));
    } catch {
      Alert.alert('Forge', 'Could not load story.');
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addSegment = async () => {
    if (!segmentText.trim()) return;
    setBusy(true);
    try {
      await api.addForgeSegment(storyId, { content: segmentText.trim() });
      setSegmentText('');
      await load();
    } catch {
      Alert.alert('Forge', 'Could not add segment.');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    try {
      await api.publishForgeStory(storyId);
      await load();
    } catch {
      Alert.alert('Forge', 'Publish is not available yet.');
    } finally {
      setBusy(false);
    }
  };

  const toggleSave = async () => {
    try {
      const res = await api.toggleForgeSave(storyId);
      setSaved(Boolean(res?.saved));
    } catch {
      Alert.alert('Forge', 'Could not update save state.');
    }
  };

  const shareStory = async () => {
    try {
      await Share.share({
        message: `${story?.title || 'Forge story'}\n${story?.premise || ''}`.trim(),
      });
    } catch {
      /* ignore */
    }
  };

  const segments = Array.isArray(story?.segments) ? story.segments : [];
  const segmentCount = story?.segment_count ?? segments.length;
  const maxSegments = story?.max_segments;

  return (
    <WorldBackdrop tone="bazaar">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Forge"
          subtitle="Story detail"
          tone="bazaar"
          onBack={() => navigation.goBack()}
          right={
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={saved ? 'Unsave story' : 'Save story'}
                hitSlop={10}
                onPress={() => void toggleSave()}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>{saved ? '🔖' : '📑'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share story"
                hitSlop={10}
                onPress={() => void shareStory()}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 4 }]}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>↗</Text>
              </Pressable>
            </View>
          }
        />
        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
          ) : (
            <>
              <WorldHero
                tone="bazaar"
                eyebrow={[story?.status, story?.genre_display || story?.genre].filter(Boolean).join(' · ') || 'Story'}
                title={story?.title || 'Untitled story'}
                body={
                  story?.premise ||
                  `Add segments${maxSegments != null ? ` (${segmentCount}/${maxSegments})` : ''}, then publish when ready.`
                }
              />
              <WorldCard>
                <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>
                  {maxSegments != null ? `${segmentCount} / ${maxSegments} segments` : `${segmentCount} segments`}
                </Text>
                <TextInput
                  value={segmentText}
                  onChangeText={setSegmentText}
                  placeholder="Add segment content"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  accessibilityLabel="Segment content"
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                <View style={styles.buttons}>
                  <View style={{ flex: 1 }}>
                    <WorldPrimaryButton
                      label="Add Segment"
                      onPress={addSegment}
                      loading={busy}
                      disabled={busy || !segmentText.trim()}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <WorldPrimaryButton label="Publish" onPress={publish} loading={busy} disabled={busy} />
                  </View>
                </View>
              </WorldCard>
              {segments.map((segment: any, index: number) => (
                <WorldCard key={String(segment.id ?? index)}>
                  <Text style={[styles.segmentTitle, { color: colors.text }]}>
                    Segment {index + 1}
                    {segment.author?.username || segment.user?.username
                      ? ` · @${segment.author?.username || segment.user?.username}`
                      : ''}
                  </Text>
                  <Text style={[styles.segmentText, { color: colors.textSecondary }]}>
                    {segment.content || segment.text || segment.body || ''}
                  </Text>
                </WorldCard>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
  buttons: { flexDirection: 'row', gap: 10 },
  segmentTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  segmentText: { fontSize: 14, lineHeight: 21 },
});
