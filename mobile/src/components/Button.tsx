import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
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
  style?: ViewStyle;
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

  const sizeStyles: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number; borderRadius: number }> = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13, borderRadius: 8 },
    md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, borderRadius: 12 },
    lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17, borderRadius: 14 },
  };

  const variantStyles: Record<ButtonVariant, { backgroundColor: string; borderWidth?: number; borderColor?: string }> = {
    primary: { backgroundColor: disabled ? colors.disabled : colors.primary },
    secondary: { backgroundColor: disabled ? colors.disabled : colors.surfaceSecondary },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: disabled ? colors.disabled : colors.primary },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: disabled ? colors.disabled : colors.error },
  };

  const textColorForVariant: Record<ButtonVariant, string> = {
    primary: '#fff',
    secondary: colors.text,
    outline: disabled ? colors.disabled : colors.primary,
    ghost: disabled ? colors.disabled : colors.primary,
    danger: '#fff',
  };

  const currentSize = sizeStyles[size];
  const currentVariant = variantStyles[variant];
  const textColor = textColorForVariant[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        currentVariant,
        { paddingVertical: currentSize.paddingVertical, paddingHorizontal: currentSize.paddingHorizontal, borderRadius: currentSize.borderRadius },
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
          <Text style={[{ fontSize: currentSize.fontSize, fontWeight: '700', color: textColor }, textStyle]}>
            {label || children}
          </Text>
          {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  } as ViewStyle,
  fullWidth: { width: '100%' } as ViewStyle,
  disabled: { opacity: 0.6 } as ViewStyle,
  leftIcon: { marginRight: 8 } as ViewStyle,
  rightIcon: { marginLeft: 8 } as ViewStyle,
});