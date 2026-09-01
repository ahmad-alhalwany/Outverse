import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import {
  capsuleVoiceUrl,
  formatCapsuleDate,
  formatRemaining,
  progressFraction,
  type CapsulesPalette,
  type TimeCapsule,
} from '@/lib/capsules';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function StatChip({
  label,
  value,
  C,
  highlight,
}: {
  label: string;
  value: number;
  C: CapsulesPalette;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: highlight ? C.accent : C.chipBg },
      ]}
    >
      <Text style={[styles.statText, { color: highlight ? '#fff' : C.muted }]}>
        {value} {label}
      </Text>
    </View>
  );
}

export function CapsuleCard({
  capsule,
  C,
  opening,
  locale,
  t,
  onOpen,
  onReveal,
}: {
  capsule: TimeCapsule;
  C: CapsulesPalette;
  opening: boolean;
  locale: string;
  t: TFn;
  onOpen: () => void;
  onReveal: () => void;
}) {
  const remaining = formatRemaining(capsule.open_at);
  const readyToOpen = capsule.is_unlocked && !capsule.is_opened;
  const status = !capsule.is_unlocked
    ? t('capsules.locked')
    : capsule.is_opened
      ? t('capsules.opened')
      : t('capsules.ready');
  const preview = capsule.is_unlocked
    ? capsule.text.slice(0, 120) || t('capsules.lockedHint')
    : t('capsules.lockedHint');

  return (
    <Pressable
      onPress={capsule.is_opened ? onReveal : undefined}
      style={[
        styles.card,
        {
          backgroundColor: C.card,
          borderColor: readyToOpen ? C.accent : C.border,
          shadowColor: readyToOpen ? C.accent : 'transparent',
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardIdentity}>
          <View
            style={[
              styles.lockWrap,
              { backgroundColor: readyToOpen ? C.accent : C.chipBg },
            ]}
          >
            <Ionicons
              name={capsule.is_unlocked ? 'lock-open-outline' : 'lock-closed-outline'}
              size={18}
              color={readyToOpen ? '#fff' : C.accent}
            />
          </View>
          <View>
            <Text style={[styles.status, { color: C.text }]}>{status}</Text>
            <Text style={[styles.meta, { color: C.muted }]}>
              {t('capsules.sealedOn')} {formatCapsuleDate(capsule.created_at, locale)}
            </Text>
          </View>
        </View>
        {remaining ? (
          <View style={[styles.remain, { backgroundColor: C.chipBg }]}>
            <Text style={[styles.remainText, { color: C.muted }]}>
              {t('capsules.opensIn')} {remaining}
            </Text>
          </View>
        ) : null}
      </View>

      {!capsule.is_unlocked ? (
        <View style={[styles.track, { backgroundColor: C.chipBg }]}>
          <View
            style={[
              styles.fill,
              {
                width: `${Math.round(progressFraction(capsule) * 100)}%`,
                backgroundColor: C.accent,
              },
            ]}
          />
        </View>
      ) : null}

      <Text style={[styles.body, { color: C.muted, fontStyle: capsule.is_unlocked ? 'normal' : 'italic' }]}>
        {preview}
        {capsule.is_unlocked && capsule.text.length > 120 ? '...' : ''}
      </Text>

      {readyToOpen ? (
        <Pressable
          onPress={onOpen}
          disabled={opening}
          style={[styles.openBtn, { backgroundColor: C.accent, opacity: opening ? 0.55 : 1 }]}
        >
          <Ionicons name="lock-open-outline" size={16} color="#fff" />
          <Text style={styles.openText}>{opening ? t('capsules.opening') : t('capsules.open')}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function RevealModal({
  capsule,
  C,
  locale,
  t,
  onClose,
}: {
  capsule: TimeCapsule | null;
  C: CapsulesPalette;
  locale: string;
  t: TFn;
  onClose: () => void;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [capsule?.id, capsule?.voice_url]);

  const toggleVoice = async () => {
    if (!capsule?.voice_url) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri: capsuleVoiceUrl(capsule.voice_url) });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) setPlaying(false);
        });
      }
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    }
  };

  const close = () => {
    void soundRef.current?.stopAsync().catch(() => undefined);
    setPlaying(false);
    onClose();
  };

  return (
    <Modal visible={Boolean(capsule)} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={close}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: C.card }]}
        >
          <Pressable onPress={close} style={styles.close} hitSlop={10}>
            <Ionicons name="close" size={20} color={C.muted} />
          </Pressable>
          <Text style={[styles.openedOn, { color: C.muted }]}>
            {t('capsules.openedOn')} {formatCapsuleDate(capsule?.opened_at || capsule?.open_at, locale)}
          </Text>
          <Text style={[styles.revealText, { color: C.text }]}>{capsule?.text}</Text>
          {capsule?.voice_url ? (
            <Pressable
              onPress={() => void toggleVoice()}
              style={[styles.voicePlay, { backgroundColor: C.chipBg, borderColor: C.border }]}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={18} color={C.accent} />
              <Text style={[styles.voicePlayText, { color: C.text }]}>
                {playing ? t('capsules.pauseVoice') : t('capsules.playVoice')}
              </Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stat: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statText: { fontSize: 12, fontWeight: '700' },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  lockWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 2 },
  remain: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  remainText: { fontSize: 11, fontWeight: '600' },
  track: { height: 6, borderRadius: 999, overflow: 'hidden', marginTop: 14 },
  fill: { height: '100%', borderRadius: 999 },
  body: { fontSize: 14, lineHeight: 21, marginTop: 14 },
  openBtn: {
    alignSelf: 'flex-end',
    marginTop: 16,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  overlay: { flex: 1, justifyContent: 'center', padding: 20 },
  sheet: { borderRadius: 28, padding: 24 },
  close: { position: 'absolute', top: 14, right: 14, padding: 6, zIndex: 2 },
  openedOn: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  revealText: { fontSize: 18, fontWeight: '600', lineHeight: 28, marginTop: 16 },
  voicePlay: {
    marginTop: 20,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voicePlayText: { fontSize: 14, fontWeight: '600' },
});
