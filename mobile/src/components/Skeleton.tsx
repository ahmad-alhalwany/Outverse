import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export default function Skeleton({ width, height, borderRadius = 8 }: { width?: number; height?: number; borderRadius?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.skeleton,
        { width: width || '100%', height: height || 16, borderRadius, backgroundColor: colors.surfaceSecondary },
      ]}
    />
  );
}

export function PostSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.postSkeleton, { backgroundColor: colors.surface }]}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeleton, { width: 44, height: 44, borderRadius: 22 }]} />
        <View style={styles.skeletonText}>
          <View style={[styles.skeleton, { width: '60%', height: 16, borderRadius: 4 }]} />
          <View style={[styles.skeleton, { width: '40%', height: 12, borderRadius: 4 }]} />
        </View>
      </View>
      <View style={[styles.skeleton, { height: 20, borderRadius: 4, marginTop: 12, width: '80%' }]} />
      <View style={[styles.skeleton, { height: 20, borderRadius: 4, marginTop: 8, width: '60%' }]} />
      <View style={[styles.skeleton, { height: 200, borderRadius: 12, marginTop: 12 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E2E8F0',
  },
  postSkeleton: {
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  skeletonText: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
});