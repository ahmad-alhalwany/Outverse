import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
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
  WorldPill,
  WorldPrimaryButton,
  WorldStat,
} from '@/components/world/WorldChrome';

type DailyData = {
  ritual?: { period?: string; date?: string; completed?: boolean };
  question?: { id?: number; text?: string; category?: string; category_label?: string };
  streak?: number;
};

type ChallengeRow = {
  id: number | string;
  title?: string;
  description?: string;
  difficulty?: string;
  prompt?: string;
  category?: string;
};

type LabTab = 'daily' | 'challenges' | 'capsules' | 'bottles';

const TABS: Array<{ key: LabTab; label: string }> = [
  { key: 'daily', label: 'Daily' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'capsules', label: 'Capsules' },
  { key: 'bottles', label: 'Bottles' },
];

function listFromResponse<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}

export default function LabScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<LabTab>('daily');
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const [dailyRes, challengeRes, challengesRes] = await Promise.all([
        api.getDailyQuestion(),
        api.getDailyChallenge().catch(() => null),
        api.getChallenges({ page_size: 12 }).catch(() => null),
      ]);
      setDaily(dailyRes as DailyData);
      setChallenge(challengeRes as ChallengeRow | null);
      setChallenges(listFromResponse<ChallengeRow>(challengesRes));
    } catch (error) {
      console.error('Failed to load lab:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const updated = (await api.completeDailyRitual()) as DailyData;
      setDaily(updated);
      Alert.alert('Done', 'Ritual marked complete.');
    } catch (error: any) {
      Alert.alert('Could not complete', error?.response?.data?.detail || 'Try again.');
    } finally {
      setCompleting(false);
    }
  };

  const completed = daily?.ritual?.completed;
  const period = daily?.ritual?.period || 'morning';

  const renderDaily = () => (
    <>
      <WorldHero
        tone="lab"
        eyebrow={period === 'evening' ? 'Evening reflection' : 'Morning prompt'}
        title={daily?.question?.text || 'A quiet question is forming...'}
        body={
          completed
            ? 'You already answered today. Come back tomorrow for a new spark.'
            : 'Answer this gently, then carry it into a post, reel, or idea.'
        }
        action={
          <View style={styles.heroActions}>
            <WorldStat label="Streak" value={daily?.streak ?? 0} />
            <WorldStat label="Status" value={completed ? 'Done' : 'Open'} />
          </View>
        }
      />

      <WorldCard>
        <Text style={[styles.sectionLabel, { color: colors.primary }]}>Today's move</Text>
        <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
          Mark the ritual complete, or create something inspired by this prompt.
        </Text>
        <View style={styles.actions}>
          {!completed ? (
            <WorldPrimaryButton label="I answered this" onPress={handleComplete} loading={completing} />
          ) : null}
          <WorldPrimaryButton
            label="Create with this spark"
            onPress={() =>
              navigation.navigate('MainTabs', {
                screen: 'Create',
                params: { inspiration: daily?.question?.text || '' },
              })
            }
          />
        </View>
      </WorldCard>
    </>
  );

  const renderChallenges = () => (
    <>
      {challenge ? (
        <WorldHero
          tone="lab"
          eyebrow="Daily challenge"
          title={challenge.title || 'Creative challenge'}
          body={challenge.description || challenge.prompt || 'A small daily nudge for your next signal.'}
        />
      ) : null}
      {challenges.map((item) => (
        <WorldCard key={String(item.id)}>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>
            {item.title || 'Challenge'}
          </Text>
          {item.description || item.prompt ? (
            <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
              {item.description || item.prompt}
            </Text>
          ) : null}
          {item.difficulty || item.category ? (
            <Text style={[styles.challengeMeta, { color: colors.primary }]}>
              {[item.difficulty, item.category].filter(Boolean).join(' / ')}
            </Text>
          ) : null}
        </WorldCard>
      ))}
      {!challenge && challenges.length === 0 ? (
        <WorldCard>
          <Text style={[styles.sectionBody, { color: colors.textSecondary }]}>
            No challenges are available right now.
          </Text>
        </WorldCard>
      ) : null}
    </>
  );

  const renderShortcut = (kind: 'capsules' | 'bottles') => {
    const isCapsules = kind === 'capsules';
    return (
      <WorldHero
        tone="lab"
        eyebrow={isCapsules ? 'Capsules shortcut' : 'Bottles shortcut'}
        title={isCapsules ? 'Seal a note for later' : 'Catch or throw a bottle'}
        body={
          isCapsules
            ? 'Jump into time capsules without leaving the Lab flow.'
            : 'Open the cosmic bottle board for a quick drift.'
        }
        action={
          <WorldPrimaryButton
            label={isCapsules ? 'Open Capsules' : 'Open Bottles'}
            onPress={() => navigation.navigate(isCapsules ? 'Capsules' : 'Bottles')}
          />
        }
      />
    );
  };

  return (
    <WorldBackdrop tone="lab">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="The Lab"
          subtitle="Inspiration ritual"
          tone="lab"
          onBack={() => navigation.goBack()}
        />

        {loading && !daily ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
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
          >
            <View style={styles.tabs}>
              {TABS.map((tab) => (
                <WorldPill
                  key={tab.key}
                  label={tab.label}
                  active={activeTab === tab.key}
                  onPress={() => setActiveTab(tab.key)}
                />
              ))}
            </View>

            {activeTab === 'daily' ? renderDaily() : null}
            {activeTab === 'challenges' ? renderChallenges() : null}
            {activeTab === 'capsules' ? renderShortcut('capsules') : null}
            {activeTab === 'bottles' ? renderShortcut('bottles') : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroActions: { flexDirection: 'row', gap: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionBody: { fontSize: 14, lineHeight: 21, marginBottom: 14 },
  challengeTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  challengeMeta: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7 },
  actions: { gap: 10 },
});
