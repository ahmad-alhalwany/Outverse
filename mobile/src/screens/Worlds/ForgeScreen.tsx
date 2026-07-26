import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import { rowsFrom } from './WorldScreenKit';

const ORDER_TABS = [
  { key: 'trending', label: 'Trending' },
  { key: 'new', label: 'New' },
  { key: 'completed', label: 'Completed' },
] as const;

const GENRES = [
  'all',
  'fantasy',
  'scifi',
  'mystery',
  'romance',
  'horror',
  'adventure',
  'absurd',
  'other',
] as const;

export default function ForgeScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [ordering, setOrdering] = useState<(typeof ORDER_TABS)[number]['key']>('trending');
  const [genre, setGenre] = useState<(typeof GENRES)[number]>('all');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [premise, setPremise] = useState('');
  const [createGenre, setCreateGenre] = useState('fantasy');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getForgeStories({
        ordering: ordering === 'new' ? 'new' : 'trending',
        genre,
        status: ordering === 'completed' ? 'completed' : 'all',
      });
      setRows(rowsFrom(data));
    } catch {
      Alert.alert('Forge', 'Could not load stories.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ordering, genre]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const created = await api.createForgeStory({
        title: title.trim(),
        premise: premise.trim(),
        genre: createGenre,
      });
      setTitle('');
      setPremise('');
      if (created?.id) {
        navigation.navigate('ForgeDetail', { storyId: created.id });
      } else {
        await load(true);
      }
    } catch {
      Alert.alert('Forge', 'Could not create story.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <WorldBackdrop tone="bazaar">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader title="Forge" subtitle="Stories" tone="bazaar" onBack={() => navigation.goBack()} />
        {loading && rows.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item, index) => String(item.id ?? index)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#818CF8" />
            }
            ListHeaderComponent={
              <>
                <WorldHero
                  tone="bazaar"
                  eyebrow="Stories"
                  title="Forge long-form stories"
                  body="Filter by genre, start a shell with a premise, then open to contribute segments."
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {ORDER_TABS.map((tab) => {
                    const selected = ordering === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Order ${tab.label}`}
                        accessibilityState={{ selected }}
                        hitSlop={8}
                        onPress={() => setOrdering(tab.key)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: selected ? '#6366F1' : colors.surface,
                            borderColor: selected ? '#6366F1' : colors.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {GENRES.map((g) => {
                    const selected = genre === g;
                    return (
                      <Pressable
                        key={g}
                        accessibilityRole="button"
                        accessibilityLabel={`Genre ${g}`}
                        accessibilityState={{ selected }}
                        hitSlop={8}
                        onPress={() => setGenre(g)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: selected ? 'rgba(167,139,250,0.35)' : colors.surface,
                            borderColor: selected ? '#A78BFA' : colors.border,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
                          {g === 'all' ? 'All genres' : g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <WorldCard>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Story title"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    accessibilityLabel="Story title"
                  />
                  <TextInput
                    value={premise}
                    onChangeText={setPremise}
                    placeholder="Premise (optional)"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    style={[styles.input, styles.premise, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    accessibilityLabel="Story premise"
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {GENRES.filter((g) => g !== 'all').map((g) => {
                      const selected = createGenre === g;
                      return (
                        <Pressable
                          key={g}
                          accessibilityRole="button"
                          accessibilityLabel={`Create genre ${g}`}
                          hitSlop={8}
                          onPress={() => setCreateGenre(g)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? '#6366F1' : colors.surface,
                              borderColor: selected ? '#6366F1' : colors.border,
                            },
                          ]}
                        >
                          <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>{g}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <WorldPrimaryButton
                    label="Create story"
                    onPress={create}
                    loading={creating}
                    disabled={creating || !title.trim()}
                  />
                </WorldCard>
              </>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: colors.textSecondary }}>No forged stories yet</Text>
              </View>
            }
            renderItem={({ item }) => {
              const segments = item.segment_count ?? item.segments_count ?? 0;
              const max = item.max_segments ?? item.max_parts;
              return (
                <WorldCard onPress={() => navigation.navigate('ForgeDetail', { storyId: item.id })}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title || 'Untitled'}</Text>
                  {item.premise ? (
                    <Text style={{ color: colors.textSecondary, marginTop: 4 }} numberOfLines={3}>
                      {item.premise}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {[item.genre_display || item.genre, item.status, max != null ? `${segments}/${max} parts` : `${segments} parts`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </WorldCard>
              );
            }}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  chips: { gap: 8, paddingBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  premise: { minHeight: 72, textAlignVertical: 'top' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 8 },
  center: { padding: 32, alignItems: 'center' },
});
