import React, { useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COSMIC_REACTIONS, REACTION_BY_TYPE, totalReactions, type ReactionType } from '@/lib/reactions';
import { useTheme } from '@/hooks/useTheme';

interface ReactionPickerProps {
  selectedReaction: ReactionType | null;
  reactionCounts?: Record<string, number>;
  onReact: (type: ReactionType) => void;
}

const ORBIT_HEIGHT = 74;
const ORBIT_WIDTH = 260;

export default function ReactionPicker({ selectedReaction, reactionCounts, onReact }: ReactionPickerProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const anim = useRef(new Animated.Value(0)).current;
  const triggerRef = useRef<View>(null);
  const total = totalReactions(reactionCounts);
  const selected = selectedReaction ? REACTION_BY_TYPE[selectedReaction] : null;

  const openPicker = () => {
    triggerRef.current?.measureInWindow((x, y) => {
      const screenWidth = Dimensions.get('window').width;
      setAnchor({ x: Math.min(Math.max(x - ORBIT_WIDTH / 3, 8), screenWidth - ORBIT_WIDTH - 8), y });
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
    if (selectedReaction) pick(selectedReaction);
    else openPicker();
  };

  return (
    <View>
      <Pressable
        ref={triggerRef}
        onPress={handlePress}
        onLongPress={openPicker}
        delayLongPress={420}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={selected ? `تفاعلك: ${selected.label}. اضغط للإزالة، اضغط مطولاً للتغيير` : 'إضافة تفاعل، اضغط مطولاً لاختيار النوع'}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressedDim]}
      >
        <Text style={[styles.triggerEmoji, selected && { color: selected.color }]}>
          {selected ? selected.emoji : '🤍'}
        </Text>
        {total > 0 && (
          <Text style={[styles.triggerCount, { color: selected ? selected.color : colors.textSecondary }]}>
            {total}
          </Text>
        )}
      </Pressable>

      <Modal transparent visible={open} animationType="none" onRequestClose={closePicker}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} accessibilityLabel="إغلاق قائمة التفاعلات" accessibilityRole="button" />
        <Animated.View
          style={[
            styles.orbit,
            {
              top: anchor.y - ORBIT_HEIGHT,
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
          {COSMIC_REACTIONS.map((r) => (
            <Pressable
              key={r.type}
              onPress={() => pick(r.type)}
              style={({ pressed }) => [styles.orbBtn, pressed && styles.pressedDim]}
              hitSlop={6}
              accessibilityRole="menuitem"
              accessibilityLabel={r.label}
            >
              <Text style={styles.orbEmoji}>{r.emoji}</Text>
              <Text style={[styles.orbLabel, { color: colors.textSecondary }]}>{r.label}</Text>
            </Pressable>
          ))}
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  triggerEmoji: {
    fontSize: 20,
  },
  triggerCount: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  orbit: {
    position: 'absolute',
    width: ORBIT_WIDTH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  orbBtn: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  orbEmoji: {
    fontSize: 26,
  },
  orbLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  pressedDim: {
    opacity: 0.6,
  },
});
