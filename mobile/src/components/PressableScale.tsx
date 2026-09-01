import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  pressedOpacity?: number;
};

export default function PressableScale({
  style,
  pressedOpacity = 0.88,
  children,
  ...rest
}: Props) {
  return (
    <Pressable
      {...rest}
      style={({ pressed }) => [
        style,
        pressed ? { opacity: pressedOpacity } : null,
      ]}
    >
      {children}
    </Pressable>
  );
}
