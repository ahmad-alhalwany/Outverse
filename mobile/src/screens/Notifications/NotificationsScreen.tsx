import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { api } from '@/api/client';
import { Notification } from '@/types';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { openProfile } from '@/lib/nav';

type FilterKey = 'all' | 'reactions' | 'comments' | 'stories' | 'messages' | 'challenges' | 'ideas';
type ListRow =
  | { kind: 'section'; key: string; label: string }
  | { kind: 'item'; key: string; item: Notification };

const FILTERS: Array<{ key: FilterKey; labelKey: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'all', labelKey: 'notifications.filterAll', icon: 'apps-outline' },
  { key: 'reactions', labelKey: 'notifications.filterReactions', icon: 'heart-outline' },
  { key: 'comments', labelKey: 'notifications.filterComments', icon: 'chatbubbles-outline' },
  { key: 'stories', labelKey: 'notifications.filterStories', icon: 'book-outline' },
  { key: 'messages', labelKey: 'notifications.filterMessages', icon: 'mail-outline' },
  { key: 'challenges', labelKey: 'notifications.filterChallenges', icon: 'flame-outline' },
  { key: 'ideas', labelKey: 'notifications.filterIdeas', icon: 'bulb-outline' },
];

function asRecord(notification: Notification) {
  return notification as Notification & Record<string, unknown>;
}

function notificationBucket(notification: Notification): string {
  const n = asRecord(notification);
  return `${n.type || ''} ${n.verb || ''} ${n.target_type || ''} ${n.text || ''}`.toLowerCase();
}

function matchesFilter(notification: Notification, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  const haystack = notificationBucket(notification);
  if (filter === 'reactions') return /like|reaction|follow|share/.test(haystack);
  if (filter === 'comments') return /comment|mention|tag/.test(haystack);
  if (filter === 'stories') return /story|highlight/.test(haystack);
  if (filter === 'messages') return /message|chat|dm/.test(haystack);
  if (filter === 'challenges') return /challenge/.test(haystack);
  return /idea|bazaar/.test(haystack);
}

function targetId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'object' && value && 'id' in value) {
    const id = (value as { id?: string | number }).id;
    return id == null ? undefined : id;
  }
  return value as string | number;
}

function openNotificationTarget(navigation: any, notification: Notification) {
  const n = asRecord(notification);
  const kind = String(n.type || n.verb || '').toLowerCase();
  const postId = targetId(n.post);
  const reelId = targetId(n.reel);
  const storyId = targetId(n.story);
  const ideaId = targetId(n.idea);
  const sessionId = targetId(n.studio_session);
  const actorUsername = notification.actor?.username;

  if (reelId) {
    navigation.navigate('Reels', { focusId: reelId });
    return;
  }
  if (postId) {
    navigation.navigate('PostDetail', { postId });
    return;
  }
  if (storyId) {
    navigation.navigate('StoryMap', { storyId });
    return;
  }
  if (ideaId) {
    navigation.navigate('BazaarDetail', { ideaId });
    return;
  }
  if (sessionId) {
    navigation.navigate('StudioSession', { sessionId });
    return;
  }
  if (kind === 'follow' && actorUsername) {
    openProfile(navigation, actorUsername);
    return;
  }
  if (kind.includes('chat') || kind.includes('message')) {
    navigation.navigate('Chat');
    return;
  }
  if (kind.includes('challenge')) {
    navigation.navigate('Lab');
    return;
  }
  if (kind.startsWith('forge_')) {
    navigation.navigate('Forge');
    return;
  }
  if (kind.includes('shop') || kind === 'tip' || kind.includes('purchase')) {
    navigation.navigate('Shop');
    return;
  }
  if (kind.includes('live')) {
    navigation.navigate('Live');
    return;
  }
  if (kind.includes('achievement')) {
    navigation.navigate('Achievements');
    return;
  }
  if (kind.includes('video')) {
    navigation.navigate('Videos');
    return;
  }
  if (kind.includes('community')) {
    navigation.navigate('Communities');
    return;
  }
  if (actorUsername) {
    openProfile(navigation, actorUsername);
    return;
  }
  navigation.navigate('Search');
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function groupLabel(iso: string, t: (key: string) => string) {
  const now = new Date();
  const date = new Date(iso);
  const diffDays = Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);
  if (diffDays <= 0) return t('common.today');
  if (diffDays === 1) return t('common.yesterday');
  if (diffDays < 7) return t('common.thisWeek');
  return t('common.earlier');
}

function formatTime(dateString: string, locale: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return locale === 'ar' ? 'الآن' : 'Just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US', { month: 'short', day: 'numeric' });
}

function iconFor(notification: Notification): keyof typeof Ionicons.glyphMap {
  const kind = String(asRecord(notification).type || asRecord(notification).verb || '').toLowerCase();
  if (kind.includes('like') || kind.includes('reaction')) return 'heart';
  if (kind.includes('comment')) return 'chatbubbles';
  if (kind.includes('follow')) return 'person-add';
  if (kind.includes('mention')) return 'at';
  if (kind.includes('repost') || kind.includes('share')) return 'repeat';
  if (kind.includes('message') || kind.includes('chat')) return 'mail';
  if (kind.includes('challenge')) return 'flag';
  if (kind.includes('idea')) return 'bulb';
  if (kind.includes('story')) return 'book';
  if (kind.includes('shop') || kind.includes('tip')) return 'cart';
  if (kind.includes('live')) return 'radio';
  return 'notifications';
}

function titleFor(
  notification: Notification,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const n = asRecord(notification);
  const actorName = notification.actor?.display_name || notification.actor?.username || t('notifications.defaultActor');
  const kind = String(n.type || n.verb || '').toLowerCase();
  const text = String(n.text || '');

  if (kind.includes('challenge')) {
    if (/invite/i.test(text)) return t('notifications.titleChallengeInvite');
    if (/completed|finished/i.test(text)) return t('notifications.titleChallengeCompleted');
    if (/progress|halfway|leading/i.test(text)) return t('notifications.titleChallengeProgress');
    return t('notifications.titleChallengeUpdate');
  }
  if (kind.includes('reaction') || kind.includes('like')) return t('notifications.titleNewReaction');
  if (kind.includes('share') || kind.includes('repost')) return t('notifications.titleSignalShared');
  if (kind.includes('comment')) return t('notifications.titleNewComment');
  if (kind.includes('mention')) return t('notifications.titleMention');
  if (kind.includes('message') || kind.includes('chat')) return t('notifications.titleNewMessage');
  if (kind.includes('follow')) return t('notifications.titleFollowed', { name: actorName });
  if (kind.includes('idea')) return t('notifications.titleIdeaBazaar');
  if (kind.includes('studio')) return t('notifications.titleStudioInvite');
  if (kind.includes('shop') || kind.includes('tip')) return t('notifications.titleShopUpdate');
  if (/achievement/i.test(text) || kind.includes('achievement')) return t('notifications.titleAchievementUnlocked');
  return String(n.verb || actorName);
}

function bodyFor(
  notification: Notification,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const n = asRecord(notification);
  const actorName = notification.actor?.display_name || notification.actor?.username || t('notifications.someoneActor');
  const kind = String(n.type || n.verb || '').toLowerCase();
  const text = String(n.text || notification.target_text || '').trim();
  if (kind.includes('follow')) return t('notifications.descFollowedYou', { name: actorName });
  if (text) return kind.includes('reaction') || kind.includes('comment') || kind.includes('mention') || kind.includes('idea')
    ? `${actorName} ${text}`
    : text;
  return notification.target_text || '';
}

function asNotificationList(response: unknown): Notification[] {
  if (Array.isArray(response)) return response as Notification[];
  if (response && typeof response === 'object' && Array.isArray((response as { results?: Notification[] }).results)) {
    return (response as { results: Notification[] }).results;
  }
  return [];
}

export default function NotificationsScreen({ navigation }: any) {
  const { colors, isDark } = useTheme();
  const { t, isRTL, locale } = useLocale();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');

  const fetchNotifications = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      if (!isRefresh && pageNum === 1) setError(false);
      const response = await api.getNotifications({ page: pageNum, unread_only: false });
      const next = asNotificationList(response);
      setNotifications((prev) => (isRefresh || pageNum === 1 ? next : [...prev, ...next]));
      setHasMore(Boolean((response as { has_more?: boolean; next?: string })?.has_more || (response as { next?: string })?.next));
      setPage(pageNum);
    } catch {
      if (pageNum === 1) setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications(1);
  }, [fetchNotifications]);

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.is_read) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
      void api.markNotificationRead(notification.id).catch(() => {
        setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: false } : n)));
      });
    }
    openNotificationTarget(navigation, notification);
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* ignore */
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filtered = notifications.filter((notification) => matchesFilter(notification, filter));
  const rows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    let last = '';
    filtered.forEach((item) => {
      const label = groupLabel(item.created_at, t);
      if (label !== last) {
        out.push({ kind: 'section', key: `section-${label}`, label });
        last = label;
      }
      out.push({ kind: 'item', key: `item-${item.id}`, item });
    });
    return out;
  }, [filtered, t]);

  return (
    <WorldBackdrop>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WorldHeader
          title={t('notifications.title')}
          subtitle={t('notifications.subtitle')}
          onBack={() => navigation.goBack()}
          right={
            unreadCount > 0 ? (
              <Pressable
                onPress={() => void handleMarkAllRead()}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('notifications.markAll')}
                style={styles.markAllHit}
              >
                <Ionicons name="checkmark-done-outline" size={20} color={colors.primary} />
              </Pressable>
            ) : null
          }
        />

        {unreadCount > 0 ? (
          <Pressable onPress={() => void handleMarkAllRead()} style={styles.markAllRow}>
            <Text style={[styles.markAllText, { color: colors.primary, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('notifications.markAll')} · {unreadCount}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.tabsWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.tabs, isRTL && { flexDirection: 'row-reverse' }]}
          >
            {FILTERS.map((item) => {
              const active = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setFilter(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.tab,
                    {
                      backgroundColor: active
                        ? isDark
                          ? 'rgba(196,181,253,0.18)'
                          : 'rgba(124,58,237,0.12)'
                        : isDark
                          ? 'rgba(255,255,255,0.04)'
                          : '#FFFFFF',
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons name={item.icon} size={14} color={active ? colors.primary : colors.textSecondary} />
                  <Text style={{ color: active ? colors.primary : colors.text, fontWeight: '700', fontSize: 13 }}>
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {loading && notifications.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{t('notifications.loading')}</Text>
          </View>
        ) : error && notifications.length === 0 ? (
          <View style={styles.center}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.10)' }]}>
              <Ionicons name="cloud-offline-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notifications.loadError')}</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                void fetchNotifications(1, true);
              }}
              style={[styles.cta, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.ctaText}>{t('notifications.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            style={styles.flex}
            data={rows}
            keyExtractor={(row) => row.key}
            contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  void fetchNotifications(1, true);
                }}
                colors={[colors.primary]}
                tintColor={colors.primary}
                progressBackgroundColor={colors.surface}
              />
            }
            onEndReached={() => {
              if (!loading && hasMore) void fetchNotifications(page + 1);
            }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={styles.center}>
                <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.10)' }]}>
                  <Ionicons name="notifications-outline" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('notifications.empty')}</Text>
                <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>{t('notifications.allCaughtUp')}</Text>
                <Pressable
                  onPress={() => navigation.navigate('Search')}
                  style={[styles.cta, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.ctaText}>{t('notifications.emptyCta')}</Text>
                </Pressable>
              </View>
            }
            ListFooterComponent={
              hasMore && filtered.length > 0 ? (
                <View style={styles.footer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            renderItem={({ item: row }) => {
              if (row.kind === 'section') {
                return (
                  <Text style={[styles.section, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
                    {row.label}
                  </Text>
                );
              }
              const item = row.item;
              const unread = !item.is_read;
              const body = bodyFor(item, t);
              return (
                <Pressable
                  onPress={() => void handleNotificationPress(item)}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      backgroundColor: isDark ? 'rgba(26,22,48,0.88)' : '#FFFFFF',
                      borderColor: unread ? colors.primary : colors.border,
                      opacity: pressed ? 0.88 : 1,
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: unread
                          ? isDark
                            ? 'rgba(196,181,253,0.18)'
                            : 'rgba(124,58,237,0.12)'
                          : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(124,58,237,0.06)',
                      },
                    ]}
                  >
                    <Ionicons name={iconFor(item)} size={18} color={unread ? colors.primary : colors.icon} />
                  </View>
                  <View style={styles.body}>
                    <View style={[styles.titleRow, isRTL && { flexDirection: 'row-reverse' }]}>
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {titleFor(item, t)}
                      </Text>
                      {unread ? (
                        <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.newBadgeText}>{t('notifications.newBadge')}</Text>
                        </View>
                      ) : null}
                    </View>
                    {body ? (
                      <Text style={[styles.desc, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
                        {body}
                      </Text>
                    ) : null}
                    <Text style={[styles.time, { color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>
                      {formatTime(item.created_at, locale)}
                    </Text>
                  </View>
                  <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textMuted} />
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  markAllHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  markAllRow: { paddingHorizontal: 20, paddingBottom: 4 },
  markAllText: { fontSize: 13, fontWeight: '700' },
  tabsWrap: { height: 48, marginBottom: 8 },
  tabs: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
  },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  emptyList: { flexGrow: 1, paddingHorizontal: 16 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700' },
  desc: { fontSize: 13, lineHeight: 19 },
  time: { fontSize: 12, fontWeight: '600' },
  newBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  emptyHint: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 320, marginTop: 6 },
  cta: {
    marginTop: 16,
    paddingHorizontal: 18,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700' },
  footer: { paddingVertical: 18, alignItems: 'center' },
});
