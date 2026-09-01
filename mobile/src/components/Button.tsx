import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
  Pressable,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps {
  label?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function Button({
  label,
  children,
  onPress,
  disabled = false,
  loading = false,
  size = 'md',
  variant = 'primary',
  fullWidth = false,
  style,
  textStyle,
  leftIcon,
  rightIcon,
}: ButtonProps) {
  const { colors } = useTheme();
  const busy = disabled || loading;

  const sizeStyles: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number; borderRadius: number; minHeight: number }> = {
    sm: { paddingVertical: 10, paddingHorizontal: 14, fontSize: 13, borderRadius: 12, minHeight: 44 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, borderRadius: 14, minHeight: 48 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, borderRadius: 999, minHeight: 52 },
  };

  const variantStyles: Record<ButtonVariant, { backgroundColor: string; borderWidth?: number; borderColor?: string }> = {
    primary: { backgroundColor: busy ? colors.disabled : colors.primary },
    secondary: { backgroundColor: busy ? colors.disabled : colors.surfaceSecondary },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: busy ? colors.disabled : colors.primary },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: busy ? colors.disabled : colors.error },
  };

  const textColorForVariant: Record<ButtonVariant, string> = {
    primary: '#fff',
    secondary: colors.text,
    outline: busy ? colors.disabled : colors.primary,
    ghost: busy ? colors.disabled : colors.primary,
    danger: '#fff',
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];
  const textColor = textColorForVariant[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={typeof label === 'string' ? label : undefined}
      accessibilityState={{ disabled: busy, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        currentVariant,
        {
          paddingVertical: currentSize.paddingVertical,
          paddingHorizontal: currentSize.paddingHorizontal,
          borderRadius: currentSize.borderRadius,
          minHeight: currentSize.minHeight,
        },
        fullWidth && styles.fullWidth,
        busy && styles.disabled,
        pressed && !busy ? styles.pressed : null,
        style,
      ]}
      onPress={onPress}
      disabled={busy}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
          <Text style={[{ fontSize: currentSize.fontSize, fontWeight: '700', color: textColor }, textStyle]}>
            {label || children}
          </Text>
          {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  fullWidth: { width: '100%' } as ViewStyle,
  disabled: { opacity: 0.55 } as ViewStyle,
  pressed: { opacity: 0.88 } as ViewStyle,
  leftIcon: { marginRight: 8 } as ViewStyle,
  rightIcon: { marginLeft: 8 } as ViewStyle,
});
