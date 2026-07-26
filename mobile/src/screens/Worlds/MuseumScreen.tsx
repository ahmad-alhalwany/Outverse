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

const EXHIBITIONS = [
  { key: 'all', label: 'All' },
  { key: 'burned_ideas', label: 'Burned' },
  { key: 'collapsed_challenges', label: 'Collapsed' },
  { key: 'beautiful_disasters', label: 'Disasters' },
] as const;

export default function MuseumScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [exhibition, setExhibition] = useState<(typeof EXHIBITIONS)[number]['key']>('all');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [lesson, setLesson] = useState('');
  const [createExhibition, setCreateExhibition] = useState('burned_ideas');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getFailedIdeas({ exhibition });
      setRows(rowsFrom(data));
    } catch {
      Alert.alert('Museum', 'Could not load failed ideas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [exhibition]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await api.createFailedIdea({
        title: title.trim(),
        description: description.trim(),
        lesson_learned: lesson.trim(),
        exhibition: createExhibition,
      });
      setTitle('');
      setDescription('');
      setLesson('');
      await load(true);
    } catch {
      Alert.alert('Museum', 'Could not archive idea.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <WorldBackdrop tone="bazaar">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader title="Museum" subtitle="Failed ideas" tone="bazaar" onBack={() => navigation.goBack()} />
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
                  eyebrow="Museum"
                  title="Archive ideas worth learning from"
                  body="Browse exhibitions and submit failed ideas with the lesson you took away."
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {EXHIBITIONS.map((tab) => {
                    const selected = exhibition === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        accessibilityRole="button"
                        accessibilityLabel={`Exhibition ${tab.label}`}
                        accessibilityState={{ selected }}
                        hitSlop={8}
                        onPress={() => setExhibition(tab.key)}
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
                <WorldCard>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="What failed?"
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel="Failed idea title"
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="What happened?"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    accessibilityLabel="Failed idea description"
                    style={[styles.input, styles.multi, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  <TextInput
                    value={lesson}
                    onChangeText={setLesson}
                    placeholder="Lesson learned"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    accessibilityLabel="Lesson learned"
                    style={[styles.input, styles.multi, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {EXHIBITIONS.filter((e) => e.key !== 'all').map((tab) => {
                      const selected = createExhibition === tab.key;
                      return (
                        <Pressable
                          key={tab.key}
                          accessibilityRole="button"
                          accessibilityLabel={`Submit to ${tab.label}`}
                          hitSlop={8}
                          onPress={() => setCreateExhibition(tab.key)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? 'rgba(167,139,250,0.35)' : colors.surface,
                              borderColor: selected ? '#A78BFA' : colors.border,
                            },
                          ]}
                        >
                          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{tab.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <WorldPrimaryButton
                    label="Archive idea"
                    onPress={create}
                    loading={creating}
                    disabled={creating || !title.trim()}
                  />
                </WorldCard>
              </>
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: colors.textSecondary }}>No failed ideas archived yet</Text>
              </View>
            }
            renderItem={({ item }) => (
              <WorldCard>
                <Text style={[styles.badge, { color: '#A78BFA' }]}>
                  {item.exhibition_display || item.exhibition || 'Exhibition'}
                </Text>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title || 'Untitled'}</Text>
                {item.description ? (
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }} numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : null}
                {item.lesson_learned ? (
                  <Text style={{ color: colors.text, marginTop: 8, fontWeight: '600' }} numberOfLines={3}>
                    Lesson: {item.lesson_learned}
                  </Text>
                ) : null}
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {item.user?.username ? `@${item.user.username}` : 'Anonymous archive'}
                </Text>
              </WorldCard>
            )}
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
  multi: { minHeight: 64, textAlignVertical: 'top' },
  badge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 8 },
  center: { padding: 32, alignItems: 'center' },
});
