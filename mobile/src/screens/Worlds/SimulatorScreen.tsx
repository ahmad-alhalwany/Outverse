import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
  WorldStat,
} from '@/components/world/WorldChrome';

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function SliderRow({
  label,
  value,
  onChange,
  colors,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  colors: { text: string; textSecondary: string; border: string; surface: string };
}) {
  const steps = [0, 25, 50, 75, 100];
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.sliderHeader}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: '#818CF8', fontWeight: '800' }}>{value}</Text>
      </View>
      <View style={styles.stepRow}>
        {steps.map((step) => {
          const selected = value === step;
          return (
            <Pressable
              key={step}
              accessibilityRole="adjustable"
              accessibilityLabel={`${label} ${step}`}
              hitSlop={8}
              onPress={() => onChange(step)}
              style={({ pressed }) => [
                styles.step,
                {
                  backgroundColor: selected ? '#6366F1' : colors.surface,
                  borderColor: selected ? '#6366F1' : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: selected ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                {step}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${value}%` }]} />
      </View>
    </View>
  );
}

export default function SimulatorScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [baseline, setBaseline] = useState<{ creativity_score: number; completion_rate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creativity, setCreativity] = useState(50);
  const [abstractness, setAbstractness] = useState(50);
  const [stability, setStability] = useState(50);
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getMeAnalytics()
      .then((data: any) => {
        setBaseline({
          creativity_score: Number(data?.creativity_score ?? 50),
          completion_rate: Number(data?.completion_rate ?? 50),
        });
      })
      .catch(() => setBaseline({ creativity_score: 50, completion_rate: 50 }))
      .finally(() => setLoading(false));
  }, [user]);

  const alternate = useMemo(() => {
    const base = baseline?.creativity_score ?? 50;
    const modifier = creativity - 50 + (abstractness - 50) * 0.6 - (stability - 50) * 0.3;
    const noise = Math.round(seededRandom(seed + creativity + abstractness + stability) * 20 - 10);
    return {
      creativity_score: Math.max(0, Math.min(100, Math.round(base + modifier * 0.5 + noise))),
      completion_rate: Math.max(
        0,
        Math.min(100, Math.round((baseline?.completion_rate ?? 50) - modifier * 0.3 + noise)),
      ),
    };
  }, [baseline, creativity, abstractness, stability, seed]);

  return (
    <WorldBackdrop tone="lab">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader title="Simulator" subtitle="Alternate self" tone="lab" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.content}>
          <WorldHero
            tone="lab"
            eyebrow="What-if model"
            title="Your current Cosmory model"
            body="Tune creativity, abstractness, and stability to preview an alternate analytics reality."
          />
          {!user ? (
            <WorldCard>
              <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
                Sign in to load your baseline analytics.
              </Text>
              <WorldPrimaryButton label="Go to profile" onPress={() => navigation.navigate('MainTabs', { screen: 'Profile' })} />
            </WorldCard>
          ) : loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <>
              <View style={styles.statRow}>
                <View style={{ flex: 1 }}>
                  <WorldStat label="Current creativity" value={String(baseline?.creativity_score ?? '—')} />
                </View>
                <View style={{ flex: 1 }}>
                  <WorldStat label="Alternate creativity" value={String(alternate.creativity_score)} />
                </View>
              </View>
              <View style={styles.statRow}>
                <View style={{ flex: 1 }}>
                  <WorldStat label="Current completion" value={String(baseline?.completion_rate ?? '—')} />
                </View>
                <View style={{ flex: 1 }}>
                  <WorldStat label="Alternate completion" value={String(alternate.completion_rate)} />
                </View>
              </View>
              <WorldCard>
                <SliderRow label="Creativity" value={creativity} onChange={setCreativity} colors={colors} />
                <SliderRow label="Abstractness" value={abstractness} onChange={setAbstractness} colors={colors} />
                <SliderRow label="Stability" value={stability} onChange={setStability} colors={colors} />
                <WorldPrimaryButton label="Re-roll alternate" onPress={() => setSeed((s) => s + 1)} />
              </WorldCard>
              <WorldCard>
                <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>Disclaimer</Text>
                <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                  This simulator is a playful projection from your analytics baseline — not a prediction engine.
                </Text>
              </WorldCard>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  step: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#6366F1', borderRadius: 999 },
});
