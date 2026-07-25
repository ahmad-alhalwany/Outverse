import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

interface Props {
  emoji: string;
  x: number;
  y: number;
  onDone?: () => void;
}

/** Floating emoji burst at tap coordinates — mirrors web's ReactionBurst. */
export default function ReactionBurst({ emoji, x, y, onDone }: Props) {
  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, { toValue: 1.35, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => onDone?.());
  }, []);

  return (
    <Animated.Text
      style={[styles.burst, { left: x - 24, top: y - 24, opacity, transform: [{ scale }], pointerEvents: 'none' }]}
    >
      {emoji}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  burst: {
    position: 'absolute',
    fontSize: 48,
    width: 48,
    height: 48,
    textAlign: 'center',
    lineHeight: 48,
    zIndex: 10,
  },
});
