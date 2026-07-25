import React, { isValidElement } from 'react';
import { View, Text, StyleSheet, TextInput, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface InputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode | ((props: { color: string }) => React.ReactNode);
  rightIcon?: React.ReactNode | ((props: { color: string }) => React.ReactNode);
  variant?: 'default' | 'outlined' | 'filled';
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
  onSubmitEditing?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  editable?: boolean;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
}

export default function Input({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = 'outlined',
  value,
  defaultValue,
  onChangeText,
  placeholder,
  placeholderTextColor: customPlaceholderColor,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType = 'done',
  onSubmitEditing,
  onBlur,
  onFocus,
  editable = true,
  maxLength,
  multiline = false,
  numberOfLines = 1,
  style,
}: InputProps) {
  const { colors } = useTheme();

  const hasError = !!error;
  const borderColor = hasError ? colors.error : colors.border;

  const variantStyles = {
    default: {
      backgroundColor: colors.inputBg || colors.surfaceSecondary,
      borderWidth: 1,
      borderColor,
    },
    outlined: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor,
    },
    filled: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 0,
    },
  };

  const baseInputStyle = {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
    paddingHorizontal: 16,
  };

  const renderIcon = (icon: React.ReactNode | ((props: { color: string }) => React.ReactNode) | undefined) => {
    if (!icon) return null;
    if (typeof icon === 'function') {
      return icon({ color: colors.textSecondary });
    }
    return isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { color: colors.textSecondary }) : icon;
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      )}
      <View
        style={[
          styles.inputWrapper,
          variantStyles[variant],
          hasError && styles.error,
          style,
        ]}
      >
        {leftIcon && (
          <View style={styles.iconLeft}>
            {renderIcon(leftIcon)}
          </View>
        )}
        <TextInput
          style={baseInputStyle}
          value={value}
          defaultValue={defaultValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={customPlaceholderColor || colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onBlur={onBlur}
          onFocus={onFocus}
          editable={editable}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          selectionColor={colors.primary}
        />
        {rightIcon && (
          <View style={styles.iconRight}>
            {renderIcon(rightIcon)}
          </View>
        )}
      </View>
      {(error || helperText) && (
        <Text style={[styles.helperText, { color: hasError ? colors.error : colors.textSecondary }]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    minHeight: 52,
  },
  error: { borderWidth: 2 },
  iconLeft: { marginLeft: 12, marginRight: 8 },
  iconRight: { marginRight: 12, marginLeft: 8 },
  helperText: { fontSize: 12, marginTop: 6, marginLeft: 4 },
});