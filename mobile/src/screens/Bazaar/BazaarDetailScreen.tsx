import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
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
  WorldStat,
} from '@/components/world/WorldChrome';

type Milestone = { id?: string; title?: string; done?: boolean; due_date?: string | null };
type Pledge = { user?: { username?: string }; amount?: number; created_at?: string };
type IdeaDetail = {
  id: number | string;
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  funding_goal?: number;
  funding_raised?: number;
  supporters?: number;
  milestones?: Milestone[];
  pledges?: Pledge[];
  owner?: { username?: string; first_name?: string; last_name?: string };
  target_date?: string | null;
};

export default function BazaarDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const ideaId = route.params?.ideaId as string | number;

  const [idea, setIdea] = useState<IdeaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('10');
  const [pledging, setPledging] = useState(false);

  const load = useCallback(async () => {
    if (!ideaId) return;
    try {
      const data = (await api.getIdea(ideaId)) as IdeaDetail;
      setIdea(data);
    } catch (error) {
      console.error('Failed to load idea:', error);
    } finally {
      setLoading(false);
    }
  }, [ideaId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePledge = async () => {
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive number of coins.');
      return;
    }
    setPledging(true);
    try {
      const result = await api.pledgeIdea(ideaId, parsed);
      Alert.alert('Pledged!', `You pledged ${parsed} coins.`);
      setIdea((prev) =>
        prev
          ? {
              ...prev,
              funding_raised: result.funding_raised ?? prev.funding_raised,
            }
          : prev,
      );
      load();
    } catch (error: any) {
      Alert.alert('Pledge failed', error?.response?.data?.detail || 'Try again.');
    } finally {
      setPledging(false);
    }
  };

  const ownerName =
    idea?.owner?.username ||
    [idea?.owner?.first_name, idea?.owner?.last_name].filter(Boolean).join(' ') ||
    'Unknown';

  const goal = idea?.funding_goal ?? 0;
  const raised = idea?.funding_raised ?? 0;
  const progress = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

  return (
    <WorldBackdrop tone="bazaar">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Bazaar"
          subtitle="Idea detail"
          tone="bazaar"
          onBack={() => navigation.goBack()}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !idea ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary }}>Idea not found</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <WorldHero
              tone="bazaar"
              eyebrow={idea.category || 'Idea'}
              title={idea.title || 'Untitled idea'}
              body={idea.description}
            />

            <View style={styles.metaRow}>
              {idea.status ? (
                <Text style={[styles.chip, { color: colors.textSecondary }]}>{idea.status}</Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                by @{ownerName} · {idea.supporters ?? 0} supporters
              </Text>
            </View>

            {(goal > 0 || raised > 0) && (
              <WorldCard>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Funding</Text>
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
                </View>
                <View style={styles.statsRow}>
                  <WorldStat label="Raised" value={raised} />
                  <WorldStat label="Goal" value={goal || '—'} />
                  <WorldStat label="Progress" value={`${progress}%`} />
                </View>
              </WorldCard>
            )}

            {idea.milestones && idea.milestones.length > 0 ? (
              <WorldCard>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Milestones</Text>
                {idea.milestones.map((m, i) => (
                  <View key={m.id || i} style={styles.milestoneRow}>
                    <Text style={{ color: m.done ? colors.success : colors.textSecondary }}>
                      {m.done ? '✓' : '○'}
                    </Text>
                    <View style={styles.milestoneInfo}>
                      <Text style={[styles.milestoneTitle, { color: colors.text }]}>{m.title}</Text>
                      {m.due_date ? (
                        <Text style={[styles.meta, { color: colors.textSecondary }]}>Due {m.due_date}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </WorldCard>
            ) : null}

            {idea.pledges && idea.pledges.length > 0 ? (
              <WorldCard>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Recent pledges</Text>
                {idea.pledges.map((p, i) => (
                  <Text key={i} style={[styles.meta, { color: colors.textSecondary }]}>
                    @{p.user?.username || 'user'} pledged {p.amount} coins
                  </Text>
                ))}
              </WorldCard>
            ) : null}

            <WorldCard>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Pledge coins</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                placeholder="Amount"
                placeholderTextColor={colors.textMuted}
              />
              <WorldPrimaryButton
                label="Pledge"
                onPress={handlePledge}
                loading={pledging}
                disabled={pledging}
              />
            </WorldCard>
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  content: { padding: 16, paddingBottom: 40 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 2 },
  chip: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 12 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 4 },
  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  milestoneInfo: { flex: 1 },
  milestoneTitle: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, marginBottom: 12 },
});
