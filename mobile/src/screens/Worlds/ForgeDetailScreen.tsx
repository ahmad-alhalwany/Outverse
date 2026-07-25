import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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

  const load = useCallback(async () => {
    if (!storyId) return;
    setLoading(true);
    try {
      setStory(await api.getForgeStory(storyId));
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
      await api.addForgeSegment(storyId, { text: segmentText.trim() });
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

  const segments = Array.isArray(story?.segments) ? story.segments : [];

  return (
    <WorldBackdrop tone="bazaar">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader title="Forge" subtitle="Story detail" tone="bazaar" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
          ) : (
            <>
              <WorldHero
                tone="bazaar"
                eyebrow={story?.status || 'Story'}
                title={story?.title || 'Untitled story'}
                body={story?.description || 'Add segments, then publish when ready.'}
              />
              <WorldCard>
                <TextInput
                  value={segmentText}
                  onChangeText={setSegmentText}
                  placeholder="Add segment text"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                />
                <View style={styles.buttons}>
                  <View style={{ flex: 1 }}>
                    <WorldPrimaryButton label="Add Segment" onPress={addSegment} loading={busy} disabled={busy || !segmentText.trim()} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <WorldPrimaryButton label="Publish" onPress={publish} loading={busy} disabled={busy} />
                  </View>
                </View>
              </WorldCard>
              {segments.map((segment: any, index: number) => (
                <WorldCard key={String(segment.id ?? index)}>
                  <Text style={[styles.segmentTitle, { color: colors.text }]}>Segment {index + 1}</Text>
                  <Text style={[styles.segmentText, { color: colors.textSecondary }]}>
                    {segment.text || segment.content || segment.body || ''}
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
  input: { minHeight: 96, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, marginBottom: 12, textAlignVertical: 'top' },
  buttons: { flexDirection: 'row', gap: 10 },
  segmentTitle: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  segmentText: { fontSize: 14, lineHeight: 21 },
});
