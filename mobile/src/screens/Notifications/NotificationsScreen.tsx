import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { Notification } from '@/types';

type FilterKey = 'all' | 'mentions' | 'likes' | 'follows' | 'live';

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'likes', label: 'Likes' },
  { key: 'follows', label: 'Follows' },
  { key: 'live', label: 'Live' },
];

function notificationBucket(notification: Notification): string {
  const n = notification as Notification & Record<string, any>;
  return `${n.type || ''} ${n.verb || ''} ${n.target_type || ''}`.toLowerCase();
}

function matchesFilter(notification: Notification, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const haystack = notificationBucket(notification);
  if (filter === 'mentions') return haystack.includes('mention') || haystack.includes('tag');
  if (filter === 'likes') return haystack.includes('like') || haystack.includes('reaction');
  if (filter === 'follows') return haystack.includes('follow');
  return haystack.includes('live') || haystack.includes('stream');
}

export default function NotificationsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchNotifications = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      const response = await api.getNotifications({ page: pageNum, unread_only: false });
      const newNotifications = response.results || response;
      
      if (isRefresh || pageNum === 1) {
        setNotifications(newNotifications);
      } else {
        setNotifications(prev => [...prev, ...newNotifications]);
      }
      setHasMore(!!response.has_more || !!response.next);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => {
    fetchNotifications(1, true);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1);
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.is_read) {
      try {
        await api.markNotificationRead(notification.id.toString());
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    const n = notification as Notification & Record<string, any>;
    const verb = String(n.verb || n.type || n.target_type || '').toLowerCase();
    const targetType = String(n.target_type || '').toLowerCase();
    const pickId = (...keys: string[]) => keys.map((key) => n[key]).find((value) => value != null);

    if (verb.includes('reel')) {
      navigation.navigate('Reels', { reelId: pickId('reel_id', 'target_id', 'object_id') });
    } else if (verb.includes('story')) {
      navigation.navigate('StoryMap', { storyId: pickId('story_id', 'target_id', 'object_id') });
    } else if (verb.includes('live')) {
      navigation.navigate('LiveViewer', { sessionId: pickId('live_id', 'session_id', 'target_id', 'object_id') });
    } else if (verb.includes('idea') || targetType === 'idea') {
      navigation.navigate('BazaarDetail', { ideaId: pickId('idea_id', 'target_id', 'object_id') });
    } else if (verb.includes('chat') || verb.includes('message') || targetType.includes('chat')) {
      const roomId = pickId('room_id', 'chat_room_id');
      const conversationId = pickId('conversation_id', 'target_id', 'object_id');
      if (roomId) {
        navigation.navigate('Room', { roomId, roomName: n.room_name || n.target_text });
      } else {
        navigation.navigate('Conversation', { conversationId });
      }
    } else if (verb.includes('community') || targetType === 'community') {
      const slug = pickId('community_slug', 'slug', 'target_slug');
      if (slug) {
        navigation.navigate('CommunityDetail', { slug });
      } else {
        navigation.navigate('Communities');
      }
    } else if (verb.includes('video') || targetType === 'video') {
      navigation.navigate('Videos', { videoId: pickId('video_id', 'target_id', 'object_id') });
    } else if (notification.post) {
      navigation.navigate('PostDetail', { postId: notification.post.id });
    } else if (notification.actor) {
      navigation.navigate('Profile', { username: notification.actor.username });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const filteredNotifications = notifications.filter((notification) => matchesFilter(notification, filter));

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const renderNotification = ({ item }: { item: Notification }) => {
    const getIcon = () => {
      switch (item.type) {
        case 'like': return '❤️';
        case 'comment': return '💬';
        case 'follow': return '👤';
        case 'mention': return '📝';
        case 'repost': return '🔁';
        case 'message': return '📨';
        default: return '🔔';
      }
    };

    const getText = () => {
      const actorName = item.actor?.display_name || item.actor?.username || 'Someone';
      switch (item.type) {
        case 'like': return `${actorName} liked your post`;
        case 'comment': return `${actorName} commented on your post`;
        case 'follow': return `${actorName} started following you`;
        case 'mention': return `${actorName} mentioned you`;
        case 'repost': return `${actorName} reposted your post`;
        case 'message': return `${actorName} sent you a message`;
        default: return 'New notification';
      }
    };

    return (
      <TouchableOpacity
        style={[styles.notificationItem, { backgroundColor: item.is_read ? colors.surface : colors.primaryLight, borderColor: colors.border }]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.notificationContent}>
          <View style={[styles.notificationIcon, { backgroundColor: item.is_read ? colors.surfaceSecondary : colors.primary }]}>
            <Text style={{ fontSize: 18 }}>{getIcon()}</Text>
          </View>
          <View style={styles.notificationTextContainer}>
            <Text style={[styles.notificationText, { color: colors.text }]}>{getText()}</Text>
            <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>{formatTime(item.created_at)}</Text>
          </View>
          {!item.is_read && (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading && notifications.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllReadButton}>
            <Text style={[styles.markAllReadText, { color: colors.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '700', fontSize: 12 }}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredNotifications}
        renderItem={renderNotification}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          !loading && filteredNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>🔔</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 16 }]}>
                {filter === 'all' ? 'No notifications yet' : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} notifications`}
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>When you get notifications, they'll appear here</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          hasMore ? (
            <View style={styles.loadMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  markAllReadButton: { paddingHorizontal: 12, paddingVertical: 6 },
  markAllReadText: { fontSize: 14, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  listContent: { paddingVertical: 8 },
  notificationItem: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationTextContainer: { flex: 1, minWidth: 0 },
  notificationText: { fontSize: 15, lineHeight: 21, marginBottom: 4 },
  notificationTime: { fontSize: 12, fontWeight: '500' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8, marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  loadMore: { padding: 20, alignItems: 'center' },
});