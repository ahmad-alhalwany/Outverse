import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { emotionMeta, happyDaysPercent } from '@/lib/profileEmotions';
import { formatBottleTimeLeft } from '@/lib/bottleTime';
import {
  BOTTLE_EMOTIONS,
  relativeBottleTime,
  type BottleDashboard,
  type BottleLocation,
  type BottleRow,
  type BottlesPalette,
} from '@/lib/bottles';
import type { GeocodeHit } from '@/lib/geocode';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function BottleModalShell({
  visible,
  C,
  onClose,
  children,
}: {
  visible: boolean;
  C: BottlesPalette;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}
        >
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: C.card }]} hitSlop={8}>
            <Ionicons name="close" size={18} color={C.text} />
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function EmotionChip({
  emotionKey,
  active,
  t,
  onPress,
}: {
  emotionKey: string;
  active: boolean;
  t: TFn;
  onPress: () => void;
}) {
  const em = emotionMeta(emotionKey);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? em.color : 'transparent',
          borderColor: active ? em.color : `${em.color}55`,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#fff' : em.color }]}>
        {em.emoji} {t(em.labelKey)}
      </Text>
    </Pressable>
  );
}

export function ThrowBottleForm({
  C,
  t,
  message,
  setMessage,
  emotion,
  setEmotion,
  location,
  locating,
  searchingPlace,
  placeQuery,
  setPlaceQuery,
  suggestions,
  polishNote,
  error,
  throwing,
  polishing,
  done,
  onGps,
  onPickMap,
  onSearch,
  onPickSuggestion,
  onClearLocation,
  onPolish,
  onThrow,
}: {
  C: BottlesPalette;
  t: TFn;
  message: string;
  setMessage: (v: string) => void;
  emotion: string;
  setEmotion: (v: string) => void;
  location: BottleLocation | null;
  locating: boolean;
  searchingPlace: boolean;
  placeQuery: string;
  setPlaceQuery: (v: string) => void;
  suggestions: GeocodeHit[];
  polishNote: string;
  error: string;
  throwing: boolean;
  polishing: boolean;
  done: boolean;
  onGps: () => void;
  onPickMap: () => void;
  onSearch: () => void;
  onPickSuggestion: (hit: GeocodeHit) => void;
  onClearLocation: () => void;
  onPolish: () => void;
  onThrow: () => void;
}) {
  if (done) {
    return (
      <View style={styles.centerBlock}>
        <Text style={{ fontSize: 56 }}>🍶</Text>
        <Text style={[styles.hint, { color: C.text2 }]}>{t('bottles.bottleDrifting')}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.modalTitle, { color: C.text }]}>{t('bottles.throwTitle')}</Text>
      <View style={styles.chipWrap}>
        {BOTTLE_EMOTIONS.map((em) => (
          <EmotionChip
            key={em.key}
            emotionKey={em.key}
            active={emotion === em.key}
            t={t}
            onPress={() => setEmotion(em.key)}
          />
        ))}
      </View>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder={t('bottles.messagePlaceholder')}
        placeholderTextColor={C.text2}
        multiline
        maxLength={500}
        style={[styles.textarea, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
      />
      <View style={[styles.locBox, { backgroundColor: C.card2, borderColor: C.line }]}>
        <Text style={[styles.locTitle, { color: C.text }]}>{t('bottles.whereAppear')}</Text>
        <View style={styles.row}>
          <Pressable onPress={onGps} style={[styles.ghostBtn, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={[styles.ghostText, { color: C.brown }]}>
              {locating ? t('bottles.locating') : t('bottles.useMyGps')}
            </Text>
          </Pressable>
          <Pressable onPress={onPickMap} style={[styles.solidBtn, { backgroundColor: C.brownDk }]}>
            <Text style={styles.solidText}>{t('bottles.pickOnMap')}</Text>
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={placeQuery}
            onChangeText={setPlaceQuery}
            placeholder={t('bottles.searchPlacePlaceholder')}
            placeholderTextColor={C.text2}
            style={[styles.search, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
            onSubmitEditing={onSearch}
          />
          <Pressable onPress={onSearch} style={[styles.findBtn, { backgroundColor: C.brown }]}>
            <Text style={styles.solidText}>{searchingPlace ? '…' : t('bottles.find')}</Text>
          </Pressable>
        </View>
        {suggestions.map((hit) => (
          <Pressable key={`${hit.lat}-${hit.lng}`} onPress={() => onPickSuggestion(hit)} style={styles.suggest}>
            <Text style={[styles.suggestText, { color: C.text }]}>{hit.label}</Text>
          </Pressable>
        ))}
        {location ? (
          <Pressable onPress={onClearLocation}>
            <Text style={[styles.selected, { color: C.brown }]}>
              {t('bottles.selectedLocation', { label: location.label })} · {t('bottles.clear')}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.hint, { color: C.text2 }]}>{t('bottles.locationRequired')}</Text>
        )}
      </View>
      <View style={styles.polishRow}>
        <Text style={[styles.hint, { color: C.text2 }]}>{message.length}/500</Text>
        <Pressable
          onPress={onPolish}
          disabled={polishing || !message.trim()}
          style={[styles.solidBtn, { backgroundColor: C.brownDk, opacity: polishing || !message.trim() ? 0.5 : 1 }]}
        >
          <Text style={styles.solidText}>{polishing ? t('bottles.polishing') : t('bottles.polishTone')}</Text>
        </Pressable>
      </View>
      {polishNote ? <Text style={[styles.hint, { color: C.text2 }]}>✨ {polishNote}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={onThrow}
        disabled={throwing}
        style={[styles.cta, { backgroundColor: C.brownDk, opacity: throwing ? 0.65 : 1 }]}
      >
        <Text style={styles.ctaText}>{throwing ? t('bottles.driftingAway') : t('bottles.sendToCosmos')}</Text>
      </Pressable>
    </View>
  );
}

export function CatchBottleBody({
  C,
  t,
  catching,
  caught,
  error,
  onCatch,
}: {
  C: BottlesPalette;
  t: TFn;
  catching: boolean;
  caught: BottleRow | null;
  error: string;
  onCatch: () => void;
}) {
  const em = caught ? emotionMeta(caught.emotion_type) : null;
  return (
    <View>
      <Text style={[styles.modalTitle, { color: C.text }]}>{t('bottles.catchTitle')}</Text>
      <View style={styles.centerBlock}>
        {catching && !caught ? (
          <>
            <Text style={{ fontSize: 52 }}>🍾</Text>
            <Text style={[styles.hint, { color: C.text2 }]}>{t('bottles.reachingIntoVoid')}</Text>
          </>
        ) : caught && em ? (
          <View style={[styles.caughtCard, { backgroundColor: C.white, borderColor: `${em.color}55` }]}>
            <Text style={{ color: em.color, fontWeight: '800' }}>
              {em.emoji} {t(em.labelKey)}
            </Text>
            <Text style={[styles.caughtMsg, { color: C.text }]}>{caught.message || t('bottles.caughtBottleFallback')}</Text>
            <Text style={[styles.hint, { color: C.text2 }]}>
              {t('bottles.fromAnonymousTravelerId', { id: caught.sender_anon_id || caught.id })}
            </Text>
          </View>
        ) : (
          <Text style={[styles.hint, { color: C.text2 }]}>{t('bottles.tapToCatch')}</Text>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={onCatch}
        disabled={catching}
        style={[styles.cta, { backgroundColor: C.brownDk, opacity: catching ? 0.65 : 1 }]}
      >
        <Text style={styles.ctaText}>
          {catching ? t('bottles.searching') : caught ? t('bottles.catchAnother') : t('bottles.catchABottleBtn')}
        </Text>
      </Pressable>
    </View>
  );
}

export function BottlePreviewBody({
  C,
  t,
  bottle,
  missing,
  placeLabel,
  opening,
  onCatch,
  onShare,
}: {
  C: BottlesPalette;
  t: TFn;
  bottle: BottleRow | null;
  missing: boolean;
  placeLabel?: string;
  opening: boolean;
  onCatch: () => void;
  onShare: () => void;
}) {
  if (missing || !bottle) {
    return (
      <View style={styles.centerBlock}>
        <Text style={{ fontSize: 40 }}>🌊</Text>
        <Text style={[styles.modalTitle, { color: C.text }]}>{t('bottles.bottleNotFound')}</Text>
        <Text style={[styles.hint, { color: C.text2 }]}>{t('bottles.bottleNotFoundHint')}</Text>
      </View>
    );
  }
  const em = emotionMeta(bottle.emotion_type);
  return (
    <View>
      <View style={styles.row}>
        <View style={[styles.moodPill, { backgroundColor: `${em.color}22` }]}>
          <Text style={{ color: em.color, fontWeight: '800', fontSize: 12 }}>
            {em.emoji} {t(em.labelKey)}
          </Text>
        </View>
        {bottle.is_mine ? (
          <View style={[styles.moodPill, { backgroundColor: C.card2 }]}>
            <Text style={{ color: C.brown, fontWeight: '800', fontSize: 11 }}>{t('bottles.yours')}</Text>
          </View>
        ) : null}
      </View>
      {placeLabel ? (
        <Text style={[styles.selected, { color: C.brown }]}>📍 {placeLabel}</Text>
      ) : null}
      <Text style={[styles.hint, { color: C.text2, marginTop: 8 }]}>{t('bottles.fromAnonymousTraveler')}</Text>
      {bottle.message ? <Text style={[styles.previewMsg, { color: C.text }]}>{bottle.message}</Text> : null}
      {bottle.expires_at ? (
        <Text style={[styles.hint, { color: C.text2 }]}>
          {t('bottles.vanishesIn', { time: formatBottleTimeLeft(bottle.expires_at) })}
        </Text>
      ) : null}
      <Text style={[styles.hint, { color: C.text2 }]}>{relativeBottleTime(bottle.created_at)}</Text>
      <View style={[styles.row, { marginTop: 16 }]}>
        <Pressable onPress={onShare} style={[styles.ghostBtn, { backgroundColor: C.white, borderColor: C.line }]}>
          <Text style={[styles.ghostText, { color: C.text }]}>{t('bottles.copyLink')}</Text>
        </Pressable>
        {!bottle.is_mine ? (
          <Pressable
            onPress={onCatch}
            disabled={opening}
            style={[styles.solidBtn, { backgroundColor: C.brownDk, flex: 1 }]}
          >
            <Text style={styles.solidText}>{opening ? t('bottles.opening') : t('bottles.openThisBottle')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function MoodTimeline({
  C,
  t,
  timeline,
}: {
  C: BottlesPalette;
  t: TFn;
  timeline: BottleDashboard['timeline'];
}) {
  return (
    <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
      <Text style={[styles.cardTitle, { color: C.text }]}>{t('bottles.moodTimelineTitle')}</Text>
      <View style={styles.timeline}>
        {timeline.map((day) => {
          const em = emotionMeta(day.emotion);
          const has = Boolean(day.emotion);
          return (
            <View
              key={day.day}
              style={[
                styles.day,
                {
                  backgroundColor: has ? `${em.color}22` : C.card2,
                  borderColor: has ? `${em.color}55` : C.line,
                },
              ]}
            >
              <Text style={[styles.dayNum, { color: C.text2 }]}>{day.day}</Text>
              <Text style={styles.dayEmoji}>{has ? em.emoji : '·'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MoodInsights({
  C,
  t,
  dashboard,
}: {
  C: BottlesPalette;
  t: TFn;
  dashboard: BottleDashboard;
}) {
  const happyPct = happyDaysPercent(dashboard.timeline);
  return (
    <View style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}>
      <Text style={[styles.cardTitle, { color: C.text }]}>{t('bottles.moodInsights')}</Text>
      {dashboard.insights.length === 0 ? (
        <Text style={[styles.hint, { color: C.text2 }]}>{t('bottles.moodInsightsEmpty')}</Text>
      ) : (
        dashboard.insights.map((row) => {
          const em = emotionMeta(row.emotion);
          return (
            <View key={row.emotion} style={{ marginBottom: 8 }}>
              <View style={styles.insightRow}>
                <Text style={{ color: C.text, fontWeight: '700' }}>
                  {em.emoji} {t(em.labelKey)}
                </Text>
                <Text style={{ color: em.color, fontWeight: '800' }}>{row.pct}%</Text>
              </View>
              <View style={[styles.bar, { backgroundColor: C.card2 }]}>
                <View style={[styles.barFill, { width: `${Math.max(4, row.pct)}%`, backgroundColor: em.color }]} />
              </View>
            </View>
          );
        })
      )}
      {happyPct > 0 ? (
        <Text style={[styles.hint, { color: C.text2 }]}>
          {t('bottles.positiveMoodDays')} {happyPct}%
        </Text>
      ) : null}
    </View>
  );
}

export function BottleListCard({
  C,
  t,
  bottle,
  place,
  onPress,
  onDelete,
}: {
  C: BottlesPalette;
  t: TFn;
  bottle: BottleRow;
  place?: string;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const em = emotionMeta(bottle.emotion_type);
  return (
    <Pressable onPress={onPress} style={[styles.listCard, { backgroundColor: C.card2, borderColor: C.line }]}>
      {place ? <Text style={[styles.place, { color: C.brown }]}>📍 {place}</Text> : null}
      {bottle.message ? (
        <Text style={[styles.listMsg, { color: C.text }]} numberOfLines={3}>
          {bottle.message}
        </Text>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.moodPill, { backgroundColor: `${em.color}22` }]}>
          <Text style={{ color: em.color, fontWeight: '800', fontSize: 11 }}>
            {em.emoji} {t(em.labelKey)}
          </Text>
        </View>
        <Text style={[styles.hint, { color: C.text2 }]}>
          {t('bottles.anonymous')} · {relativeBottleTime(bottle.caught_at || bottle.created_at)}
        </Text>
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={C.brown} />
          </Pressable>
        ) : null}
      </View>
      {bottle.expires_at && !bottle.caught_at ? (
        <Text style={[styles.hint, { color: C.text2 }]}>⏳ {formatBottleTimeLeft(bottle.expires_at)}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 20, borderWidth: 1, maxHeight: '90%', padding: 16, paddingTop: 40 },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: '700' },
  textarea: { minHeight: 96, borderWidth: 1, borderRadius: 14, padding: 12, textAlignVertical: 'top' },
  locBox: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  locTitle: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  ghostBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  ghostText: { fontSize: 12, fontWeight: '800' },
  solidBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  solidText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  search: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  findBtn: { borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' },
  suggest: { paddingVertical: 8 },
  suggestText: { fontSize: 12 },
  selected: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  hint: { fontSize: 12, marginTop: 6 },
  error: { color: '#c0392b', fontSize: 13, fontWeight: '700', marginTop: 8 },
  polishRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cta: { marginTop: 14, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800' },
  centerBlock: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  caughtCard: { width: '100%', borderWidth: 1, borderRadius: 16, padding: 16 },
  caughtMsg: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  previewMsg: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  moodPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  timeline: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { width: 36, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 9, fontWeight: '700' },
  dayEmoji: { fontSize: 12 },
  insightRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  bar: { height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 999 },
  listCard: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10 },
  place: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  listMsg: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
});
