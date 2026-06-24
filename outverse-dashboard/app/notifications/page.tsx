'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  EyeIcon,
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

type FilterKey = 'all' | 'reaction' | 'challenge_complete';

const FILTERS: Array<{ key: FilterKey; label: string; matches?: string[] }> = [
  { key: 'all', label: 'All' },
  { key: 'reaction', label: 'Reactions', matches: ['reaction', 'comment', 'follow'] },
  { key: 'challenge_complete', label: 'Challenges', matches: ['challenge_complete'] },
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
  if (kind === 'reaction' || kind === 'comment' || kind === 'follow') return 'reaction';
  return 'other';
}

function getNotificationTitle(notification: AppNotification) {
  const actorName = notification.actor?.username || 'Outverse';
  const kind = notification.type || notification.verb;

  if (kind === 'challenge_complete') {
    if (/invite/i.test(notification.text)) return 'Challenge Invite';
    if (/completed|finished/i.test(notification.text)) return 'Challenge Completed';
    if (/progress|halfway|leading/i.test(notification.text)) return 'Challenge Progress';
    return 'Challenge Update';
  }

  if (kind === 'reaction') return 'New Reaction';
  if (kind === 'comment') return 'Idea Reaction';
  if (kind === 'follow') return `${actorName} followed you`;
  if (/achievement|completed \d+/i.test(notification.text)) return 'Achievement Unlocked';
  return actorName;
}

function getNotificationDescription(notification: AppNotification) {
  const actorName = notification.actor?.username || 'Someone';
  const kind = notification.type || notification.verb;

  if (kind === 'reaction') return `${actorName} ${notification.text}`;
  if (kind === 'comment') return `${actorName} ${notification.text}`;
  if (kind === 'follow') return `${actorName} started following you`;
  return notification.text;
}

function getNotificationIcon(notification: AppNotification) {
  const kind = notification.type || notification.verb;

  if (kind === 'challenge_complete') {
    return {
      shell: 'bg-[#ffd9cf] text-[#a45a3f]',
      icon: <FlagIcon className="h-5 w-5" />,
    };
  }

  if (kind === 'reaction' || kind === 'comment') {
    return {
      shell: 'bg-[#ffd9cf] text-[#a45a3f]',
      icon: <BellIcon className="h-5 w-5" />,
    };
  }

  return {
    shell: 'bg-[#ffd9cf] text-[#a45a3f]',
    icon: <StarIcon className="h-5 w-5" />,
  };
}

function getActionType(notification: AppNotification) {
  const kind = notification.type || notification.verb;
  if (kind === 'challenge_complete' && /invite/i.test(notification.text)) return 'decision';
  if (/achievement|completed \d+/i.test(notification.text)) return 'link';
  if (kind === 'challenge_complete') return 'details';
  return 'view';
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

  const load = useCallback(async (filterKey: string, append = false, url?: string | null) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
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
      }
    } catch {
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load(activeFilter);
  }, [activeFilter, load]);

  const filteredNotifications = useMemo(() => {
    const filter = FILTERS.find((item) => item.key === activeFilter);
    if (!filter || filter.key === 'all' || !filter.matches) return notifications;
    return notifications.filter((notification) =>
      filter.matches?.includes(notification.type || notification.verb),
    );
  }, [activeFilter, notifications]);

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
        acc[filter.key] = notifications.filter((notification) =>
          filter.matches?.includes(notification.type || notification.verb),
        ).length;
        return acc;
      },
      { all: notifications.length, reaction: 0, challenge_complete: 0 },
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
      }
    } catch {
    }
  }

  async function markAllRead() {
    try {
      const res = await apiFetchJson('notifications/read_all/', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
        setUnreadCount(0);
      }
    } catch {
    }
  }

  async function handleClick(notification: AppNotification) {
    await markRead(notification.id);
    if (notification.verb === 'follow' && notification.actor?.id) {
      router.push(`/profile/${notification.actor.id}`);
    } else if (notification.reel) {
      router.push(`/reels/${notification.reel}`);
    } else if (notification.post) {
      router.push(`/post/${notification.post}`);
    }
  }

  async function handleDecision(notification: AppNotification) {
    await handleClick(notification);
  }

  return (
    <div className="min-h-screen bg-[#fff8f5] text-[#2f211d]">
      <header className="border-b border-[#ead7d0] bg-[#fff8f5]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-6 sm:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#241815] sm:text-[2.2rem]">
              {t('notifications.title')}
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#f4e7e1] px-3 py-1 text-sm font-medium text-[#5f4a43]">
                {unreadCount} New
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[#5f4a43]">
            <Link
              href="/settings"
              className="rounded-full p-2 transition hover:bg-[#f4e7e1]"
              aria-label={t('nav.settings')}
            >
              <Cog6ToothIcon className="h-6 w-6" />
            </Link>
            <Link
              href="/profile"
              className="rounded-full p-2 transition hover:bg-[#f4e7e1]"
              aria-label="Profile"
            >
              <BellIcon className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col px-4 py-4 sm:px-8 sm:py-6">
        <div className="mb-4 overflow-x-auto rounded-2xl bg-[#f3efef] p-1">
          <div className="flex min-w-max items-center gap-2">
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2 text-base font-medium transition ${
                    isActive ? 'bg-white text-[#241815] shadow-sm' : 'text-[#6f625d]'
                  }`}
                >
                  <span>{filter.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-sm ${
                      isActive ? 'bg-[#f4f1f1] text-[#241815]' : 'text-[#241815]'
                    }`}
                  >
                    {filterCounts[filter.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#ead7d0] pt-6">
          {loading ? (
            <div className="py-20 text-center text-[#7f6f69]">{t('notifications.loading')}</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-20 text-center text-[#7f6f69]">
              <SparklesIcon className="mx-auto mb-3 h-12 w-12 text-[#c98f7a]" />
              <p>{t('notifications.empty')}</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedNotifications).map(([label, items]) => (
                <section key={label} className="space-y-4">
                  <h2 className="text-2xl font-medium text-[#6f5148] sm:text-xl">{label}</h2>
                  <ul className="space-y-4">
                    {items.map((notification) => {
                      const icon = getNotificationIcon(notification);
                      const actionType = getActionType(notification);
                      const isUnread = !notification.is_read;
                      const isChallenge = getNotificationKind(notification) === 'challenge';

                      return (
                        <li
                          key={notification.id}
                          className={`rounded-[22px] border px-4 py-4 shadow-[0_8px_24px_rgba(164,90,63,0.06)] transition sm:px-6 ${
                            isUnread
                              ? 'border-[#f3d8cf] bg-white'
                              : 'border-[#f1e3dd] bg-white/92'
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
                                <span className="block text-[1.05rem] font-semibold text-[#241815]">
                                  {getNotificationTitle(notification)}
                                </span>
                                <span className="mt-1 block max-w-2xl text-lg leading-8 text-[#6f625d] sm:text-[1.05rem] sm:leading-7">
                                  {getNotificationDescription(notification)}
                                </span>
                                <RelativeTime
                                  date={notification.created_at}
                                  className="mt-3 block text-sm text-[#8f7f79]"
                                />
                              </span>
                            </button>

                            <div className="flex shrink-0 items-center gap-2 self-start">
                              {actionType === 'decision' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleDecision(notification)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#9f5a3f] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#8f4f37]"
                                  >
                                    <CheckIcon className="h-5 w-5" />
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void markRead(notification.id)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-[#f4dfd8] px-5 py-3 text-base font-semibold text-[#5f4a43] transition hover:bg-[#efd4cb]"
                                  >
                                    <XMarkIcon className="h-5 w-5" />
                                    Decline
                                  </button>
                                </>
                              ) : actionType === 'link' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleClick(notification)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#fff4ef] px-5 py-3 text-base font-medium text-[#5f4a43] transition hover:bg-[#f9e7df]"
                                >
                                  <SparklesIcon className="h-5 w-5" />
                                  View Badge
                                </button>
                              ) : actionType === 'details' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleClick(notification)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#f7f3f2] px-5 py-3 text-base font-medium text-[#2f211d] transition hover:bg-[#efe8e6]"
                                >
                                  <EyeIcon className="h-5 w-5" />
                                  View Details
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleClick(notification)}
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#f7f3f2] px-5 py-3 text-base font-medium text-[#2f211d] transition hover:bg-[#efe8e6]"
                                >
                                  <EyeIcon className="h-5 w-5" />
                                  View
                                </button>
                              )}
                              {!isChallenge && actionType !== 'decision' && (
                                <ChevronRightIcon className="hidden h-5 w-5 text-[#9b857d] sm:block" />
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
                  className="w-full rounded-2xl border border-[#ead7d0] bg-white px-4 py-3 text-sm font-semibold text-[#5f4a43] transition hover:bg-[#fdf4f0] disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}

              <div className="border-t border-[#ead7d0] pt-6 text-center text-lg text-[#8f7f79]">
                {filteredNotifications.length > 0
                  ? "You're all caught up! Check back later for new notifications."
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
              className="rounded-xl px-4 py-2 text-sm font-semibold text-[#9f5a3f] transition hover:bg-[#f7e8e1]"
            >
              {t('notifications.markAll')}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}