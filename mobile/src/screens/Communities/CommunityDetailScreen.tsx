import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import PostCard from '@/components/PostCard';
import type { Post } from '@/types';

type CommunityDetail = {
  id: number | string;
  slug: string;
  name: string;
  description?: string;
  rules?: string[];
  members_count?: number;
  posts_count?: number;
  privacy?: string;
  is_nsfw?: boolean;
  spoilers_enabled?: boolean;
  posting_permission?: 'members' | 'mods';
  is_member?: boolean;
  is_pending?: boolean;
  is_banned?: boolean;
  is_moderator?: boolean;
  creator_username?: string;
};

type Channel = {
  id: number;
  name: string;
  category: string;
  slowmode_seconds: number;
  channel_type?: 'text' | 'voice' | 'stage';
  unread_count?: number;
};

type StageState = {
  speakers_count?: number;
  listeners_count?: number;
  speakers?: unknown[];
  listeners?: unknown[];
};

type PendingMember = {
  id: string | number;
  username: string;
  requested_at?: string;
};

export default function CommunityDetailScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug = route.params?.slug as string;

  const [community, setCommunity] = useState<CommunityDetail | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [membershipBusy, setMembershipBusy] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [sort, setSort] = useState<'new' | 'hot' | 'top' | 'controversial'>('hot');
  const [composeText, setComposeText] = useState('');
  const [postBusy, setPostBusy] = useState(false);
  const [wiki, setWiki] = useState<Array<{ id: number; title: string; slug: string; body?: string }>>([]);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [joinedCommunities, setJoinedCommunities] = useState<Array<{ id: number | string; slug: string; name: string }>>([]);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('General');
  const [newChannelType, setNewChannelType] = useState<'text' | 'voice' | 'stage'>('text');
  const [stageStates, setStageStates] = useState<Record<number, StageState>>({});
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [banUserId, setBanUserId] = useState('');
  const [modBusy, setModBusy] = useState(false);
  const [channelDrafts, setChannelDrafts] = useState<Record<number, {
    name: string;
    category: string;
    slowmode_seconds: string;
    channel_type: 'text' | 'voice' | 'stage';
  }>>({});
  const [channelBusy, setChannelBusy] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!slug) return;
    try {
      const [comm, postsPage, chs, wikiPages, mine] = await Promise.all([
        api.getCommunity(slug),
        api.getPosts({ feed: 'community', community: slug, limit: 20, sort }).catch(() => ({ results: [] })),
        api.getCommunityChannels(slug),
        api.getCommunityWiki(slug),
        api.getCommunities({ mine: true, limit: 30 }).catch(() => ({ results: [] })),
      ]);
      const detail = comm as CommunityDetail;
      setCommunity(detail);
      setPosts((postsPage.results || []) as Post[]);
      setChannels(chs as Channel[]);
      setChannelDrafts(
        (chs as Channel[]).reduce<Record<number, {
          name: string;
          category: string;
          slowmode_seconds: string;
          channel_type: 'text' | 'voice' | 'stage';
        }>>((acc, ch) => {
          acc[ch.id] = {
            name: ch.name,
            category: ch.category || 'General',
            slowmode_seconds: String(ch.slowmode_seconds || 0),
            channel_type: ch.channel_type || 'text',
          };
          return acc;
        }, {}),
      );
      setWiki(
        (wikiPages || []).map((p: any) => ({
          id: p.id,
          title: p.title || p.slug,
          slug: p.slug,
          body: p.body || p.content,
        })),
      );
      setJoinedCommunities(
        (mine.results || [])
          .filter((c: any) => c.slug !== slug)
          .map((c: any) => ({ id: c.id, slug: c.slug, name: c.name })),
      );
      if (detail.is_moderator) {
        try {
          setPendingMembers((await api.getPendingMembers(slug)) as PendingMember[]);
        } catch {
          setPendingMembers([]);
        }
      } else {
        setPendingMembers([]);
      }
    } catch (error) {
      console.error('Failed to load community:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [slug, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreatePost = async () => {
    if (!community?.id || !composeText.trim() || postBusy) return;
    setPostBusy(true);
    try {
      await api.createPost({
        text: composeText.trim(),
        community_id: community.id,
      });
      setComposeText('');
      await load(true);
    } catch (error) {
      console.error('Post failed:', error);
    } finally {
      setPostBusy(false);
    }
  };

  const handleMembership = async () => {
    if (!community || membershipBusy) return;
    setMembershipBusy(true);
    try {
      if (community.is_member) {
        const updated = await api.leaveCommunity(slug);
        setCommunity((prev) => (prev ? { ...prev, ...updated, is_member: false } : prev));
      } else {
        const updated = await api.joinCommunity(slug);
        setCommunity((prev) => (prev ? { ...prev, ...updated, is_member: updated.is_member } : prev));
      }
      load(true);
    } catch (error) {
      console.error('Membership action failed:', error);
    } finally {
      setMembershipBusy(false);
    }
  };

  const channelIcon = (type?: Channel['channel_type']) => {
    if (type === 'voice') return '🔊';
    if (type === 'stage') return '🎤';
    return '#';
  };

  const openChannel = async (ch: Channel) => {
    try {
      if (community?.is_member) {
        await api.joinCommunityChannel(slug, ch.id);
      }
      if (ch.channel_type === 'voice' || ch.channel_type === 'stage') {
        try {
          const joinedState = await api.updateStageState(ch.id, 'join');
          const freshState = await api.getStageState(ch.id).catch(() => joinedState);
          setStageStates((prev) => ({ ...prev, [ch.id]: freshState }));
        } catch {
          // Stage presence is optional; chat should still open if unavailable.
        }
      }
      navigation.navigate('Room', {
        roomId: ch.id,
        roomName: ch.name,
        channelType: ch.channel_type,
        stage: ch.channel_type === 'voice' || ch.channel_type === 'stage',
      });
    } catch {
      Alert.alert('Error', 'Could not open channel.');
    }
  };

  const updateChannelDraft = (
    channelId: number,
    patch: Partial<{ name: string; category: string; slowmode_seconds: string; channel_type: 'text' | 'voice' | 'stage' }>,
  ) => {
    setChannelDrafts((prev) => {
      const channel = channels.find((ch) => ch.id === channelId);
      const existing = prev[channelId];
      return {
        ...prev,
        [channelId]: {
          name: existing?.name ?? channel?.name ?? '',
          category: existing?.category ?? channel?.category ?? 'General',
          slowmode_seconds: existing?.slowmode_seconds ?? String(channel?.slowmode_seconds || 0),
          channel_type: existing?.channel_type ?? channel?.channel_type ?? 'text',
          ...patch,
        },
      };
    });
  };

  const saveChannel = async (channelId: number) => {
    const draft = channelDrafts[channelId];
    if (!draft || channelBusy) return;
    setChannelBusy(true);
    try {
      const updated = await api.updateCommunityChannel(slug, channelId, {
        name: draft.name.trim(),
        category: draft.category.trim() || 'General',
        slowmode_seconds: Math.max(0, Number.parseInt(draft.slowmode_seconds, 10) || 0),
        channel_type: draft.channel_type,
      });
      setChannels((prev) => prev.map((ch) => (ch.id === channelId ? (updated as Channel) : ch)));
    } catch {
      Alert.alert('Error', 'Could not update channel.');
    } finally {
      setChannelBusy(false);
    }
  };

  const deleteChannel = async (channelId: number) => {
    Alert.alert('Delete channel?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setChannelBusy(true);
            try {
              await api.deleteCommunityChannel(slug, channelId);
              setChannels((prev) => prev.filter((ch) => ch.id !== channelId));
            } catch {
              Alert.alert('Error', 'Could not delete channel.');
            } finally {
              setChannelBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const approvePendingMember = async (memberId: string | number) => {
    if (modBusy) return;
    setModBusy(true);
    try {
      const updated = await api.approveCommunityMember(slug, memberId);
      setCommunity((prev) => (prev ? { ...prev, ...(updated as CommunityDetail) } : prev));
      setPendingMembers((prev) => prev.filter((m) => String(m.id) !== String(memberId)));
    } catch {
      Alert.alert('Error', 'Could not approve this member.');
    } finally {
      setModBusy(false);
    }
  };

  const removePendingMember = async (memberId: string | number) => {
    if (modBusy) return;
    setModBusy(true);
    try {
      await api.rejectCommunityMember(slug, memberId);
      setPendingMembers((prev) => prev.filter((m) => String(m.id) !== String(memberId)));
    } catch {
      Alert.alert('Error', 'Could not remove this request.');
    } finally {
      setModBusy(false);
    }
  };

  const banMember = async () => {
    const memberId = banUserId.trim();
    if (!memberId || modBusy) return;
    setModBusy(true);
    try {
      const updated = await api.banCommunityMember(slug, memberId);
      setCommunity((prev) => (prev ? { ...prev, ...(updated as CommunityDetail) } : prev));
      setPendingMembers((prev) => prev.filter((m) => String(m.id) !== memberId));
      setBanUserId('');
      Alert.alert('Banned', `Member ${memberId} was banned.`);
    } catch {
      Alert.alert('Error', 'Could not ban this member. Use a numeric user id.');
    } finally {
      setModBusy(false);
    }
  };

  const updateGates = async (patch: Partial<CommunityDetail>) => {
    if (!community || modBusy) return;
    const previous = community;
    const next = { ...community, ...patch };
    setCommunity(next);
    setModBusy(true);
    try {
      const updated = await api.updateCommunityGates(slug, {
        is_nsfw: next.is_nsfw,
        spoilers_enabled: next.spoilers_enabled,
        posting_permission: next.posting_permission || 'members',
      });
      setCommunity((prev) => (prev ? { ...prev, ...(updated as CommunityDetail) } : prev));
    } catch {
      setCommunity(previous);
      Alert.alert('Error', 'Could not update community gates.');
    } finally {
      setModBusy(false);
    }
  };

  const renderMembershipButton = () => {
    if (!community) return null;
    if (community.is_banned) {
      return <Text style={[styles.badge, { color: '#dc2626' }]}>Banned</Text>;
    }
    if (community.is_member) {
      return (
        <TouchableOpacity
          style={[styles.memberBtn, { borderColor: colors.border }]}
          onPress={handleMembership}
          disabled={membershipBusy}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>
            {membershipBusy ? '…' : 'Leave'}
          </Text>
        </TouchableOpacity>
      );
    }
    if (community.is_pending) {
      return <Text style={[styles.badge, { color: colors.textSecondary }]}>Pending</Text>;
    }
    return (
      <TouchableOpacity
        style={[styles.joinBtn, { backgroundColor: colors.primary }]}
        onPress={handleMembership}
        disabled={membershipBusy}
      >
        <Text style={styles.joinBtnText}>
          {membershipBusy ? '…' : community.privacy === 'private' ? 'Request' : 'Join'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {community?.name || 'Community'}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {loading && !community ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !community ? (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary }}>Community not found</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              colors={[colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.heroTop}>
                <Text style={[styles.communityName, { color: colors.text }]}>{community.name}</Text>
                {renderMembershipButton()}
              </View>
              {community.description ? (
                <Text style={[styles.description, { color: colors.textSecondary }]}>{community.description}</Text>
              ) : null}
              {community.rules && community.rules.length > 0 ? (
                <Text style={[styles.rules, { color: colors.textSecondary }]} numberOfLines={3}>
                  {community.rules.join(' · ')}
                </Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {community.members_count ?? 0} members · {community.posts_count ?? 0} posts
                {community.privacy ? ` · ${community.privacy}` : ''}
              </Text>
              {community.is_moderator ? (
                <View style={[styles.modPanel, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.channelsTitle, { color: colors.text }]}>Moderator tools</Text>
                  <Text style={[styles.meta, { color: colors.textSecondary, marginTop: 4 }]}>
                    Pending requests, bans, and community gates.
                  </Text>
                  {pendingMembers.length ? (
                    <View style={{ marginTop: 10, gap: 8 }}>
                      {pendingMembers.map((member) => (
                        <View key={String(member.id)} style={styles.pendingRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.channelName, { color: colors.text }]}>@{member.username}</Text>
                            <Text style={[styles.meta, { color: colors.textSecondary }]}>ID {member.id}</Text>
                          </View>
                          <TouchableOpacity
                            disabled={modBusy}
                            onPress={() => void approvePendingMember(member.id)}
                            style={[styles.smallBtn, { backgroundColor: colors.primary, opacity: modBusy ? 0.5 : 1 }]}
                          >
                            <Text style={styles.smallBtnText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            disabled={modBusy}
                            onPress={() => void removePendingMember(member.id)}
                            style={[styles.smallBtn, { backgroundColor: '#dc2626', opacity: modBusy ? 0.5 : 1 }]}
                          >
                            <Text style={styles.smallBtnText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.meta, { color: colors.textSecondary, marginTop: 10 }]}>No pending members.</Text>
                  )}
                  <View style={styles.banRow}>
                    <TextInput
                      value={banUserId}
                      onChangeText={setBanUserId}
                      placeholder="User ID to ban"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="number-pad"
                      style={[styles.banInput, { color: colors.text, borderColor: colors.border }]}
                    />
                    <TouchableOpacity
                      disabled={modBusy || !banUserId.trim()}
                      onPress={() => void banMember()}
                      style={[styles.smallBtn, { backgroundColor: '#dc2626', opacity: modBusy || !banUserId.trim() ? 0.5 : 1 }]}
                    >
                      <Text style={styles.smallBtnText}>Ban</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.typePills}>
                    <TouchableOpacity
                      onPress={() => void updateGates({ is_nsfw: !community.is_nsfw })}
                      disabled={modBusy}
                      style={[
                        styles.typePill,
                        { borderColor: colors.border, backgroundColor: community.is_nsfw ? '#dc2626' : colors.surface },
                      ]}
                    >
                      <Text style={{ color: community.is_nsfw ? '#fff' : colors.text, fontWeight: '700', fontSize: 11 }}>
                        NSFW {community.is_nsfw ? 'on' : 'off'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => void updateGates({ spoilers_enabled: !community.spoilers_enabled })}
                      disabled={modBusy}
                      style={[
                        styles.typePill,
                        { borderColor: colors.border, backgroundColor: community.spoilers_enabled ? colors.primary : colors.surface },
                      ]}
                    >
                      <Text style={{ color: community.spoilers_enabled ? '#fff' : colors.text, fontWeight: '700', fontSize: 11 }}>
                        Spoilers {community.spoilers_enabled ? 'on' : 'off'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        void updateGates({
                          posting_permission: community.posting_permission === 'mods' ? 'members' : 'mods',
                        })
                      }
                      disabled={modBusy}
                      style={[
                        styles.typePill,
                        { borderColor: colors.border, backgroundColor: community.posting_permission === 'mods' ? colors.primary : colors.surface },
                      ]}
                    >
                      <Text style={{ color: community.posting_permission === 'mods' ? '#fff' : colors.text, fontWeight: '700', fontSize: 11 }}>
                        {community.posting_permission === 'mods' ? 'Mods post' : 'Members post'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              <View style={styles.channelsSection}>
                  <TouchableOpacity
                    onPress={() => setChannelsOpen((v) => !v)}
                    style={styles.channelsHeader}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.channelsTitle, { color: colors.text }]}>
                      # Channels ({channels.length}) {channelsOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {channelsOpen && (
                    <View style={[styles.channelsList, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                      {channels.length === 0 ? (
                        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>No channels yet.</Text>
                      ) : (
                        channels.map((ch) => {
                          const draft = channelDrafts[ch.id] || {
                            name: ch.name,
                            category: ch.category || 'General',
                            slowmode_seconds: String(ch.slowmode_seconds || 0),
                            channel_type: ch.channel_type || 'text',
                          };
                          return (
                            <View key={ch.id} style={styles.channelCard}>
                              <TouchableOpacity
                                style={styles.channelRow}
                                onPress={() => void openChannel(ch)}
                              >
                                <Text style={[styles.channelHash, { color: colors.textSecondary }]}>{channelIcon(ch.channel_type)}</Text>
                                <Text style={[styles.channelName, { color: colors.text }]}>{ch.name}</Text>
                                {(ch.channel_type === 'voice' || ch.channel_type === 'stage') && stageStates[ch.id] ? (
                                  <Text style={[styles.stageBadge, { backgroundColor: colors.primary }]}>
                                    {stageStates[ch.id].speakers_count ?? stageStates[ch.id].speakers?.length ?? 0} speakers
                                  </Text>
                                ) : null}
                                {ch.unread_count ? (
                                  <Text style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                                    {ch.unread_count > 99 ? '99+' : ch.unread_count}
                                  </Text>
                                ) : null}
                                {ch.slowmode_seconds > 0 && (
                                  <Text style={[styles.channelMeta, { color: colors.textSecondary }]}>
                                    ⏱{ch.slowmode_seconds}s
                                  </Text>
                                )}
                              </TouchableOpacity>
                              {community.is_moderator ? (
                                <View style={styles.channelEditor}>
                                  <TextInput
                                    value={draft.name}
                                    onChangeText={(text) => updateChannelDraft(ch.id, { name: text })}
                                    placeholder="Name"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[styles.channelInput, { color: colors.text, borderColor: colors.border }]}
                                  />
                                  <TextInput
                                    value={draft.category}
                                    onChangeText={(text) => updateChannelDraft(ch.id, { category: text })}
                                    placeholder="Category"
                                    placeholderTextColor={colors.textSecondary}
                                    style={[styles.channelInput, { color: colors.text, borderColor: colors.border }]}
                                  />
                                  <TextInput
                                    value={draft.slowmode_seconds}
                                    onChangeText={(text) => updateChannelDraft(ch.id, { slowmode_seconds: text })}
                                    placeholder="Slowmode seconds"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="number-pad"
                                    style={[styles.channelInput, { color: colors.text, borderColor: colors.border }]}
                                  />
                                  <View style={styles.typePills}>
                                    {(['text', 'voice', 'stage'] as const).map((type) => (
                                      <TouchableOpacity
                                        key={type}
                                        onPress={() => updateChannelDraft(ch.id, { channel_type: type })}
                                        style={[
                                          styles.typePill,
                                          {
                                            borderColor: colors.border,
                                            backgroundColor: draft.channel_type === type ? colors.primary : colors.background,
                                          },
                                        ]}
                                      >
                                        <Text style={{ color: draft.channel_type === type ? '#fff' : colors.text, fontWeight: '700', fontSize: 11 }}>
                                          {type}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                  <View style={styles.editorActions}>
                                    <TouchableOpacity
                                      disabled={channelBusy || !draft.name.trim()}
                                      onPress={() => void saveChannel(ch.id)}
                                      style={[styles.smallBtn, { backgroundColor: colors.primary, opacity: channelBusy || !draft.name.trim() ? 0.5 : 1 }]}
                                    >
                                      <Text style={styles.smallBtnText}>Save</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      disabled={channelBusy}
                                      onPress={() => void deleteChannel(ch.id)}
                                      style={[styles.smallBtn, { backgroundColor: '#dc2626', opacity: channelBusy ? 0.5 : 1 }]}
                                    >
                                      <Text style={styles.smallBtnText}>Delete</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ) : null}
                            </View>
                          );
                        })
                      )}
                      {community.is_moderator ? (
                        <View style={{ marginTop: 10, gap: 8 }}>
                          <TextInput
                            value={newChannelName}
                            onChangeText={setNewChannelName}
                            placeholder="New channel name"
                            placeholderTextColor={colors.textSecondary}
                            style={{
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              color: colors.text,
                            }}
                          />
                          <TextInput
                            value={newChannelCategory}
                            onChangeText={setNewChannelCategory}
                            placeholder="Category"
                            placeholderTextColor={colors.textSecondary}
                            style={{
                              borderWidth: 1,
                              borderColor: colors.border,
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              paddingVertical: 8,
                              color: colors.text,
                            }}
                          />
                          <View style={styles.typePills}>
                            {(['text', 'voice', 'stage'] as const).map((type) => (
                              <TouchableOpacity
                                key={type}
                                onPress={() => setNewChannelType(type)}
                                style={[
                                  styles.typePill,
                                  {
                                    borderColor: colors.border,
                                    backgroundColor: newChannelType === type ? colors.primary : colors.background,
                                  },
                                ]}
                              >
                                <Text style={{ color: newChannelType === type ? '#fff' : colors.text, fontWeight: '700', fontSize: 11 }}>
                                  {type}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TouchableOpacity
                            disabled={channelBusy || !newChannelName.trim()}
                            onPress={() => {
                              void (async () => {
                                setChannelBusy(true);
                                try {
                                  const created = await api.createCommunityChannel(slug, {
                                    name: newChannelName.trim(),
                                    category: newChannelCategory.trim() || 'General',
                                    channel_type: newChannelType,
                                  });
                                  setChannels((prev) => [...prev, created as Channel]);
                                  setNewChannelName('');
                                  setNewChannelCategory('General');
                                  setNewChannelType('text');
                                } catch {
                                  Alert.alert('Error', 'Could not create channel.');
                                } finally {
                                  setChannelBusy(false);
                                }
                              })();
                            }}
                            style={{
                              alignSelf: 'flex-start',
                              backgroundColor: colors.primary,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 999,
                              opacity: channelBusy || !newChannelName.trim() ? 0.5 : 1,
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                              {channelBusy ? '…' : 'Create channel'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              {wiki.length > 0 && (
                <View style={styles.channelsSection}>
                  <TouchableOpacity
                    onPress={() => setWikiOpen((v) => !v)}
                    style={styles.channelsHeader}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.channelsTitle, { color: colors.text }]}>
                      Wiki ({wiki.length}) {wikiOpen ? '▲' : '▼'}
                    </Text>
                  </TouchableOpacity>
                  {wikiOpen && (
                    <View style={[styles.channelsList, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                      {wiki.map((page) => (
                        <TouchableOpacity
                          key={page.id}
                          style={styles.channelRow}
                          onPress={() =>
                            Alert.alert(page.title, (page.body || 'No content yet.').slice(0, 900))
                          }
                        >
                          <Text style={[styles.channelName, { color: colors.text }]}>{page.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                {(['hot', 'new', 'top', 'controversial'] as const).map((key) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setSort(key)}
                    style={{
                      marginRight: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: sort === key ? colors.primary : colors.background,
                    }}
                  >
                    <Text style={{ color: sort === key ? '#fff' : colors.text, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' }}>
                      {key}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {community.is_member && !community.is_banned ? (
                <View style={{ marginTop: 12, gap: 8 }}>
                  <TextInput
                    value={composeText}
                    onChangeText={setComposeText}
                    placeholder="Share a signal…"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    style={{
                      minHeight: 72,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: 10,
                      color: colors.text,
                      textAlignVertical: 'top',
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => void handleCreatePost()}
                    disabled={postBusy || !composeText.trim()}
                    style={{
                      alignSelf: 'flex-end',
                      backgroundColor: colors.primary,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      opacity: postBusy || !composeText.trim() ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{postBusy ? '…' : 'Post'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Posts</Text>
            </View>
          }
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: 'center', padding: 24 }}>
              No posts in this community yet.
            </Text>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
              onComment={() => navigation.navigate('PostDetail', { postId: item.id })}
              onCrossEcho={() => {
                if (!joinedCommunities.length) {
                  Alert.alert('Join another community', 'Cross-Echo needs another community.');
                  return;
                }
                Alert.alert(
                  'Cross-Echo',
                  'Share into another community',
                  [
                    ...joinedCommunities.slice(0, 6).map((c) => ({
                      text: c.name,
                      onPress: () => {
                        void (async () => {
                          try {
                            await api.crossEchoPost(item.id, { community_id: c.id });
                            Alert.alert('Cross-Echoed', `Shared into ${c.name}.`);
                          } catch {
                            Alert.alert('Error', 'Could not Cross-Echo.');
                          }
                        })();
                      },
                    })),
                    { text: 'Cancel', style: 'cancel' as const },
                  ],
                );
              }}
              onVote={(vote) => {
                void (async () => {
                  try {
                    const result = await api.votePost(item.id, vote);
                    setPosts((prev) =>
                      prev.map((p) =>
                        String(p.id) === String(item.id)
                          ? { ...p, vote_score: result.vote_score, my_vote: result.my_vote }
                          : p,
                      ),
                    );
                  } catch {
                    Alert.alert('Error', 'Could not Amplify/Fade.');
                  }
                })();
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  list: { padding: 12, paddingBottom: 40 },
  hero: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  communityName: { fontSize: 20, fontWeight: '800', flex: 1, marginRight: 8 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  rules: { fontSize: 12, fontStyle: 'italic', marginBottom: 8 },
  meta: { fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16 },
  badge: { fontSize: 12, fontWeight: '700' },
  joinBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  joinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  memberBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  postCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  postAuthor: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  postText: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  modPanel: { marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 10 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  banRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 },
  banInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 12 },
  channelsSection: { marginTop: 12 },
  channelsHeader: { paddingVertical: 4 },
  channelsTitle: { fontSize: 13, fontWeight: '700' },
  channelsList: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 10, marginTop: 6 },
  channelCard: { paddingVertical: 3 },
  channelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 4 },
  channelHash: { fontSize: 13 },
  channelName: { fontSize: 13, flex: 1 },
  channelMeta: { fontSize: 11 },
  unreadBadge: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  stageBadge: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  channelEditor: { gap: 6, marginTop: 6, marginBottom: 8 },
  channelInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  typePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  editorActions: { flexDirection: 'row', gap: 8 },
  smallBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
