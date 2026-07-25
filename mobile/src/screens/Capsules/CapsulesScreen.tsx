import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
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
  WorldPill,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';

type CapsuleRow = {
  id: number | string;
  text?: string;
  open_at?: string;
  opened_at?: string | null;
  is_unlocked?: boolean;
  is_opened?: boolean;
};

const DURATIONS = [
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '1 year', days: 365 },
];

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CapsulesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [capsules, setCapsules] = useState<CapsuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | number | null>(null);
  const [polishing, setPolishing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const page = await api.getCapsules();
      setCapsules(page.results as CapsuleRow[]);
    } catch (error) {
      console.error('Failed to load capsules:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePolish = async () => {
    const text = draft.trim();
    if (text.length < 4) return;
    setPolishing(true);
    try {
      const result = await api.polishTone(text, 'capsule');
      if (result.polished) {
        setDraft(result.polished);
        if (result.note) Alert.alert('Tone polished', result.note);
      }
    } catch {
      Alert.alert('Polish failed', 'Could not reach the AI. Try again.');
    } finally {
      setPolishing(false);
    }
  };

  const handleCreate = async () => {
    const text = draft.trim();
    if (text.length < 4) {
      Alert.alert('Too short', 'Write a slightly longer message.');
      return;
    }
    setCreating(true);
    try {
      await api.createCapsule({ text, open_at: addDays(durationDays) });
      setDraft('');
      Alert.alert('Sealed', 'Your capsule is locked until the open date.');
      load(true);
    } catch (error: any) {
      Alert.alert('Could not create', error?.response?.data?.detail || 'Try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = async (id: string | number) => {
    setOpeningId(id);
    try {
      const opened = (await api.openCapsule(id)) as CapsuleRow;
      setCapsules((prev) => prev.map((c) => (c.id === id ? { ...c, ...opened } : c)));
      Alert.alert('Opened!', opened.text || 'Your message from the past.');
    } catch (error: any) {
      Alert.alert('Still sealed', error?.response?.data?.detail || 'Not ready yet.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Capsules"
          subtitle="Time vault"
          tone="vault"
          onBack={() => navigation.goBack()}
        />

        <WorldCard style={styles.createBox}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>New time capsule</Text>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            placeholder="Message to your future self…"
            placeholderTextColor={colors.textSecondary}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
          />
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => (
              <WorldPill
                key={d.days}
                label={d.label}
                active={durationDays === d.days}
                onPress={() => setDurationDays(d.days)}
              />
            ))}
          </View>
          <WorldPrimaryButton
            label={polishing ? '✨ Polishing…' : '✨ Polish tone'}
            onPress={handlePolish}
            loading={polishing}
            disabled={polishing || draft.trim().length < 4}
          />
          <WorldPrimaryButton
            label="Seal capsule"
            onPress={handleCreate}
            loading={creating}
            disabled={creating || draft.trim().length < 4}
          />
        </WorldCard>

        {loading && capsules.length === 0 ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
        ) : (
          <FlatList
            data={capsules}
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
              capsules.length > 0 ? (
                <WorldHero
                  tone="vault"
                  eyebrow="Your archive"
                  title={`${capsules.length} capsule${capsules.length === 1 ? '' : 's'}`}
                  body="Messages sealed until their moment arrives."
                />
              ) : null
            }
            ListEmptyComponent={
              <WorldHero
                tone="vault"
                eyebrow="Empty vault"
                title="No capsules yet"
                body="Seal your first message to your future self."
              />
            }
            renderItem={({ item }) => {
              const ready = item.is_unlocked && !item.is_opened;
              const opened = item.is_opened;
              return (
                <WorldCard>
                  <View style={styles.cardTop}>
                    <Text style={[styles.status, { color: opened ? colors.success : ready ? colors.warning : colors.primary }]}>
                      {opened ? 'Opened' : ready ? 'Ready to open' : 'Sealed'}
                    </Text>
                    <Text style={[styles.date, { color: colors.textSecondary }]}>
                      Opens {formatDate(item.open_at)}
                    </Text>
                  </View>
                  {opened && item.text ? (
                    <Text style={[styles.body, { color: colors.text }]}>{item.text}</Text>
                  ) : ready ? (
                    <WorldPrimaryButton
                      label="Open capsule"
                      onPress={() => handleOpen(item.id)}
                      loading={openingId === item.id}
                    />
                  ) : (
                    <Text style={[styles.sealedHint, { color: colors.textSecondary }]}>
                      Content hidden until unlock date
                    </Text>
                  )}
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
  createBox: { marginHorizontal: 16, marginBottom: 4 },
  sectionLabel: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  input: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    marginBottom: 10,
  },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  status: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  date: { fontSize: 12 },
  body: { fontSize: 14, lineHeight: 22 },
  sealedHint: { fontSize: 13, fontStyle: 'italic' },
});
