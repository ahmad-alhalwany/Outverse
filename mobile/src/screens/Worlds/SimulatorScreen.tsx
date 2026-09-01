import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
} from '@/components/world/WorldChrome';
import {
  SIMULATOR_PIN_KEY,
  SIMULATOR_PRESETS,
  asPinnedUniverses,
  currentDimensions,
  flavorKeyFor,
  getFlavorKey,
  projectUniverse,
  useSimulatorPalette,
  type PinnedUniverse,
  type SimulatorBaseline,
} from '@/lib/simulator';

export default function SimulatorScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const C = useSimulatorPalette(isDark);
  const { t } = useLocale();
  const [baseline, setBaseline] = useState<SimulatorBaseline | null>(null);
  const [loading, setLoading] = useState(!!user);
  const [creativity, setCreativity] = useState(50);
  const [abstractness, setAbstractness] = useState(50);
  const [stability, setStability] = useState(50);
  const [seed, setSeed] = useState(1);
  const [pins, setPins] = useState<PinnedUniverse[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(SIMULATOR_PIN_KEY).then((raw) => setPins(asPinnedUniverses(raw)));
  }, []);

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
          above_average_pct: Number(data?.above_average_pct ?? 0),
        });
      })
      .catch(() =>
        setBaseline({ creativity_score: 50, completion_rate: 50, above_average_pct: 0 }),
      )
      .finally(() => setLoading(false));
  }, [user]);

  const persistPins = async (next: PinnedUniverse[]) => {
    setPins(next);
    try {
      await AsyncStorage.setItem(SIMULATOR_PIN_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  };

  const alternate = useMemo(
    () => projectUniverse(baseline, creativity, abstractness, stability, seed),
    [baseline, creativity, abstractness, stability, seed],
  );
  const currentDims = useMemo(() => currentDimensions(baseline), [baseline]);
  const flavorKey = useMemo(
    () => getFlavorKey(creativity, abstractness, stability),
    [creativity, abstractness, stability],
  );

  const applyPreset = (preset: (typeof SIMULATOR_PRESETS)[number]) => {
    void Haptics.selectionAsync();
    setCreativity(preset.creativity);
    setAbstractness(preset.abstractness);
    setStability(preset.stability);
    setSeed((s) => s + 1);
  };

  const pinCurrent = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pin: PinnedUniverse = {
      id: `${Date.now()}`,
      creativity,
      abstractness,
      stability,
      creativityScore: alternate.creativityScore,
      completionRate: alternate.completionRate,
      flavorKey,
    };
    void persistPins([pin, ...pins].slice(0, 6));
  };

  const shareSummary = async (pin?: PinnedUniverse) => {
    const score = pin ? pin.creativityScore : alternate.creativityScore;
    const completion = pin ? pin.completionRate : alternate.completionRate;
    const key = pin ? pin.flavorKey : flavorKey;
    const text = `${t('simulator.title')}\n${t('simulator.creativityScore')}: ${score} · ${t('simulator.completionRate')}: ${completion}\n${t(flavorKeyFor(key))}`;
    try {
      const result = await Share.share({ message: text });
      if (result.action !== Share.dismissedAction) {
        setCopiedId(pin?.id ?? 'current');
        setTimeout(() => setCopiedId(null), 1500);
      }
    } catch {
      /* share cancelled */
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('simulator.title')}
          subtitle={t('nav.simulator')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <WorldHero
            tone="default"
            eyebrow={t('nav.simulator')}
            title={t('simulator.title')}
            body={t('simulator.subtitle')}
          />

          {!user ? (
            <View style={[styles.card, { backgroundColor: C.card2 }]}>
              <Text style={[styles.centerText, { color: C.text2 }]}>{t('simulator.signInPrompt')}</Text>
            </View>
          ) : loading ? (
            <ActivityIndicator color={C.brown} style={{ marginTop: 24 }} />
          ) : (
            <>
              <Text style={[styles.kicker, { color: C.text2 }]}>{t('simulator.presets')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetRow}
              >
                {SIMULATOR_PRESETS.map((preset) => (
                  <Pressable
                    key={preset.key}
                    onPress={() => applyPreset(preset)}
                    style={[styles.preset, { backgroundColor: C.white, borderColor: C.line }]}
                  >
                    <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                    <Text style={[styles.presetLabel, { color: C.text }]}>
                      {t(`simulator.preset_${preset.key}`)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.statRow}>
                <View style={[styles.statCard, { backgroundColor: C.white, borderColor: C.line }]}>
                  <Text style={[styles.kicker, { color: C.text2 }]}>{t('simulator.currentReality')}</Text>
                  <Text style={[styles.statValue, { color: C.text }]}>
                    {baseline ? currentDims.creativityScore : '—'}
                  </Text>
                  <Text style={[styles.statHint, { color: C.text2 }]}>{t('simulator.creativityScore')}</Text>
                </View>
                <LinearGradient
                  colors={['#7C3AED', '#5B21B6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.altCard}
                >
                  <Text style={styles.altKicker}>{t('simulator.alternateReality')}</Text>
                  <Text style={styles.altValue}>{alternate.creativityScore}</Text>
                  <Text style={styles.altHint}>{t('simulator.creativityScore')}</Text>
                </LinearGradient>
              </View>

              <View style={[styles.flavor, { backgroundColor: C.card2 }]}>
                <Ionicons name="sparkles" size={18} color={C.brownDk} />
                <Text style={[styles.flavorText, { color: C.text }]}>{t(flavorKeyFor(flavorKey))}</Text>
              </View>

              <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
                <Text style={[styles.kicker, { color: C.text2, textAlign: 'center' }]}>
                  {t('simulator.dimensions')}
                </Text>
                <RadarChart
                  C={C}
                  axes={[
                    {
                      label: t('simulator.creativity'),
                      current: currentDims.creativityScore,
                      alternate: alternate.creativityScore,
                    },
                    {
                      label: t('simulator.completionRate'),
                      current: currentDims.completionRate,
                      alternate: alternate.completionRate,
                    },
                    {
                      label: t('simulator.activityPulse'),
                      current: currentDims.activityPulse,
                      alternate: alternate.activityPulse,
                    },
                  ]}
                />
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: C.text2 }]} />
                    <Text style={[styles.legendText, { color: C.text2 }]}>{t('simulator.currentReality')}</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: C.brownDk }]} />
                    <Text style={[styles.legendText, { color: C.text2 }]}>{t('simulator.alternateReality')}</Text>
                  </View>
                </View>
              </View>

              <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
                <DimSlider label={t('simulator.creativity')} value={creativity} onChange={setCreativity} C={C} />
                <DimSlider label={t('simulator.abstractness')} value={abstractness} onChange={setAbstractness} C={C} />
                <DimSlider label={t('simulator.stability')} value={stability} onChange={setStability} C={C} />
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSeed((s) => s + 1);
                  }}
                  style={styles.primaryBtn}
                >
                  <LinearGradient colors={['#7C3AED', '#5B21B6']} style={styles.primaryFill}>
                    <Ionicons name="refresh" size={16} color="#fff" />
                    <Text style={styles.primaryText}>{t('simulator.reroll')}</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={pinCurrent} style={[styles.ghostBtn, { backgroundColor: C.card2 }]}>
                  <Ionicons name="bookmark-outline" size={16} color={C.brownDk} />
                  <Text style={[styles.ghostText, { color: C.brownDk }]}>{t('simulator.pinThis')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void shareSummary()}
                  style={[styles.ghostBtn, { backgroundColor: C.card2 }]}
                >
                  <Ionicons name="share-outline" size={16} color={C.brownDk} />
                  <Text style={[styles.ghostText, { color: C.brownDk }]}>
                    {copiedId === 'current' ? t('simulator.copied') : t('simulator.copySummary')}
                  </Text>
                </Pressable>
              </View>

              {pins.length > 0 ? (
                <View>
                  <Text style={[styles.kicker, { color: C.text2 }]}>{t('simulator.pinnedTitle')}</Text>
                  {pins.map((pin) => (
                    <View key={pin.id} style={[styles.pinCard, { backgroundColor: C.card2 }]}>
                      <View style={styles.pinHead}>
                        <Text style={[styles.pinScore, { color: C.brownDk }]}>{pin.creativityScore}</Text>
                        <Ionicons name="bookmark" size={16} color={C.brownDk} />
                      </View>
                      <Text style={[styles.pinFlavor, { color: C.text2 }]}>
                        {t(flavorKeyFor(pin.flavorKey))}
                      </Text>
                      <View style={styles.pinActions}>
                        <Pressable onPress={() => void shareSummary(pin)} hitSlop={8}>
                          <Text style={[styles.pinLink, { color: C.brown }]}>
                            {copiedId === pin.id ? t('simulator.copied') : t('simulator.copySummary')}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => void persistPins(pins.filter((p) => p.id !== pin.id))} hitSlop={8}>
                          <Text style={styles.unpin}>{t('simulator.unpin')}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={[styles.flavor, { backgroundColor: C.card2 }]}>
                <Ionicons name="sparkles-outline" size={18} color={C.brownDk} />
                <Text style={[styles.flavorText, { color: C.text }]}>{t('simulator.disclaimer')}</Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

function DimSlider({
  label,
  value,
  onChange,
  C,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  C: ReturnType<typeof useSimulatorPalette>;
}) {
  const trackRef = useRef<View>(null);
  const trackX = useRef(0);
  const trackW = useRef(1);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setFromPageX = useCallback((pageX: number) => {
    const ratio = (pageX - trackX.current) / trackW.current;
    onChangeRef.current(Math.max(0, Math.min(100, Math.round(ratio * 100))));
  }, []);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setFromPageX(e.nativeEvent.pageX),
        onPanResponderMove: (e) => setFromPageX(e.nativeEvent.pageX),
      }),
    [setFromPageX],
  );

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={[styles.sliderLabel, { color: C.text }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: C.brown }]}>{value}</Text>
      </View>
      <View
        ref={trackRef}
        onLayout={() => {
          trackRef.current?.measureInWindow((x, _y, w) => {
            trackX.current = x;
            trackW.current = Math.max(1, w);
          });
        }}
        {...pan.panHandlers}
        style={[styles.track, { backgroundColor: C.card2 }]}
      >
        <View style={[styles.fill, { width: `${value}%`, backgroundColor: C.brownDk }]} />
        <View
          style={[
            styles.thumb,
            { left: `${value}%`, backgroundColor: C.white, borderColor: C.brownDk },
          ]}
        />
      </View>
    </View>
  );
}

function RadarChart({
  axes,
  C,
}: {
  axes: { label: string; current: number; alternate: number }[];
  C: ReturnType<typeof useSimulatorPalette>;
}) {
  const size = 240;
  const center = size / 2;
  const radius = size / 2 - 36;
  const angleFor = (i: number) => (Math.PI * 2 * i) / axes.length - Math.PI / 2;
  const pointFor = (i: number, value: number): [number, number] => {
    const angle = angleFor(i);
    const r = (value / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const polygon = (values: number[]) => values.map((v, i) => pointFor(i, v).join(',')).join(' ');

  return (
    <Svg width={size} height={size} style={styles.radar}>
      {[25, 50, 75, 100].map((r) => (
        <Polygon
          key={r}
          points={axes.map((_, i) => pointFor(i, r).join(',')).join(' ')}
          fill="none"
          stroke={C.line}
          strokeWidth={1}
        />
      ))}
      {axes.map((axis, i) => {
        const [x, y] = pointFor(i, 100);
        const [lx, ly] = pointFor(i, 124);
        return (
          <React.Fragment key={axis.label}>
            <Line x1={center} y1={center} x2={x} y2={y} stroke={C.line} strokeWidth={1} />
            <SvgText
              x={lx}
              y={ly}
              fontSize="10"
              textAnchor="middle"
              fill={C.text2}
              alignmentBaseline="middle"
            >
              {axis.label}
            </SvgText>
          </React.Fragment>
        );
      })}
      <Polygon
        points={polygon(axes.map((a) => a.current))}
        fill={C.text2}
        fillOpacity={0.16}
        stroke={C.text2}
        strokeWidth={1.5}
      />
      <Polygon
        points={polygon(axes.map((a) => a.alternate))}
        fill={C.brown}
        fillOpacity={0.3}
        stroke={C.brownDk}
        strokeWidth={2}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  centerText: { textAlign: 'center', fontSize: 14, lineHeight: 21 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  presetRow: { gap: 8, paddingBottom: 16 },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetEmoji: { fontSize: 14 },
  presetLabel: { fontSize: 12, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
  },
  statValue: { fontSize: 32, fontWeight: '800' },
  statHint: { fontSize: 12, marginTop: 4 },
  altCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
  },
  altKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 10,
  },
  altValue: { fontSize: 32, fontWeight: '800', color: '#fff' },
  altHint: { fontSize: 12, marginTop: 4, color: 'rgba(255,255,255,0.9)' },
  flavor: {
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  flavorText: { flex: 1, fontSize: 14, lineHeight: 21 },
  radar: { alignSelf: 'center', marginVertical: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  sliderBlock: { marginBottom: 16 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  sliderLabel: { fontSize: 14, fontWeight: '600' },
  sliderValue: { fontSize: 14, fontWeight: '700' },
  track: { height: 22, borderRadius: 999, justifyContent: 'center' },
  fill: { height: 22, borderRadius: 999 },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: -11,
    borderWidth: 2,
  },
  actions: { gap: 10, marginBottom: 18 },
  primaryBtn: { borderRadius: 16, overflow: 'hidden' },
  primaryFill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
  },
  ghostText: { fontSize: 14, fontWeight: '700' },
  pinCard: { borderRadius: 18, padding: 14, marginBottom: 10 },
  pinHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pinScore: { fontSize: 28, fontWeight: '800' },
  pinFlavor: { fontSize: 13, fontStyle: 'italic', lineHeight: 19, marginTop: 4, marginBottom: 10 },
  pinActions: { flexDirection: 'row', justifyContent: 'space-between' },
  pinLink: { fontSize: 12, fontWeight: '700' },
  unpin: { fontSize: 12, fontWeight: '700', color: '#c0392b' },
});
