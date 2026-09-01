import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { asCapsuleStats } from '@/lib/vault';
import {
  addDays,
  asCapsule,
  asCapsules,
  CAPSULE_DURATIONS,
  capsuleFieldError,
  toDateInputValue,
  useCapsulesPalette,
  type CapsuleDuration,
  type CapsuleVoice,
  type TimeCapsule,
} from '@/lib/capsules';
import { CapsuleCard, RevealModal, StatChip } from './capsuleParts';

export default function CapsulesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isDark } = useTheme();
  const C = useCapsulesPalette(isDark);
  const { t, locale } = useLocale();

  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof asCapsuleStats>>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [duration, setDuration] = useState<CapsuleDuration>('month');
  const [customDate, setCustomDate] = useState('');
  const [voice, setVoice] = useState<CapsuleVoice | null>(null);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [sealing, setSealing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<TimeCapsule | null>(null);

  const minCustomDate = useMemo(() => toDateInputValue(addDays(new Date(), 1)), []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const [page, capsuleStats] = await Promise.all([
        api.getCapsules(),
        api.getCapsuleStats().catch(() => null),
      ]);
      setCapsules(asCapsules(page));
      setStats(asCapsuleStats(capsuleStats));
    } catch {
      setFormError(t('common.actionFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const ideaId = route.params?.idea_id ?? route.params?.ideaId;
    if (ideaId) {
      setText((prev) => prev || t('capsules.ideaSparkPrefix', { id: String(ideaId) }));
    }
  }, [route.params?.idea_id, route.params?.ideaId, t]);

  useEffect(() => {
    return () => {
      void recordingRef.current?.stopAndUnloadAsync().catch(() => undefined);
    };
  }, []);

  const handlePolish = async () => {
    const draft = text.trim();
    if (draft.length < 4) return;
    setPolishing(true);
    setPolishNote('');
    setFormError('');
    try {
      const result = await api.polishTone(draft, 'capsule', locale);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      if (result.polished) setText(result.polished);
      if (result.note) setPolishNote(result.note);
    } catch {
      setFormError(t('common.actionFailed'));
    } finally {
      setPolishing(false);
    }
  };

  const stopRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    setRecording(false);
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (uri) {
        setVoice({ uri, name: 'capsule.m4a', type: 'audio/mp4' });
      }
    } catch {
      setFormError(t('capsules.error'));
    } finally {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => undefined);
    }
  };

  const handleVoice = async () => {
    if (recording) {
      await stopRecording();
      return;
    }
    setFormError('');
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        setFormError(t('capsules.micDenied'));
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const next = new Audio.Recording();
      await next.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await next.startAsync();
      recordingRef.current = next;
      setRecording(true);
      setVoice(null);
    } catch {
      setFormError(t('capsules.error'));
      setRecording(false);
    }
  };

  const handleSeal = async () => {
    setFormError('');
    setSuccess('');
    if (recording) await stopRecording();
    const draft = text.trim();
    if (draft.length < 4) {
      setFormError(t('capsules.tooShort'));
      return;
    }
    let openAt: Date;
    if (duration === 'custom') {
      if (!customDate.trim()) {
        setFormError(t('capsules.customRequired'));
        return;
      }
      openAt = new Date(`${customDate.trim()}T09:00:00`);
      if (Number.isNaN(openAt.getTime()) || openAt.getTime() <= Date.now()) {
        setFormError(t('capsules.customPast'));
        return;
      }
    } else {
      openAt = addDays(new Date(), CAPSULE_DURATIONS.find((d) => d.id === duration)!.days);
    }
    setSealing(true);
    try {
      const created = asCapsule(
        await api.createCapsule({
          text: draft,
          open_at: openAt.toISOString(),
          voice,
        }),
      );
      if (!created) {
        setFormError(t('capsules.error'));
        return;
      }
      setSuccess(t('capsules.sealed'));
      setText('');
      setVoice(null);
      setCustomDate('');
      setPolishNote('');
      setCapsules((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setStats((prev) => (prev ? { ...prev, sealed: prev.sealed + 1 } : prev));
    } catch (error) {
      setFormError(capsuleFieldError(error, t('capsules.error')));
    } finally {
      setSealing(false);
    }
  };

  const handleOpen = async (capsule: TimeCapsule) => {
    setOpeningId(capsule.id);
    setFormError('');
    try {
      const opened = asCapsule(await api.openCapsule(capsule.id));
      if (!opened) {
        setFormError(t('capsules.error'));
        return;
      }
      setRevealed(opened);
      setCapsules((prev) => prev.map((c) => (c.id === opened.id ? opened : c)));
      setStats((prev) =>
        prev ? { ...prev, ready: Math.max(0, prev.ready - 1), opened: prev.opened + 1 } : prev,
      );
    } catch (error) {
      setFormError(capsuleFieldError(error, t('capsules.error')));
    } finally {
      setOpeningId(null);
    }
  };

  const totalStats = (stats?.sealed || 0) + (stats?.ready || 0) + (stats?.opened || 0);

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('capsules.title')}
          subtitle={t('capsules.subtitle')}
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.accent} />
          }
        >
          {stats && totalStats > 0 ? (
            <View style={styles.stats}>
              <StatChip label={t('capsules.locked')} value={stats.sealed} C={C} />
              <StatChip label={t('capsules.ready')} value={stats.ready} C={C} highlight={stats.ready > 0} />
              <StatChip label={t('capsules.opened')} value={stats.opened} C={C} />
            </View>
          ) : null}

          <View style={[styles.form, { backgroundColor: C.card, borderColor: C.border }]}>
            <View style={styles.formHead}>
              <View style={[styles.spark, { backgroundColor: C.accent }]}>
                <Ionicons name="sparkles-outline" size={18} color="#fff" />
              </View>
              <Text style={[styles.formTitle, { color: C.text }]}>{t('capsules.createTitle')}</Text>
            </View>

            <Text style={[styles.label, { color: C.muted }]}>{t('capsules.bodyLabel')}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('capsules.bodyPlaceholder')}
              placeholderTextColor={C.muted}
              multiline
              maxLength={2000}
              style={[
                styles.input,
                { backgroundColor: C.inputBg, color: C.text, borderColor: C.border },
              ]}
            />

            <View style={styles.polishRow}>
              {polishNote ? (
                <Text style={[styles.polishNote, { color: C.muted }]}>✨ {polishNote}</Text>
              ) : (
                <View />
              )}
              <Pressable
                onPress={() => void handlePolish()}
                disabled={polishing || text.trim().length < 4}
                style={[
                  styles.polishBtn,
                  { backgroundColor: C.accent, opacity: polishing || text.trim().length < 4 ? 0.5 : 1 },
                ]}
              >
                <Text style={styles.polishText}>
                  {polishing ? t('capsules.polishing') : t('capsules.polishTone')}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.label, { color: C.muted }]}>{t('capsules.whenLabel')}</Text>
            <View style={styles.durationRow}>
              {CAPSULE_DURATIONS.map((d) => {
                const active = duration === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => setDuration(d.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? C.accent : C.chipBg,
                        borderColor: active ? C.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: active ? '#fff' : C.text }]}>
                      {t(`capsules.${d.id}`)}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setDuration('custom')}
                style={[
                  styles.chip,
                  {
                    backgroundColor: duration === 'custom' ? C.accent : C.chipBg,
                    borderColor: duration === 'custom' ? C.accent : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={duration === 'custom' ? '#fff' : C.text}
                />
                <Text style={[styles.chipText, { color: duration === 'custom' ? '#fff' : C.text }]}>
                  {t('capsules.custom')}
                </Text>
              </Pressable>
            </View>

            {duration === 'custom' ? (
              <TextInput
                value={customDate}
                onChangeText={setCustomDate}
                placeholder={`${t('capsules.customDatePlaceholder')} · ${minCustomDate}`}
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                style={[
                  styles.dateInput,
                  { backgroundColor: C.inputBg, color: C.text, borderColor: C.border },
                ]}
              />
            ) : null}

            <Text style={[styles.label, { color: C.muted }]}>{t('capsules.voiceLabel')}</Text>
            <View style={styles.voiceRow}>
              <Pressable
                onPress={() => void handleVoice()}
                style={[styles.voiceBtn, { backgroundColor: C.chipBg, borderColor: C.border }]}
              >
                <Ionicons
                  name={recording ? 'stop-circle-outline' : 'mic-outline'}
                  size={16}
                  color={recording ? C.danger : C.text}
                />
                <Text style={[styles.voiceText, { color: recording ? C.danger : C.text }]}>
                  {recording
                    ? t('capsules.recording')
                    : voice
                      ? t('capsules.voiceReady')
                      : t('capsules.recordVoice')}
                </Text>
              </Pressable>
              {voice && !recording ? (
                <Pressable onPress={() => setVoice(null)} hitSlop={8} accessibilityLabel={t('capsules.removeVoice')}>
                  <Ionicons name="close" size={18} color={C.muted} />
                </Pressable>
              ) : null}
            </View>

            {formError ? <Text style={[styles.msg, { color: C.danger }]}>{formError}</Text> : null}
            {success ? <Text style={[styles.msg, { color: C.accent }]}>{success}</Text> : null}

            <Pressable
              onPress={() => void handleSeal()}
              disabled={sealing || (duration === 'custom' && !customDate.trim())}
              style={[
                styles.seal,
                {
                  backgroundColor: C.accent,
                  opacity: sealing || (duration === 'custom' && !customDate.trim()) ? 0.5 : 1,
                },
              ]}
            >
              <Ionicons name="paper-plane-outline" size={16} color="#fff" />
              <Text style={styles.sealText}>{sealing ? t('capsules.sealing') : t('capsules.seal')}</Text>
            </Pressable>
          </View>

          <Text style={[styles.count, { color: C.text }]}>
            {loading ? t('common.loading') : t('capsules.count', { count: capsules.length })}
          </Text>

          {loading && capsules.length === 0 ? (
            <ActivityIndicator color={C.accent} style={{ marginTop: 16 }} />
          ) : capsules.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.border }]}>
              <Text style={[styles.emptyText, { color: C.muted }]}>{t('capsules.empty')}</Text>
            </View>
          ) : (
            capsules.map((capsule) => (
              <CapsuleCard
                key={capsule.id}
                capsule={capsule}
                C={C}
                opening={openingId === capsule.id}
                locale={locale}
                t={t}
                onOpen={() => void handleOpen(capsule)}
                onReveal={() => setRevealed(capsule)}
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <RevealModal
        capsule={revealed}
        C={C}
        locale={locale}
        t={t}
        onClose={() => setRevealed(null)}
      />
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  form: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 22 },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  spark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: { fontSize: 17, fontWeight: '800' },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    minHeight: 110,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  polishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  polishNote: { flex: 1, fontSize: 12 },
  polishBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  polishText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  dateInput: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 4,
  },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  voiceBtn: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceText: { fontSize: 13, fontWeight: '600' },
  msg: { fontSize: 13, marginTop: 8 },
  seal: {
    alignSelf: 'flex-end',
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sealText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  count: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  empty: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
