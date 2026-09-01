import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  asChatList,
  moodEmoji,
  previewText,
  relativeChatTime,
  useChatPalette,
  type ChatConversation,
  type ChatFriend,
  type ChatPalette,
  type ChatRoomRow,
} from '@/lib/chat';
import { formatRoomExpires } from '@/lib/rooms';

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const C = useChatPalette(isDark);
  const { t } = useLocale();

  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [me, setMe] = useState<ChatFriend | null>(null);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [requests, setRequests] = useState<ChatConversation[]>([]);
  const [rooms, setRooms] = useState<ChatRoomRow[]>([]);
  const [promptRooms, setPromptRooms] = useState<ChatRoomRow[]>([]);
  const [search, setSearch] = useState('');
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [friendsRes, convs, reqs, roomRows, promptRows] = await Promise.all([
        api.getChatFriends(),
        api.getConversations({ type: 'primary' }),
        api.getConversations({ type: 'requests' }),
        api.getRooms(),
        api.getPromptRooms(),
      ]);
      setFriends(asChatList<ChatFriend>(friendsRes.friends));
      if (friendsRes.me) setMe(friendsRes.me as ChatFriend);
      setConversations(asChatList<ChatConversation>(convs));
      setRequests(asChatList<ChatConversation>(reqs));
      setRooms(asChatList<ChatRoomRow>(roomRows));
      setPromptRooms(asChatList<ChatRoomRow>(promptRows));
      void api.pingChatPresence();
    } catch {
      /* keep last known lists */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const visibleConversations = useMemo(
    () => conversations.filter((c) => !c.is_archived),
    [conversations],
  );
  const archivedConversations = useMemo(
    () => conversations.filter((c) => c.is_archived),
    [conversations],
  );
  const groupRooms = useMemo(
    () => rooms.filter((r) => !r.question_text && !r.is_expired),
    [rooms],
  );
  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q) ||
        (f.status_message || '').toLowerCase().includes(q),
    );
  }, [friends, search]);

  const openConversation = async (peer: ChatFriend, conversationId?: number) => {
    let cid = conversationId;
    if (!cid) {
      try {
        const conv = await api.startConversation(peer.id);
        cid = conv.id;
      } catch {
        Alert.alert(t('chat.title'), t('chat.loadConversationFailed'));
        return;
      }
    }
    navigation.navigate('Conversation', {
      conversationId: cid,
      otherUser: {
        id: peer.id,
        username: peer.username,
        display_name: peer.name || peer.username,
        avatar: peer.avatar || undefined,
      },
    });
  };

  const acceptRequest = async (conversation: ChatConversation) => {
    try {
      await api.acceptConversationRequest(conversation.id);
      setRequests((prev) => prev.filter((c) => c.id !== conversation.id));
      setConversations((prev) => (prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]));
    } catch {
      Alert.alert(t('chat.title'), t('chat.loadRequestsFailed'));
    }
  };

  const createRoom = async () => {
    if (!roomName.trim() || creating) return;
    setCreating(true);
    try {
      const room = await api.createChatRoom(roomName.trim());
      setCreateOpen(false);
      setRoomName('');
      navigation.navigate('Room', { roomId: room.id, roomName: room.name });
    } catch {
      Alert.alert(t('chat.title'), t('chat.createRoomFailed'));
    } finally {
      setCreating(false);
    }
  };

  const showConversationActions = (item: ChatConversation) => {
    const name = item.peer?.name || item.peer?.username || t('chat.friendFallback');
    Alert.alert(name, undefined, [
      {
        text: item.is_muted ? t('chat.unmute') : t('chat.muteConversation'),
        onPress: () => void toggleMute(item),
      },
      {
        text: item.is_archived ? t('chat.unarchive') : t('chat.archive'),
        onPress: () => void toggleArchive(item),
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const toggleMute = async (item: ChatConversation) => {
    const next = !item.is_muted;
    try {
      await api.muteConversation(item.id, next);
      setConversations((prev) => prev.map((c) => (c.id === item.id ? { ...c, is_muted: next } : c)));
    } catch {
      Alert.alert(t('chat.title'), t('chat.muteStateFailed'));
    }
  };

  const toggleArchive = async (item: ChatConversation) => {
    const next = !item.is_archived;
    try {
      await api.archiveConversation(item.id, next);
      setConversations((prev) => prev.map((c) => (c.id === item.id ? { ...c, is_archived: next } : c)));
    } catch {
      Alert.alert(t('chat.title'), t('chat.archiveStateFailed'));
    }
  };

  const meName = me?.name || user?.display_name || user?.username || t('chat.cosmicExplorer');

  const toggleMood = async () => {
    const next = me?.mood_icon === 'cloud' ? 'sun' : 'cloud';
    setMe((prev) => (prev ? { ...prev, mood_icon: next } : prev));
    try {
      const data = await api.pingChatPresence({ mood_icon: next });
      if (data?.mood_icon) {
        setMe((prev) => (prev ? { ...prev, mood_icon: data.mood_icon } : prev));
      }
    } catch {
      setMe((prev) => (prev ? { ...prev, mood_icon: next === 'sun' ? 'cloud' : 'sun' } : prev));
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: C.cream }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: C.line, backgroundColor: C.cream }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </Pressable>
          <Text style={[styles.title, { color: C.brownDk }]}>{t('chat.title')}</Text>
          <View style={styles.liveRow}>
            <View style={[styles.liveDot, { backgroundColor: C.online }]} />
            <Text style={[styles.liveText, { color: C.text2 }]}>{t('chat.liveStatus')}</Text>
          </View>
        </View>

        {loading && conversations.length === 0 && friends.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={{ color: C.text2, marginTop: 8 }}>{t('chat.loadingChat')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
          >
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={C.text2} style={styles.searchIcon} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('chat.searchFriends')}
                placeholderTextColor={C.text2}
                style={[styles.search, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
              />
            </View>

            {requests.length > 0 ? (
              <View style={styles.section}>
                <Pressable onPress={() => setRequestsOpen((v) => !v)} style={[styles.reqToggle, { backgroundColor: C.card }]}>
                  <Text style={[styles.reqToggleText, { color: C.text2 }]}>
                    {t('chat.requests')} ({requests.length})
                  </Text>
                  <Text style={{ color: C.text2 }}>{requestsOpen ? '▲' : '▼'}</Text>
                </Pressable>
                {requestsOpen
                  ? requests.map((row) => (
                      <Row
                        key={`req-${row.id}`}
                        C={C}
                        title={row.peer?.name || t('chat.unknownUser')}
                        subtitle={previewText(row.last_message)}
                        avatar={row.peer?.avatar}
                        online={row.peer?.is_online}
                        onPress={() => row.peer && void openConversation(row.peer, row.id)}
                        trailing={
                          <Pressable onPress={() => void acceptRequest(row)} style={[styles.accept, { backgroundColor: C.brown }]}>
                            <Text style={styles.acceptText}>{t('chat.acceptRequest')}</Text>
                          </Pressable>
                        }
                      />
                    ))
                  : null}
              </View>
            ) : null}

            <SectionLabel C={C} label={t('chat.conversationsLabel')} />
            {visibleConversations.length === 0 ? (
              <Text style={[styles.emptyHint, { color: C.text2 }]}>{t('chat.noMessagesYet')}</Text>
            ) : (
              visibleConversations.map((row) => (
                <Row
                  key={`dm-${row.id}`}
                  C={C}
                  title={row.peer?.name || t('chat.unknownUser')}
                  subtitle={previewText(row.last_message) || t('chat.noMessagesYet')}
                  avatar={row.peer?.avatar}
                  online={row.peer?.is_online}
                  muted={row.is_muted}
                  time={row.last_message?.created_at ? relativeChatTime(row.last_message.created_at, t) : ''}
                  unread={row.is_muted ? 0 : row.unread_count}
                  onPress={() => row.peer && void openConversation(row.peer, row.id)}
                  onLongPress={() => showConversationActions(row)}
                />
              ))
            )}

            <SectionLabel C={C} label={t('chat.promptRooms')} />
            <Pressable onPress={() => navigation.navigate('PromptRooms')} style={[styles.ghostBtn, { backgroundColor: C.card }]}>
              <Ionicons name="sparkles" size={14} color={C.brownDk} />
              <Text style={[styles.ghostBtnText, { color: C.brownDk }]}>{t('chat.newPrompt')}</Text>
            </Pressable>
            {promptRooms.length === 0 ? (
              <Text style={[styles.emptyHint, { color: C.text2 }]}>{t('chat.startPromptHint')}</Text>
            ) : (
              promptRooms.map((room) => (
                <Row
                  key={`pr-${room.id}`}
                  C={C}
                  emoji="✨"
                  title={room.question_text || room.name}
                  subtitle={`${t('chat.explorersCount', { count: room.member_count })} · ${formatRoomExpires(room.expires_at, t)}`}
                  onPress={() =>
                    navigation.navigate('Room', {
                      roomId: room.id,
                      roomName: room.question_text || room.name,
                      isExpired: room.is_expired,
                      questionText: room.question_text,
                      questionCategory: room.question_category,
                    })
                  }
                />
              ))
            )}

            <SectionLabel C={C} label={t('chat.groupRooms')} />
            <Pressable onPress={() => setCreateOpen(true)} style={[styles.ghostBtn, { backgroundColor: C.card }]}>
              <Text style={[styles.ghostBtnText, { color: C.brownDk }]}>+ {t('chat.newRoom')}</Text>
            </Pressable>
            {groupRooms.map((room) => (
              <Row
                key={`rm-${room.id}`}
                C={C}
                emoji="👥"
                title={room.name}
                subtitle={t('chat.membersCount', { count: room.member_count })}
                time={room.last_message?.created_at ? relativeChatTime(room.last_message.created_at, t) : ''}
                onPress={() =>
                  navigation.navigate('Room', {
                    roomId: room.id,
                    roomName: room.name,
                    channelType: room.channel_type,
                  })
                }
              />
            ))}

            {archivedConversations.length > 0 ? (
              <View style={styles.section}>
                <Pressable onPress={() => setArchivedOpen((v) => !v)} style={[styles.reqToggle, { backgroundColor: C.card }]}>
                  <Text style={[styles.reqToggleText, { color: C.text2 }]}>
                    {t('chat.archived')} ({archivedConversations.length})
                  </Text>
                  <Text style={{ color: C.text2 }}>{archivedOpen ? '▲' : '▼'}</Text>
                </Pressable>
                {archivedOpen
                  ? archivedConversations.map((row) => (
                      <Row
                        key={`arch-${row.id}`}
                        C={C}
                        title={row.peer?.name || t('chat.unknownUser')}
                        subtitle={previewText(row.last_message) || t('chat.noMessagesYet')}
                        avatar={row.peer?.avatar}
                        muted={row.is_muted}
                        time={row.last_message?.created_at ? relativeChatTime(row.last_message.created_at, t) : ''}
                        onPress={() => row.peer && void openConversation(row.peer, row.id)}
                        onLongPress={() => showConversationActions(row)}
                      />
                    ))
                  : null}
              </View>
            ) : null}

            <SectionLabel C={C} label={t('chat.friendsLabel')} />
            {filteredFriends.length === 0 ? (
              <View style={styles.emptyFriends}>
                <Text style={[styles.emptyHint, { color: C.text2 }]}>{t('chat.followToChat')}</Text>
                <Pressable onPress={() => navigation.navigate('Explore')} style={[styles.accept, { backgroundColor: C.brownDk, alignSelf: 'center' }]}>
                  <Text style={styles.acceptText}>{t('nav.discover')}</Text>
                </Pressable>
              </View>
            ) : (
              filteredFriends.map((friend) => (
                <Row
                  key={`fr-${friend.id}`}
                  C={C}
                  title={friend.name}
                  subtitle={friend.status_message}
                  avatar={friend.avatar}
                  online={friend.is_online}
                  mood={moodEmoji(friend.mood_icon)}
                  onPress={() => void openConversation(friend)}
                />
              ))
            )}
          </ScrollView>
        )}

        <View style={[styles.meBar, { backgroundColor: C.card2, borderTopColor: C.line }]}>
          {me?.avatar ? (
            <Image source={{ uri: mediaUrl(me.avatar) }} style={styles.meAvatar} />
          ) : (
            <View style={[styles.meAvatar, { backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{meName.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.meName, { color: C.text }]} numberOfLines={1}>
              {meName}
            </Text>
            <Text style={{ color: C.online, fontSize: 12 }}>{t('chat.online')}</Text>
          </View>
          <Pressable onPress={() => void toggleMood()} hitSlop={8} accessibilityLabel={t('chat.moodStamp')}>
            <Text style={{ fontSize: 20 }}>{moodEmoji(me?.mood_icon)}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
            <Ionicons name="settings-outline" size={22} color={C.text2} />
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
          <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={() => setCreateOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
            <Text style={[styles.modalTitle, { color: C.text }]}>{t('chat.newGroupRoom')}</Text>
            <TextInput
              value={roomName}
              onChangeText={setRoomName}
              placeholder={t('chat.roomNamePlaceholder')}
              placeholderTextColor={C.text2}
              style={[styles.input, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setCreateOpen(false)} style={[styles.modalBtn, { backgroundColor: C.card }]}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => void createRoom()}
                disabled={creating || !roomName.trim()}
                style={[styles.modalBtn, { backgroundColor: C.brownDk, opacity: creating || !roomName.trim() ? 0.55 : 1 }]}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{t('chat.createRoomLabel')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SectionLabel({ C, label }: { C: ChatPalette; label: string }) {
  return <Text style={[styles.sectionLabel, { color: C.text2 }]}>{label}</Text>;
}

function Row({
  C,
  title,
  subtitle,
  avatar,
  emoji,
  online,
  muted,
  mood,
  time,
  unread,
  trailing,
  onPress,
  onLongPress,
}: {
  C: ChatPalette;
  title: string;
  subtitle?: string;
  avatar?: string | null;
  emoji?: string;
  online?: boolean;
  muted?: boolean;
  mood?: string;
  time?: string;
  unread?: number;
  trailing?: React.ReactNode;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const src = avatar ? mediaUrl(avatar) : '';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? C.card : 'transparent' }]}
    >
      <View style={styles.avatarWrap}>
        {src ? (
          <Image source={{ uri: src }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: emoji ? 18 : 16 }}>{emoji || title.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
        {online ? <View style={[styles.onlineDot, { backgroundColor: C.online, borderColor: C.white }]} /> : null}
      </View>
      <View style={styles.meta}>
        <View style={styles.metaTop}>
          <Text style={[styles.name, { color: C.text }]} numberOfLines={1}>
            {title}
            {muted ? ' 🔇' : ''}
          </Text>
          {time ? <Text style={[styles.time, { color: C.text2 }]}>{time}</Text> : null}
        </View>
        {subtitle ? (
          <Text style={[styles.status, { color: C.text2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {unread && unread > 0 ? (
        <View style={[styles.badge, { backgroundColor: C.brown }]}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      ) : null}
      {mood ? <Text style={{ fontSize: 16 }}>{mood}</Text> : null}
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontWeight: '800' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 16 },
  searchWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  searchIcon: { position: 'absolute', left: 24, top: 24, zIndex: 1 },
  search: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 36,
    fontSize: 14,
  },
  section: { paddingHorizontal: 8, paddingTop: 8 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  reqToggle: {
    marginHorizontal: 8,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  reqToggleText: { fontSize: 12, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 6,
    borderRadius: 14,
  },
  avatarWrap: { width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  meta: { flex: 1, minWidth: 0 },
  metaTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700' },
  time: { fontSize: 11, fontWeight: '600' },
  status: { fontSize: 12, marginTop: 2 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  ghostBtn: {
    marginHorizontal: 14,
    marginBottom: 6,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  ghostBtnText: { fontSize: 12, fontWeight: '800' },
  emptyHint: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 8, lineHeight: 18 },
  emptyFriends: { gap: 10, paddingBottom: 8 },
  accept: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  meBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  meAvatar: { width: 36, height: 36, borderRadius: 18 },
  meName: { fontSize: 14, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'center', padding: 16 },
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: { borderRadius: 22, borderWidth: 1, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 14 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
});
