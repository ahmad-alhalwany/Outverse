import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import Skeleton from './Skeleton';

export function PostCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.headerInfo}>
          <Skeleton width={120} height={14} />
          <Skeleton width={60} height={10} />
        </View>
      </View>
      <Skeleton width={undefined} height={300} borderRadius={0} />
      <View style={styles.actions}>
        <Skeleton width={60} height={16} />
        <Skeleton width={60} height={16} />
        <Skeleton width={60} height={16} />
      </View>
    </View>
  );
}

interface FeedSkeletonProps {
  count?: number;
}

export default function FeedSkeleton({ count = 3 }: FeedSkeletonProps) {
  return (
    <FlatList
      data={Array.from({ length: count })}
      keyExtractor={(_, i) => `skeleton-${i}`}
      renderItem={() => <PostCardSkeleton />}
      contentContainerStyle={styles.list}
      scrollEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerInfo: {
    marginLeft: 10,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  list: {
    paddingHorizontal: 14,
    paddingTop: 10,
  },
});