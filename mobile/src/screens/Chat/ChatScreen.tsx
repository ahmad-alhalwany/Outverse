import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { User } from '@/types';

type ChatTab = 'dms' | 'rooms';

interface ConversationItem {
  id: string | number;
  participant: User;
  last_message?: {
    id: string | number;
    sender: User;
    content: string;
    created_at: string;
    is_read: boolean;
  };
  unread_count: number;
  updated_at: string;
  is_muted?: boolean;
  is_archived?: boolean;
}

interface RoomItem {
  id: string | number;
  name: string;
  member_count: number;
  last_message?: {
    text: string;
    sender_name?: string;
    created_at: string;
  };
  created_at: string;
  is_expired?: boolean;
  question_text?: string | null;
}

export default function ChatScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ChatTab>('dms');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.getConversations();
      const rows = (Array.isArray(response) ? response : []).map((c: any) => ({
        id: c.id,
        participant: {
          ...(c.peer || c.participant),
          display_name: c.peer?.name || c.peer?.display_name || c.participant?.display_name,
        },
        last_message: c.last_message
          ? {
              ...c.last_message,
              content: c.last_message.content ?? c.last_message.text ?? '',
            }
          : undefined,
        unread_count: c.unread_count ?? 0,
        updated_at: c.updated_at,
        is_muted: Boolean(c.is_muted),
        is_archived: Boolean(c.is_archived),
      }));
      setConversations(rows as ConversationItem[]);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const response = await api.getRooms();
      const rows = (Array.isArray(response) ? response : []).map((r: any) => ({
        id: r.id,
        name: r.name,
        member_count: r.member_count ?? 0,
        last_message: r.last_message
          ? {
              text: r.last_message.text ?? '',
              sender_name: r.last_message.sender_name,
              created_at: r.last_message.created_at,
            }
          : undefined,
        created_at: r.created_at,
        is_expired: Boolean(r.is_expired),
        question_text: r.question_text,
      }));
      setRooms(rows as RoomItem[]);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  }, []);

  const fetchAll = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      await Promise.all([fetchConversations(), fetchRooms()]);
      setLoading(false);
      setRefreshing(false);
    },
    [fetchConversations, fetchRooms],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchAll(true);
  };

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const formatTime = (dateString: string) => {
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
  };

  const visibleConversations = conversations.filter((c) => !c.is_archived);

  const showConversationActions = (item: ConversationItem) => {
    const name = item.participant.display_name || item.participant.username;
    Alert.alert(name, undefined, [
      {
        text: item.is_muted ? 'Unmute' : 'Mute',
        onPress: () => void handleMute(item),
      },
      {
        text: item.is_archived ? 'Unarchive' : 'Archive',
        onPress: () => void handleArchive(item),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleMute = async (item: ConversationItem) => {
    const next = !item.is_muted;
    try {
      await api.muteConversation(item.id, next);
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(item.id) ? { ...c, is_muted: next } : c)),
      );
    } catch (error) {
      console.error('Failed to mute conversation:', error);
    }
  };

  const handleArchive = async (item: ConversationItem) => {
    const next = !item.is_archived;
    try {
      await api.archiveConversation(item.id, next);
      setConversations((prev) =>
        prev.map((c) => (String(c.id) === String(item.id) ? { ...c, is_archived: next } : c)),
      );
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const renderConversation = ({ item }: { item: ConversationItem }) => (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() =>
        navigation.navigate('Conversation', {
          conversationId: item.id,
          otherUser: item.participant,
        })
      }
      onLongPress={() => showConversationActions(item)}
      delayLongPress={400}
      activeOpacity={0.95}
    >
      {item.participant.avatar ? (
        <Image source={{ uri: item.participant.avatar }} style={styles.itemAvatar} />
      ) : (
        <View style={[styles.itemAvatar, styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{item.participant.username[0].toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
              {item.participant.display_name || item.participant.username}
            </Text>
            {item.is_muted && <Text style={styles.muteIcon}>🔇</Text>}
          </View>
          <Text style={[styles.itemTime, { color: colors.textSecondary }]}>
            {item.last_message ? formatTime(item.last_message.created_at) : ''}
          </Text>
        </View>
        <View style={styles.itemPreview}>
          {!item.is_muted && item.unread_count > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadBadgeText}>
                {item.unread_count > 9 ? '9+' : item.unread_count.toString()}
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.itemSubtitle,
              { color: item.unread_count > 0 && !item.is_muted ? colors.text : colors.textSecondary },
            ]}
            numberOfLines={1}
          >
            {item.last_message
              ? (item.last_message.sender?.id === user?.id ? 'You: ' : '') + item.last_message.content
              : 'No messages yet'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderRoom = ({ item }: { item: RoomItem }) => (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigation.navigate('Room', { roomId: item.id, roomName: item.name })}
      activeOpacity={0.95}
    >
      <View style={[styles.itemAvatar, styles.roomAvatar, { backgroundColor: colors.primary }]}>
        <Text style={styles.roomAvatarText}>👥</Text>
      </View>
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.itemTime, { color: colors.textSecondary }]}>
            {item.last_message ? formatTime(item.last_message.created_at) : formatTime(item.created_at)}
          </Text>
        </View>
        <View style={styles.itemPreview}>
          <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.member_count} member{item.member_count === 1 ? '' : 's'}
            {item.last_message
              ? ` · ${item.last_message.sender_name ? `${item.last_message.sender_name}: ` : ''}${item.last_message.text}`
              : ''}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const EmptyDms = () => (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 48 }}>💬</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 16 }]}>No messages yet</Text>
      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Start a conversation with someone</Text>
      <TouchableOpacity
        style={[styles.emptyActionButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('Explore')}
      >
        <Text style={styles.emptyActionButtonText}>Find people</Text>
      </TouchableOpacity>
    </View>
  );

  const EmptyRooms = () => (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 48 }}>👥</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 16 }]}>No rooms yet</Text>
      <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
        Join or create a group room on the web
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('PromptRooms')} style={styles.newMessageButton}>
            <Text style={{ fontSize: 18 }}>Prompts</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Explore')} style={styles.newMessageButton}>
            <Text style={{ fontSize: 22 }}>✏️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(['dms', 'rooms'] as ChatTab[]).map((tab) => {
          const active = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && { borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? colors.primary : colors.textSecondary },
                  active && styles.tabLabelActive,
                ]}
              >
                {tab === 'dms' ? 'DMs' : 'Rooms'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : activeTab === 'dms' ? (
        <FlatList
          data={visibleConversations}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderConversation}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={EmptyDms}
        />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRoom}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={EmptyRooms}
        />
      )}
    </SafeAreaView>
  );
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
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  newMessageButton: { padding: 4 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 15, fontWeight: '600' },
  tabLabelActive: { fontWeight: '700' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 100, flexGrow: 1 },
  listItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemAvatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  roomAvatar: { justifyContent: 'center', alignItems: 'center' },
  roomAvatarText: { fontSize: 24 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  itemTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  muteIcon: { fontSize: 14, marginLeft: 6 },
  itemTime: { fontSize: 12, fontWeight: '500' },
  itemPreview: { flexDirection: 'row', alignItems: 'center' },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  itemSubtitle: { fontSize: 14, fontWeight: '500', flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptySubtext: { fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  emptyActionButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  emptyActionButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
