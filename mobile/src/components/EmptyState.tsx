import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function EmptyState({
  title,
  subtitle,
  emoji,
  icon = 'planet-outline',
}: EmptyStateProps) {
  const { colors, isDark } = useTheme();
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.10)' },
        ]}
      >
        {emoji ? (
          <Text style={styles.emoji}>{emoji}</Text>
        ) : (
          <Ionicons name={icon} size={32} color={colors.primary} />
        )}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
});
