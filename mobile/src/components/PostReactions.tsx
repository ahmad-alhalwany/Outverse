import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/hooks/useTheme';
import {
  COSMIC_REACTIONS,
  countsToEmojiMap,
  selectedEmoji,
  totalReactions,
  type ReactionType,
} from '@/lib/reactions';

interface PostReactionsProps {
  selectedReaction: ReactionType | string | null;
  reactionCounts?: Record<string, number>;
  onReact: (type: ReactionType) => void;
  compact?: boolean;
  hidePills?: boolean;
}

const ORBIT_HEIGHT = 92;
const ORBIT_WIDTH = 280;

export default function PostReactions({
  selectedReaction,
  reactionCounts,
  onReact,
  compact = false,
  hidePills = false,
}: PostReactionsProps) {
  const { t } = useLocale();
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const anim = useRef(new Animated.Value(0)).current;
  const triggerRef = useRef<View>(null);
  const emojiCounts = countsToEmojiMap(reactionCounts);
  const total = totalReactions(emojiCounts);
  const mine = selectedEmoji(selectedReaction);
  const selected = mine ? COSMIC_REACTIONS.find((r) => r.emoji === mine) : null;
  const summary = Object.entries(emojiCounts).filter(([, n]) => n > 0);

  const openPicker = () => {
    triggerRef.current?.measureInWindow((x, y) => {
      const screenWidth = Dimensions.get('window').width;
      setAnchor({
        x: Math.min(Math.max(x - 12, 8), screenWidth - ORBIT_WIDTH - 8),
        y,
      });
      Haptics.selectionAsync().catch(() => {});
      setOpen(true);
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    });
  };

  const closePicker = () => setOpen(false);

  const pick = (type: ReactionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onReact(type);
    closePicker();
  };

  const handlePress = () => {
    if (selected) pick(selected.type);
    else openPicker();
  };

  return (
    <View style={[styles.wrap, !compact && styles.wrapGrow]}>
      <Pressable
        ref={triggerRef}
        onPress={handlePress}
        onLongPress={openPicker}
        delayLongPress={420}
        accessibilityRole="button"
        accessibilityLabel={selected ? t(`reactions.${selected.type}`) : t('feed.react')}
        style={({ pressed }) => [
          styles.trigger,
          compact && styles.triggerCompact,
          {
            borderColor: selected ? `${selected.color}88` : colors.border,
            backgroundColor: selected ? `${selected.color}22` : 'rgba(106, 0, 255, 0.12)',
            shadowColor: selected ? selected.color : '#6A00FF',
          },
          selected && styles.triggerPicked,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.triggerEmoji}>{selected ? selected.emoji : '✨'}</Text>
        {!compact ? (
          <Text style={[styles.triggerLabel, { color: selected ? selected.color : colors.text }]}>
            {selected ? t(`reactions.${selected.type}`) : t('feed.react')}
          </Text>
        ) : null}
        {total > 0 ? (
          <Text style={[styles.triggerCount, { color: selected ? selected.color : colors.textSecondary }]}>
            {total}
          </Text>
        ) : null}
      </Pressable>

      {!hidePills && summary.length > 0 ? (
        <View style={styles.pills}>
          {summary.map(([emoji, count]) => {
            const meta = COSMIC_REACTIONS.find((r) => r.emoji === emoji);
            const mineThis = mine === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => meta && pick(meta.type)}
                style={[
                  styles.pill,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(106,0,255,0.06)',
                    borderColor: mineThis ? 'rgba(0,204,255,0.5)' : 'rgba(255,255,255,0.08)',
                  },
                ]}
              >
                <Text style={styles.pillEmoji}>{emoji}</Text>
                <Text style={[styles.pillCount, { color: colors.text }]}>{count}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Modal transparent visible={open} animationType="none" onRequestClose={closePicker}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} accessibilityRole="button" />
        <Animated.View
          style={[
            styles.orbit,
            {
              top: Math.max(anchor.y - ORBIT_HEIGHT - 8, 12),
              left: anchor.x,
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              opacity: anim,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
              ],
            },
          ]}
          accessibilityRole="menu"
        >
          <Text style={[styles.orbitHint, { color: colors.textSecondary }]}>{t('reactions.pickVibe')}</Text>
          <View style={styles.orbitInner}>
            {COSMIC_REACTIONS.map((r) => (
              <Pressable
                key={r.type}
                onPress={() => pick(r.type)}
                style={({ pressed }) => [
                  styles.orbBtn,
                  mine === r.emoji && { backgroundColor: `${r.color}33` },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="menuitem"
                accessibilityLabel={t(`reactions.${r.type}`)}
              >
                <Text style={styles.orbEmoji}>{r.emoji}</Text>
                <Text style={[styles.orbLabel, { color: colors.textSecondary }]}>{t(`reactions.${r.type}`)}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  wrapGrow: {
    flex: 1,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  triggerCompact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  triggerPicked: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 4,
  },
  triggerEmoji: {
    fontSize: 16,
  },
  triggerLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  triggerCount: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.85,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillEmoji: {
    fontSize: 13,
  },
  pillCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  orbit: {
    position: 'absolute',
    width: ORBIT_WIDTH,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  orbitHint: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  orbitInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orbBtn: {
    alignItems: 'center',
    width: 48,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orbEmoji: {
    fontSize: 24,
  },
  orbLabel: {
    fontSize: 9,
    marginTop: 3,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
});
