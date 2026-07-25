import React from 'react';
import { View, Text, StyleSheet, Image, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { mediaUrl } from '@/api/config';

interface AvatarProps {
  uri?: string;
  avatar?: string; // alias for uri (compatibility)
  name?: string;
  user?: { avatar?: string; username?: string }; // user object
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  verified?: boolean;
  style?: ViewStyle;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const avatarColors = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16',
];

export default function Avatar({ uri, avatar, name, user, size = 'md', verified, style }: AvatarProps) {
  const { colors: themeColors } = useTheme();
  const dimension = sizeMap[size];
  const fontSize = dimension * 0.4;
  const raw = avatar || uri || user?.avatar;
  const imageSource = mediaUrl(raw) || raw;
  const displayName = name || user?.username;

  if (imageSource) {
    return (
      <View style={[styles.container, { width: dimension, height: dimension }, style]}>
        <Image
          source={{ uri: imageSource }}
          style={[
            styles.image,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
          ]}
        />
        {verified && (
          <View style={[styles.verifiedBadge, { bottom: 0, right: 0, backgroundColor: themeColors.primary, borderColor: themeColors.surface }]} />
        )}
      </View>
    );
  }

  const initial = displayName?.charAt(0).toUpperCase() || '?';
  const colorIndex = displayName ? displayName.charCodeAt(0) % avatarColors.length : 0;
  const bgColor = avatarColors[colorIndex];

  return (
    <View style={[styles.container, { width: dimension, height: dimension, backgroundColor: bgColor }, style]}>
      <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
      {verified && (
        <View style={[styles.verifiedBadge, { bottom: 0, right: 0, backgroundColor: themeColors.primary, borderColor: themeColors.surface }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 9999,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    borderRadius: 9999,
  },
  initial: {
    fontWeight: '700',
    color: '#fff',
  },
  verifiedBadge: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});