import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
} from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { User, Post, Reel } from '@/types';

const GRID_GAP = 2;
const CELL = (Dimensions.get('window').width - GRID_GAP * 2) / 3;

type CreatorTier = {
  id: string | number;
  name: string;
  description?: string;
  price_usd?: number;
  price_usd_cents?: number;
  is_active?: boolean;
};

type ExperienceItem = {
  id: string | number;
  title: string;
  organization?: string;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
  description?: string;
};

interface ProfileScreenProps {
  route: { params?: { username?: string } };
  navigation: any;
}

function postThumb(post: Post): string {
  const m = post.media?.[0];
  if (!m) return '';
  return mediaUrl(m.thumbnail_url || m.thumbnail || m.media_file || m.url || m.file) || '';
}

function isVideoPost(post: Post): boolean {
  const m = post.media?.[0];
  const t = m?.media_type || m?.file_type || m?.type;
  return t === 'video';
}

export default function ProfileScreen({ route, navigation }: ProfileScreenProps) {
  const { user, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
  const targetUsername = route.params?.username;
  const isOwnProfile = !targetUsername || (user && targetUsername === user.username);

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'grid' | 'reels' | 'tagged'>('grid');
  const [following, setFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [experience, setExperience] = useState<ExperienceItem[]>([]);
  const [subscribeBusy, setSubscribeBusy] = useState(false);

  const handlePinPost = async (post: Post) => {
    if (!isOwnProfile) return;
    try {
      const result = await api.pinProfilePost(post.id);
      if ((result as { error?: string }).error) {
        Alert.alert('Pinned signal', (result as { error?: string }).error || 'Could not pin.');
        return;
      }
      setPosts((prev) => {
        const next = prev.map((p) =>
          String(p.id) === String(post.id)
            ? { ...p, is_profile_pinned: !!result.is_profile_pinned }
            : p,
        );
        return [...next].sort((a, b) => Number(!!b.is_profile_pinned) - Number(!!a.is_profile_pinned));
      });
    } catch {
      Alert.alert('Error', 'Could not update pinned signal.');
    }
  };

  const mediaPosts = useMemo(
    () =>
      [...posts]
        .filter((p) => !!postThumb(p))
        .sort((a, b) => Number(!!b.is_profile_pinned) - Number(!!a.is_profile_pinned)),
    [posts],
  );

  const fetchProfile = async () => {
    try {
      const username = targetUsername || user?.username;
      if (!username) return;
      if (isOwnProfile && user?.id) {
        try {
          const full = await api.getProfileById(user.id);
          setProfile({ ...user, ...full });
          if (full.followers_count !== undefined) setFollowersCount(full.followers_count);
          if (full.following_count !== undefined) setFollowingCount(full.following_count);
          return;
        } catch {
          setProfile(user);
          return;
        }
      }
      const profileData = await api.getProfile(username);
      setProfile(profileData);
      setFollowing(!!profileData.is_following);
      if (profileData.followers_count !== undefined) setFollowersCount(profileData.followers_count);
      if (profileData.following_count !== undefined) setFollowingCount(profileData.following_count);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const profileId = profile?.id || (isOwnProfile ? user?.id : undefined);
      const response = await api.getPosts({
        offset: 0,
        limit: 60,
        author: profileId,
      });
      setPosts(response.results || []);
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchReels = async () => {
    try {
      const response = await api.getReels({ limit: 40, offset: 0 });
      const mineId = profile?.id || user?.id;
      const rows = (response.results || []).filter((r: Reel) => String(r.user?.id) === String(mineId));
      setReels(rows);
    } catch {
      setReels([]);
    }
  };

  const fetchExperience = async () => {
    const profileId = profile?.id;
    if (!profileId || isOwnProfile) {
      setExperience([]);
      return;
    }
    try {
      const rows = await api.getUserExperience(profileId);
      setExperience(Array.isArray(rows) ? (rows as ExperienceItem[]) : []);
    } catch {
      setExperience([]);
    }
  };

  const handleFollow = async () => {
    if (!profile || !isAuthenticated) return;
    try {
      const result = await api.toggleFollow(profile.id);
      const next = result.is_following ?? result.following ?? !following;
      setFollowing(!!next);
      setFollowersCount((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    } catch (error) {
      console.error('Follow failed:', error);
      Alert.alert('Error', 'Failed to follow/unfollow');
    }
  };

  const handleSubscribe = async () => {
    if (!profile || subscribeBusy) return;
    setSubscribeBusy(true);
    try {
      const rows = (await api.getCreatorTiers(profile.id)) as CreatorTier[];
      const tiers = rows.filter((tier) => tier.is_active !== false);
      if (!tiers.length) {
        Alert.alert('Subscribe', 'This creator has no active tiers yet.');
        return;
      }
      Alert.alert(
        'Choose a tier',
        `Subscribe to @${profile.username}`,
        [
          ...tiers.slice(0, 6).map((tier) => ({
            text: `${tier.name} - $${Number(tier.price_usd ?? (tier.price_usd_cents || 0) / 100).toFixed(2)}`,
            onPress: () => {
              void (async () => {
                try {
                  const checkout = await api.startCreatorCheckout(tier.id);
                  if (checkout.checkout_url) {
                    await Linking.openURL(checkout.checkout_url);
                  } else {
                    Alert.alert('Subscribe', 'Checkout URL was not returned.');
                  }
                } catch {
                  Alert.alert('Error', 'Could not start checkout.');
                }
              })();
            },
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ],
      );
    } catch {
      Alert.alert('Error', 'Could not load subscription tiers.');
    } finally {
      setSubscribeBusy(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, [targetUsername]);

  useEffect(() => {
    if (profile?.id || (isOwnProfile && user?.id)) {
      setPostsLoading(true);
      void fetchPosts();
      void fetchReels();
      void fetchExperience();
    }
  }, [profile?.id, user?.id, isOwnProfile]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>User not found</Text>
      </SafeAreaView>
    );
  }

  const tabs = [
    { key: 'grid' as const, label: '◼' },
    { key: 'reels' as const, label: '▶' },
    { key: 'tagged' as const, label: '◎' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ height: 160, width: '100%', backgroundColor: isDark ? '#1B1836' : '#EDE4FB' }}>
          {profile.cover_image || profile.cover_photo ? (
            <Image
              source={{ uri: profile.cover_image || profile.cover_photo }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : null}
        </View>

        <View
          style={{
            padding: 16,
            paddingTop: 0,
            marginTop: -52,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ alignItems: 'center' }}>
            {profile.avatar ? (
              <Image
                source={{ uri: profile.avatar }}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  borderWidth: 3,
                  borderColor: '#A78BFA',
                }}
              />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 3,
                  borderColor: '#A78BFA',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 34, fontWeight: '700' }}>
                  {profile.username[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>
              {profile.display_name || profile.username}
              {profile.is_verified ? ' ✓' : ''}
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 2 }}>@{profile.username}</Text>
          </View>

          {profile.bio ? (
            <Text
              style={{
                fontSize: 14,
                textAlign: 'center',
                marginTop: 10,
                lineHeight: 20,
                paddingHorizontal: 12,
                color: colors.text,
              }}
            >
              {profile.bio}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 14, paddingVertical: 10 }}>
            <TouchableOpacity style={{ alignItems: 'center', minWidth: 64 }} onPress={() => navigation.navigate('Followers', { username: profile.username })}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{followersCount.toLocaleString()}</Text>
              <Text style={{ fontSize: 12, marginTop: 2, color: colors.textSecondary }}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', minWidth: 64 }} onPress={() => navigation.navigate('Following', { username: profile.username })}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{followingCount.toLocaleString()}</Text>
              <Text style={{ fontSize: 12, marginTop: 2, color: colors.textSecondary }}>Following</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center', minWidth: 64 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{posts.length}</Text>
              <Text style={{ fontSize: 12, marginTop: 2, color: colors.textSecondary }}>Signals</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8, gap: 8 }}>
            {isOwnProfile ? (
              <>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(124,58,237,0.12)',
                    borderColor: 'rgba(167,139,250,0.35)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('EditProfile')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Edit Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(15,23,42,0.08)',
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('Settings')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(196,181,253,0.14)',
                    borderColor: 'rgba(196,181,253,0.45)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('WorldsHub')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#C4B5FD' }}>Worlds</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(124,58,237,0.2)',
                    borderColor: '#A78BFA',
                    borderWidth: 1,
                  }}
                  onPress={() =>
                    navigation.navigate('Highlights', { userId: profile.id, isOwner: true })
                  }
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#A78BFA' }}>Constellations</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(34,211,238,0.12)',
                    borderColor: 'rgba(34,211,238,0.4)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('OrbitFriends')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#22D3EE' }}>Orbit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(99,102,241,0.12)',
                    borderColor: 'rgba(99,102,241,0.4)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('OrbitLists')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#6366F1' }}>Lists</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(167,139,250,0.14)',
                    borderColor: 'rgba(167,139,250,0.4)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('PulseCreator')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#A78BFA' }}>Pulse</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(239,68,68,0.12)',
                    borderColor: 'rgba(239,68,68,0.35)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('CreatorStudio')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>Studio</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(14,165,233,0.12)',
                    borderColor: 'rgba(14,165,233,0.4)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('Videos')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0EA5E9' }}>Videos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    borderColor: 'rgba(245,158,11,0.4)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('Playlists')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#F59E0B' }}>Playlists</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(16,185,129,0.12)',
                    borderColor: 'rgba(16,185,129,0.4)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('Experience')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#10B981' }}>Experience</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(59,130,246,0.12)',
                    borderColor: 'rgba(59,130,246,0.4)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('Vault')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#3B82F6' }}>Boards</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 999,
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    borderColor: 'rgba(99,102,241,0.35)',
                    borderWidth: 1,
                  }}
                  onPress={() => navigation.navigate('SignalPublish')}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#6366F1' }}>Signal</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={{ flexDirection: 'row' }}>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 22,
                    paddingVertical: 9,
                    borderRadius: 999,
                    marginRight: 6,
                    backgroundColor: following ? colors.surfaceSecondary : '#7C3AED',
                    borderColor: following ? colors.border : '#7C3AED',
                    borderWidth: 1,
                  }}
                  onPress={handleFollow}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: following ? colors.text : '#fff' }}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 22,
                    paddingVertical: 9,
                    borderRadius: 999,
                    marginLeft: 6,
                    borderWidth: 1,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => void handleSubscribe()}
                  disabled={subscribeBusy}
                  style={{
                    paddingHorizontal: 22,
                    paddingVertical: 9,
                    borderRadius: 999,
                    marginLeft: 6,
                    borderWidth: 1,
                    backgroundColor: '#7C3AED',
                    borderColor: '#7C3AED',
                    opacity: subscribeBusy ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                    {subscribeBusy ? '...' : 'Subscribe'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {!isOwnProfile && experience.length > 0 ? (
          <View style={{ padding: 16, paddingTop: 12 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>
              Experience
            </Text>
            {experience.slice(0, 4).map((item) => (
              <View
                key={String(item.id)}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>{item.title}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {item.organization || 'Independent'} · {item.start_date || 'Start'} - {item.is_current ? 'Present' : item.end_date || 'End'}
                </Text>
                {item.description ? (
                  <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, marginTop: 7 }} numberOfLines={3}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={{ fontSize: 16, color: activeTab === tab.key ? '#A78BFA' : colors.textSecondary }}>
                {tab.label}
              </Text>
              {activeTab === tab.key ? (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '20%',
                    right: '20%',
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: '#A78BFA',
                  }}
                />
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {postsLoading ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : activeTab === 'grid' ? (
          mediaPosts.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textSecondary }}>No media signals yet</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {mediaPosts.map((post) => {
                const uri = postThumb(post);
                return (
                  <Pressable
                    key={post.id}
                    onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                    onLongPress={() => {
                      if (!isOwnProfile) return;
                      Alert.alert(
                        'Pinned signal',
                        post.is_profile_pinned ? 'Unpin from profile?' : 'Pin this signal on your profile?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: post.is_profile_pinned ? 'Unpin' : 'Pin',
                            onPress: () => void handlePinPost(post),
                          },
                        ],
                      );
                    }}
                    style={{ width: CELL, height: CELL, backgroundColor: '#16102c' }}
                  >
                    {uri ? (
                      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : null}
                    {post.is_profile_pinned ? (
                      <View style={[styles.videoBadge, { left: 6, right: undefined, top: 6 }]}>
                        <Text style={styles.videoBadgeText}>📌</Text>
                      </View>
                    ) : null}
                    {isVideoPost(post) ? (
                      <View style={styles.videoBadge}>
                        <Text style={styles.videoBadgeText}>▶</Text>
                      </View>
                    ) : null}
                    {(post.media?.length || 0) > 1 ? (
                      <View style={styles.multiBadge}>
                        <Text style={styles.multiBadgeText}>▦</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )
        ) : activeTab === 'reels' ? (
          reels.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textSecondary }}>No reels yet</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
              {reels.map((reel) => (
                <Pressable
                  key={reel.id}
                  onPress={() => navigation.navigate('Reels')}
                  style={{ width: CELL, height: CELL * 1.35, backgroundColor: '#0f0a1f' }}
                >
                  {reel.video_url || reel.video ? (
                    <Image
                      source={{ uri: mediaUrl(reel.video_url || reel.video) || '' }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#A78BFA', fontSize: 22 }}>▶</Text>
                    </View>
                  )}
                  <View style={styles.videoBadge}>
                    <Text style={styles.videoBadgeText}>▶</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )
        ) : (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textSecondary }}>Tagged signals soon</Text>
            <Text style={{ fontSize: 13, marginTop: 6, color: colors.textSecondary, textAlign: 'center' }}>
              Mentions & tags will appear in this constellation
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(15,10,31,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadgeText: {
    color: '#fff',
    fontSize: 10,
  },
  multiBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  multiBadgeText: {
    color: '#F5F3FF',
    fontSize: 12,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
});
