import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';

type IdeaRow = {
  id: number | string;
  title: string;
  description?: string;
  category?: string;
  status?: string;
  supporters?: number;
  owner?: { username?: string; first_name?: string; last_name?: string };
};

export default function BazaarScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [ideas, setIdeas] = useState<IdeaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [votingId, setVotingId] = useState<string | number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const page = await api.getIdeas({ ordering: '-created_at' });
      setIdeas(page.results as IdeaRow[]);
    } catch (error) {
      console.error('Failed to load ideas:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      await api.createIdea({ title, description: '' });
      setDraftTitle('');
      await load(true);
    } catch (error: any) {
      Alert.alert('Create idea', error?.response?.data?.detail || 'Could not create idea.');
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (item: IdeaRow) => {
    setVotingId(item.id);
    try {
      await api.voteIdea(item.id);
      setIdeas((prev) =>
        prev.map((row) =>
          String(row.id) === String(item.id)
            ? { ...row, supporters: (row.supporters ?? 0) + 1 }
            : row,
        ),
      );
    } catch (error: any) {
      Alert.alert('Vote', error?.response?.data?.detail || 'Voting is not available yet.');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <WorldBackdrop tone="bazaar">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Bazaar"
          subtitle="Ideas & collab"
          tone="bazaar"
          onBack={() => navigation.goBack()}
        />

        {loading && ideas.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={ideas}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load(true);
                }}
                colors={[colors.primary]}
              />
            }
            ListHeaderComponent={
              <>
                <WorldHero
                  tone="bazaar"
                  eyebrow="Launch pad"
                  title="Ideas worth backing"
                  body="Browse projects, pledge coins, and help creators ship."
                />
                <WorldCard>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Create idea</Text>
                  <TextInput
                    value={draftTitle}
                    onChangeText={setDraftTitle}
                    placeholder="Idea title"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  />
                  <WorldPrimaryButton
                    label="Create"
                    onPress={handleCreate}
                    loading={creating}
                    disabled={creating || !draftTitle.trim()}
                  />
                </WorldCard>
              </>
            }
            ListEmptyComponent={
              <WorldHero
                tone="bazaar"
                eyebrow="Empty bazaar"
                title="No ideas yet"
                body="Be the first to launch something here."
              />
            }
            renderItem={({ item }) => {
              const ownerName =
                item.owner?.username ||
                [item.owner?.first_name, item.owner?.last_name].filter(Boolean).join(' ') ||
                'Unknown';
              return (
                <WorldCard onPress={() => navigation.navigate('BazaarDetail', { ideaId: item.id })}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.description ? (
                    <Text style={[styles.cardBody, { color: colors.textSecondary }]} numberOfLines={3}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.metaRow}>
                    {item.category ? (
                      <Text style={[styles.chip, { color: colors.primary }]}>{item.category}</Text>
                    ) : null}
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      by @{ownerName} · {item.supporters ?? 0} supporters
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.voteButton, { borderColor: colors.border }]}
                    onPress={() => void handleVote(item)}
                    disabled={votingId === item.id}
                  >
                    <Text style={[styles.voteText, { color: colors.primary }]}>
                      {votingId === item.id ? 'Voting...' : 'Vote'}
                    </Text>
                  </TouchableOpacity>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardBody: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, marginBottom: 12 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 12 },
  voteButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  voteText: { fontSize: 13, fontWeight: '800' },
});
