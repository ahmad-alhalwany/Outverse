'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  StarIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { FlagIcon } from '@heroicons/react/24/solid';
import { apiFetch, apiFetchJson } from '@/lib/api';
import RelativeTime from '@/components/RelativeTime';
import { useLocale } from '@/components/LocaleProvider';

interface AppNotification {
  id: number;
  actor: { id: number; username: string; avatar: string | null } | null;
  verb: string;
  type: string;
  post: number | null;
  reel: number | null;
  story: number | null;
  idea: number | null;
  studio_session: number | null;
  text: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationResponse {
  count: number;
  next: string | null;
  previous: string | null;
  unread_count: number;
  results: AppNotification[];
}

type FilterKey = 'all' | 'reaction' | 'comment' | 'chat_message' | 'story' | 'challenge_complete' | 'ideas';

const FILTERS: Array<{ key: FilterKey; labelKey: string; matches?: string[]; storyOnly?: boolean }> = [
  { key: 'all', labelKey: 'notifications.filterAll' },
  { key: 'reaction', labelKey: 'notifications.filterReactions', matches: ['reaction', 'follow', 'share'] },
  { key: 'comment', labelKey: 'notifications.filterComments', matches: ['comment', 'mention'] },
  { key: 'story', labelKey: 'notifications.filterStories', storyOnly: true },
  { key: 'chat_message', labelKey: 'notifications.filterMessages', matches: ['chat_message'] },
  { key: 'challenge_complete', labelKey: 'notifications.filterChallenges', matches: ['challenge_complete'] },
  {
    key: 'ideas',
    labelKey: 'notifications.filterIdeas',
    matches: ['idea_pledge', 'idea_comment', 'idea_apply', 'idea_accepted', 'idea_rejected'],
  },
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function groupLabel(iso: string, t: (key: string) => string) {
  const now = new Date();
  const date = new Date(iso);
  const diffDays = Math.floor(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000,
  );
  if (diffDays <= 0) return t('common.today');
  if (diffDays === 1) return t('common.yesterday');
  if (diffDays < 7) return t('common.thisWeek');
  return t('common.earlier');
}

function getNotificationKind(notification: AppNotification) {
  const kind = notification.type || notification.verb;
  if (kind === 'challenge_complete') return 'challenge';
  if (kind === 'achievement' || kind === 'achievement_unlocked') return 'achievement';
  if (kind === 'reaction' || kind === 'comment' || kind === 'follow') return 'reaction';
  return 'other';
}

function getAchievementProgress(notification: AppNotification): { current: number; goal: number } | null {
  const match = notification.text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  const goal = Number(match[2]);
  if (!goal) return null;
  return { current: Number(match[1]), goal };
}

function getNotificationTitle(notification: AppNotification, t: (key: string, vars?: Record<string, string>) => string) {
  const actorName = notification.actor?.username || t('notifications.defaultActor');
  const kind = notification.type || notification.verb;

  if (kind === 'challenge_complete') {
    if (/invite/i.test(notification.text)) return t('notifications.titleChallengeInvite');
    if (/completed|finished/i.test(notification.text)) return t('notifications.titleChallengeCompleted');
    if (/progress|halfway|leading/i.test(notification.text)) return t('notifications.titleChallengeProgress');
    return t('notifications.titleChallengeUpdate');
  }

  if (kind === 'reaction') return t('notifications.titleNewReaction');
  if (kind === 'share') return t('notifications.titleSignalShared');
  if (kind === 'comment') return t('notifications.titleNewComment');
  if (kind === 'mention') return t('notifications.titleMention');
  if (kind === 'chat_message') return t('notifications.titleNewMessage');
  if (kind === 'follow') return t('notifications.titleFollowed', { name: actorName });
  if (kind.startsWith('idea_')) return t('notifications.titleIdeaBazaar');
  if (kind === 'studio_invite') return t('notifications.titleStudioInvite');
  if (kind === 'shop' || kind === 'tip' || kind === 'shop_purchase') {
    if (/^tipped you/i.test(notification.text)) return t('notifications.titleTipReceived');
    if (/^sold/i.test(notification.text)) return t('notifications.titleItemSold');
    if (/^you unlocked/i.test(notification.text)) return t('notifications.titlePurchaseConfirmed');
    return t('notifications.titleShopUpdate');
  }
  if (/achievement|completed \d+/i.test(notification.text)) return t('notifications.titleAchievementUnlocked');
  return actorName;
}

function getNotificationDescription(notification: AppNotification, t: (key: string, vars?: Record<string, string>) => string) {
  const actorName = notification.actor?.username || t('notifications.someoneActor');
  const kind = notification.type || notification.verb;

  if (kind === 'reaction') return `${actorName} ${notification.text}`;
  if (kind === 'share') return `${actorName} ${notification.text || t('notifications.descSignalTransmitted')}`;
  if (kind === 'comment') return `${actorName} ${notification.text}`;
  if (kind === 'mention') return `${actorName} ${notification.text}`;
  if (kind === 'chat_message') return `${actorName}: ${notification.text}`;
  if (kind === 'follow') return t('notifications.descFollowedYou', { name: actorName });
  if (kind.startsWith('idea_')) {
    return `${actorName} ${notification.text}`;
  }
  return notification.text;
}

function getNotificationIcon(notification: AppNotification) {
  const kind = notification.type || notification.verb;

  if (kind === 'challenge_complete') {
    return {
      shell: 'bg-[#E9E1FA] text-[#7C3AED]',
      icon: <FlagIcon className="h-5 w-5" />,
    };
  }

  if (kind === 'reaction' || kind === 'comment' || kind === 'share') {
    return {
      shell: 'bg-[#E9E1FA] text-[#7C3AED]',
      icon: <BellIcon className="h-5 w-5" />,
    };
  }

  return {
    shell: 'bg-[#E9E1FA] text-[#7C3AED]',
    icon: <StarIcon className="h-5 w-5" />,
  };
}

function getActionType(notification: AppNotification) {
  const kind = notification.type || notification.verb;
  if (kind === 'challenge_complete' && /invite/i.test(notification.text)) return 'decision';
  if (getNotificationKind(notification) === 'achievement' || /achievement|completed \d+/i.test(notification.text)) return 'link';
  if (kind === 'challenge_complete') return 'details';
  return 'view';
}

function notificationHref(notification: AppNotification): string | null {
  const kind = notification.type || notification.verb;
  if (kind === 'follow' && notification.actor?.id) return `/profile/${notification.actor.id}`;
  if (notification.reel) return `/reels/${notification.reel}`;
  if (notification.story) return `/?story=${notification.story}`;
  if (notification.post) return `/post/${notification.post}`;
  if (notification.idea || kind.startsWith('idea_')) {
    return notification.idea ? `/bazaar/${notification.idea}` : '/bazaar';
  }
  if (kind === 'studio_invite') {
    return notification.studio_session ? `/studio?session=${notification.studio_session}` : '/studio';
  }
  if (kind === 'shop' || kind === 'tip' || kind === 'shop_purchase') {
    return /^you unlocked/i.test(notification.text) ? '/shop/orders' : '/shop/dashboard';
  }
  if (kind.startsWith('forge_')) return '/forge';
  if (getNotificationKind(notification) === 'achievement' || /achievement|completed \d+/i.test(notification.text)) {
    return '/achievements';
  }
  if (kind === 'challenge_complete') return '/lab';
  if (kind === 'chat_message') return '/chat';
  if (kind === 'going_live') return '/live';
  if (kind.includes('video')) return '/videos';
  return null;
}

export default function NotificationsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async (filterKey: string, append = false, url?: string | null) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const endpoint =
        url ||
        `notifications/${filterKey === 'all' ? '' : `?type=${encodeURIComponent(filterKey)}`}`;
      const res = await apiFetch(endpoint);
      if (res.ok) {
        const data = (await res.json()) as NotificationResponse;
        const rows = Array.isArray(data.results) ? data.results : [];
        setNotifications((prev) => (append ? [...prev, ...rows] : rows));
        setUnreadCount(data.unread_count || 0);
        setNextUrl(data.next || null);
      } else if (append) {
        setActionError(t('notifications.loadMoreFailed'));
      } else {
        setLoadError(true);
      }
    } catch {
      if (append) setActionError(t('notifications.loadMoreFailed'));
      else setLoadError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(activeFilter);
  }, [activeFilter, load]);

  useEffect(() => {
    if (!actionError) return;
    const timer = setTimeout(() => setActionError(''), 3500);
    return () => clearTimeout(timer);
  }, [actionError]);

  const filteredNotifications = useMemo(() => {
    const filter = FILTERS.find((item) => item.key === activeFilter);
    let rows = notifications;
    if (filter && filter.key !== 'all') {
      if (filter.storyOnly) {
        rows = rows.filter((notification) => notification.story != null);
      } else if (filter.matches) {
        rows = rows.filter((notification) => filter.matches?.includes(notification.type || notification.verb));
      }
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      rows = rows.filter((notification) =>
        `${getNotificationTitle(notification, t)} ${getNotificationDescription(notification, t)}`
          .toLowerCase()
          .includes(query),
      );
    }
    return rows;
  }, [activeFilter, notifications, searchQuery, t]);

  const groupedNotifications = useMemo(() => {
    return filteredNotifications.reduce<Record<string, AppNotification[]>>((acc, notification) => {
      const label = groupLabel(notification.created_at, t);
      acc[label] = acc[label] || [];
      acc[label].push(notification);
      return acc;
    }, {});
  }, [filteredNotifications, t]);

  const filterCounts = useMemo(() => {
    return FILTERS.reduce<Record<FilterKey, number>>(
      (acc, filter) => {
        if (filter.key === 'all') {
          acc[filter.key] = notifications.length;
          return acc;
        }
        if (filter.storyOnly) {
          acc[filter.key] = notifications.filter((n) => n.story != null).length;
        } else {
          acc[filter.key] = notifications.filter((notification) =>
            filter.matches?.includes(notification.type || notification.verb),
          ).length;
        }
        return acc;
      },
      {
        all: notifications.length,
        reaction: 0,
        comment: 0,
        chat_message: 0,
        story: 0,
        challenge_complete: 0,
        ideas: 0,
      },
    );
  }, [notifications]);

  async function markRead(id: number) {
    const item = notifications.find((notification) => notification.id === id);
    if (!item || item.is_read) return;
    try {
      const res = await apiFetchJson(`notifications/${id}/read/`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === id ? { ...notification, is_read: true } : notification,
          ),
        );
        setUnreadCount(data.unread_count ?? 0);
      } else {
        setActionError(t('notifications.updateFailed'));
      }
    } catch {
      setActionError(t('notifications.updateFailed'));
    }
  }

  async function markAllRead() {
    try {
      const res = await apiFetchJson('notifications/read_all/', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
        setUnreadCount(0);
      } else {
        setActionError(t('notifications.markAllFailed'));
      }
    } catch {
      setActionError(t('notifications.markAllFailed'));
    }
  }

  async function handleClick(notification: AppNotification) {
    await markRead(notification.id);
    const href = notificationHref(notification);
    if (href) router.push(href);
  }

  async function handleDecision(notification: AppNotification) {
    await handleClick(notification);
  }

  return (
    <div className="min-h-screen bg-[#F3F0FC] text-[#211B3D]">
      <header className="border-b border-[#E3D9F7] bg-[#F3F0FC]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#211B3D] sm:text-[2.2rem]">
              {t('notifications.title')}
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#E9E1FA] px-3 py-1 text-sm font-medium text-[#5B21B6]">
                {unreadCount} {t('notifications.newBadge')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[#5B21B6]">
            <Link
              href="/settings"
              className="rounded-full p-2 transition hover:bg-[#E9E1FA]"
              aria-label={t('nav.settings')}
            >
              <Cog6ToothIcon className="h-6 w-6" />
            </Link>
            <Link
              href="/profile"
              className="rounded-full p-2 transition hover:bg-[#E9E1FA]"
              aria-label={t('notifications.profileLink')}
            >
              <BellIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col px-4 py-4 sm:px-8 sm:py-6">
        {actionError && (
          <div className="mb-4 rounded-xl bg-red-100 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {actionError}
          </div>
        )}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9691B8]" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('notifications.searchPlaceholder')}
            className="w-full rounded-2xl border border-[#E3D9F7] bg-white py-3 pl-11 pr-4 text-base text-[#211B3D] outline-none placeholder:text-[#9691B8]"
          />
        </div>

        <div className="mb-4 overflow-x-auto rounded-2xl bg-[#F5F1FE] p-1">
          <div className="flex min-w-max items-center gap-2">
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2 text-base font-medium transition ${
                    isActive ? 'bg-white text-[#211B3D] shadow-sm' : 'text-[#79709E]'
                  }`}
                >
                  <span>{t(filter.labelKey)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm ${
                      isActive ? 'bg-[#FFFFFF] text-[#211B3D]' : 'text-[#211B3D]'
                    }`}
                  >
                    {filterCounts[filter.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#E3D9F7] pt-6">
          {loading ? (
            <ul className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="rounded-[22px] border border-[#E3D9F7] bg-white px-4 py-4 sm:px-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 shrink-0 rounded-2xl skeleton-pulse" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded skeleton-pulse" />
                      <div className="h-3 w-2/3 rounded skeleton-pulse" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : loadError ? (
            <div className="py-20 text-center text-[#79709E]">
              <ExclamationTriangleIcon className="mx-auto mb-3 h-12 w-12 text-[#C4B5FD]" />
              <p>{t('notifications.loadError')}</p>
              <button
                type="button"
                onClick={() => void load(activeFilter)}
                className="mt-4 rounded-xl bg-[#EDE4FB] px-5 py-2.5 text-sm font-semibold text-[#5B21B6] transition hover:bg-[#DCC9FA]"
              >
                {t('notifications.retry')}
              </button>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-20 text-center text-[#79709E]">
              <SparklesIcon className="mx-auto mb-3 h-12 w-12 text-[#C4B5FD]" />
              <p>{t('notifications.empty')}</p>
              <button
                type="button"
                onClick={() => router.push('/search')}
                className="mt-4 rounded-xl bg-[#EDE4FB] px-5 py-2.5 text-sm font-semibold text-[#5B21B6] transition hover:bg-[#DCC9FA]"
              >
                {t('notifications.emptyCta')}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedNotifications).map(([label, items]) => (
                <section key={label} className="space-y-4">
                  <h2 className="text-2xl font-medium text-[#79709E] sm:text-xl">{label}</h2>
                  <ul className="space-y-4">
                    {items.map((notification) => {
                      const icon = getNotificationIcon(notification);
                      const actionType = getActionType(notification);
                      const isUnread = !notification.is_read;
                      const isChallenge = getNotificationKind(notification) === 'challenge';
                      const achievementProgress =
                        getNotificationKind(notification) === 'achievement'
                          ? getAchievementProgress(notification)
                          : null;

                      return (
                        <li
                          key={notification.id}
                          className={`rounded-[22px] border px-4 py-4 shadow-[0_8px_24px_rgba(124,58,237,0.08)] transition sm:px-6 ${
                            isUnread
                              ? 'border-[#DCC9FA] bg-white'
                              : 'border-[#E3D9F7] bg-white/92'
                          }`}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <button
                              type="button"
                              onClick={() => void handleClick(notification)}
                              className="flex flex-1 items-start gap-4 text-left"
                            >
                              <span
                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${icon.shell}`}
                              >
                                {icon.icon}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[1.05rem] font-semibold text-[#211B3D]">
                                  {getNotificationTitle(notification, t)}
                                </span>
                                <span className="mt-1 block max-w-2xl text-lg leading-8 text-[#79709E] sm:text-[1.05rem] sm:leading-7">
                                  {getNotificationDescription(notification, t)}
                                </span>
                                {achievementProgress && (
                                  <span className="mt-3 block max-w-xs">
                                    <span className="block h-2 overflow-hidden rounded-full bg-[#E9E1FA]">
                                      <span
                                        className="block h-full rounded-full bg-[#7C3AED]"
                                        style={{
                                          width: `${Math.min(100, Math.round((achievementProgress.current / achievementProgress.goal) * 100))}%`,
                                        }}
                                      />
                                    </span>
                                    <span className="mt-1 block text-xs text-[#79709E]">
                                      {achievementProgress.current}/{achievementProgress.goal}
                                    </span>
                                  </span>
                                )}
                                <RelativeTime
                                  date={notification.created_at}
                                  className="mt-3 block text-sm text-[#79709E]"
                                />
                              </span>
                            </button>

                            <div className="flex shrink-0 items-center gap-2 self-start">
                              {actionType === 'decision' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleDecision(notification)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#5B21B6]"
                                  >
                                    <CheckIcon className="h-5 w-5" />
                                    {t('notifications.accept')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void markRead(notification.id)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#EDE4FB] px-5 py-3 text-base font-semibold text-[#5B21B6] transition hover:bg-[#DCC9FA]"
                                  >
                                    <XMarkIcon className="h-5 w-5" />
                                    {t('notifications.decline')}
                                  </button>
                                </>
                              ) : actionType === 'link' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleClick(notification)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#F5F1FE] px-5 py-3 text-base font-medium text-[#5B21B6] transition hover:bg-[#EDE4FB]"
                                >
                                  <SparklesIcon className="h-5 w-5" />
                                  {t('notifications.viewBadge')}
                                </button>
                              ) : actionType === 'details' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleClick(notification)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#F5F1FE] px-5 py-3 text-base font-medium text-[#211B3D] transition hover:bg-[#EDE4FB]"
                                >
                                  <EyeIcon className="h-5 w-5" />
                                  {t('notifications.viewDetails')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleClick(notification)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#F5F1FE] px-5 py-3 text-base font-medium text-[#211B3D] transition hover:bg-[#EDE4FB]"
                                >
                                  <EyeIcon className="h-5 w-5" />
                                  {t('notifications.view')}
                                </button>
                              )}
                              {!isChallenge && actionType !== 'decision' && (
                                <ChevronRightIcon className="hidden h-5 w-5 text-[#9691B8] sm:block" />
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}

              {nextUrl && (
                <button
                  type="button"
                  onClick={() => void load(activeFilter, true, nextUrl)}
                  disabled={loadingMore}
                  className="w-full rounded-2xl border border-[#E3D9F7] bg-white px-4 py-3 text-sm font-semibold text-[#5B21B6] transition hover:bg-[#F5F1FE] disabled:opacity-60"
                >
                  {loadingMore ? t('notifications.loadingMore') : t('notifications.loadMore')}
                </button>
              )}

              <div className="border-t border-[#E3D9F7] pt-6 text-center text-lg text-[#79709E]">
                {filteredNotifications.length > 0
                  ? t('notifications.allCaughtUp')
                  : t('notifications.empty')}
              </div>
            </div>
          )}
        </div>

        {unreadCount > 0 && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[#7C3AED] transition hover:bg-[#EDE4FB]"
            >
              {t('notifications.markAll')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}