'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { type AuthUser, getToken, getUser, isAuthenticated, logout, refreshSession } from '@/lib/auth';
import { apiFetch, apiFetchJson, apiUrl, mediaUrl } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import RelativeTime from '@/components/RelativeTime';
import { 
  HomeIcon,
  BeakerIcon, 
  ShoppingBagIcon, 
  ArchiveBoxIcon,
  BookOpenIcon,
  ShoppingCartIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  LightBulbIcon,
  PlayIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useRef } from 'react';
import { useLocale } from '@/components/LocaleProvider';
import { useLiveNotifications, type LiveNotification } from '@/hooks/useLiveNotifications';

type TabId = 'home' | 'lab' | 'bazaar' | 'vault' | 'story' | 'shop';

interface Tab {
  id: TabId;
  name: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  color: string;
}

const NOTIFICATIONS_API = apiUrl('notifications/');
const SEARCH_API = apiUrl('search/');

interface SearchResults {
  users: { id: number; username: string; name: string; avatar: string | null }[];
  posts: { id: number; snippet: string; author: string }[];
  reels: { id: number; caption: string; author: string; tags: string[] }[];
  ideas: { id: number; title: string; description: string; owner: string }[];
  stories: { id: number; title: string; description: string; owner: string }[];
  bottles: { id: number; message: string; emotion_type: string; sender: string }[];
  shop: { id: number; name: string; description: string; creator: string; price: number }[];
}

interface AppNotification {
  id: number;
  actor: { id: number; username: string; avatar: string | null };
  verb: 'reaction' | 'comment' | 'follow' | string;
  post: number | null;
  reel: number | null;
  story?: number | null;
  idea?: number | null;
  studio_session?: number | null;
  text: string;
  is_read: boolean;
  created_at: string;
}

const verbIcon: Record<string, string> = {
  reaction: '⭐',
  comment: '💬',
  follow: '➕',
};

const TAB_ROUTES: Record<TabId, string> = {
  home: '/',
  lab: '/lab',
  bazaar: '/bazaar',
  vault: '/vault',
  story: '/forge',
  shop: '/shop',
};

function notificationHref(n: AppNotification): string | null {
  const kind = n.verb;
  if (kind === 'follow' && n.actor?.id) return `/profile/${n.actor.id}`;
  if (n.reel) return `/reels/${n.reel}`;
  if (n.post) return `/post/${n.post}`;
  if (n.story) return `/?story=${n.story}`;
  if (n.idea || kind.startsWith('idea_')) return n.idea ? `/bazaar/${n.idea}` : '/bazaar';
  if (kind === 'studio_invite') return n.studio_session ? `/studio?session=${n.studio_session}` : '/studio';
  if (kind === 'chat_message') return '/chat';
  if (kind === 'going_live') return '/live';
  if (kind.includes('video')) return '/videos';
  return null;
}

function tabFromPath(pathname: string): TabId {
  if (pathname.startsWith('/lab')) return 'lab';
  if (pathname.startsWith('/bazaar')) return 'bazaar';
  if (pathname.startsWith('/vault') || pathname.startsWith('/bottles') || pathname.startsWith('/capsules')) return 'vault';
  if (pathname.startsWith('/forge')) return 'story';
  if (pathname.startsWith('/shop')) return 'shop';
  return 'home';
}

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromPath(pathname));
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>({
    users: [],
    posts: [],
    reels: [],
    ideas: [],
    stories: [],
    bottles: [],
    shop: [],
  });
  const [showSearch, setShowSearch] = useState(false);
  const [notifActionError, setNotifActionError] = useState('');
  const notifRef = useRef<HTMLButtonElement>(null);
  const notifPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNotifications) return;
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (notifRef.current?.contains(target) || notifPanelRef.current?.contains(target)) return;
      setShowNotifications(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults({ users: [], posts: [], reels: [], ideas: [], stories: [], bottles: [], shop: [] });
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(query)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  function goToSearchResult(path: string) {
    setShowSearch(false);
    setSearchQuery('');
    router.push(path);
  }

  const totalSearchResults =
    searchResults.users.length +
    searchResults.posts.length +
    searchResults.reels.length +
    searchResults.ideas.length +
    searchResults.stories.length +
    searchResults.bottles.length +
    searchResults.shop.length;

  const fetchNotifications = async (silent = true) => {
    if (!isAuthenticated() && !getUser()) return;
    try {
      const res = await apiFetch('notifications/');
      if (res.status === 401) return;
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data.results) ? data.results : []);
        setUnreadCount(data.unread_count || 0);
        if (!silent) setNotifActionError('');
      } else if (!silent) {
        setNotifActionError('Could not refresh notifications.');
      }
    } catch {
      if (!silent) setNotifActionError('Could not refresh notifications.');
    }
  };

  useEffect(() => {
    setActiveTab(tabFromPath(pathname));
  }, [pathname]);

  useEffect(() => {
    if (!notifActionError) return;
    const timer = setTimeout(() => setNotifActionError(''), 3500);
    return () => clearTimeout(timer);
  }, [notifActionError]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      // Migrates legacy outverse_* keys → cosmory_* before reading.
      const cached = getUser();
      if (cached && getToken()) setUser(cached);
      if (!isAuthenticated()) return;
      const u = await refreshSession();
      if (cancelled) return;
      setUser(u ?? getUser());
      if (u || getUser()) {
        await fetchNotifications();
      }
    };
    void boot();
    const interval = setInterval(() => {
      if (isAuthenticated()) void fetchNotifications();
    }, 120000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useLiveNotifications({
    enabled: !!user,
    onNotification: (payload) => {
      const actor = payload.actor;
      const row: AppNotification = {
        id: payload.id,
        verb: payload.verb,
        text: payload.text,
        post: payload.post ?? null,
        reel: payload.reel ?? null,
        story: payload.story ?? null,
        idea: payload.idea ?? null,
        is_read: false,
        created_at: payload.created_at || new Date().toISOString(),
        actor: actor
          ? { id: actor.id, username: actor.username, avatar: actor.avatar ?? null }
          : { id: payload.actor_id ?? 0, username: 'User', avatar: null },
      };
      setNotifications((prev) => {
        if (prev.some((n) => n.id === row.id)) return prev;
        return [row, ...prev].slice(0, 20);
      });
      setUnreadCount((c) => c + 1);
    },
  });

  function navigateTab(tabId: TabId) {
    setActiveTab(tabId);
    router.push(TAB_ROUTES[tabId]);
  }

  async function handleMarkAllRead() {
    try {
      const res = await apiFetchJson('notifications/read_all/', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        setNotifActionError('');
      } else {
        setNotifActionError('Could not mark all as read.');
      }
    } catch {
      setNotifActionError('Could not mark all as read.');
    }
  }

  function toggleNotifications() {
    setShowNotifications((v) => {
      if (!v) void fetchNotifications(false);
      return !v;
    });
  }

  async function markNotificationRead(id: number) {
    if (!notifications.find((x) => x.id === id)?.is_read) {
      try {
        const res = await apiFetchJson(`notifications/${id}/read/`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setNotifications((prev) =>
            prev.map((x) => (x.id === id ? { ...x, is_read: true } : x)),
          );
          setUnreadCount(data.unread_count ?? 0);
          setNotifActionError('');
        } else {
          setNotifActionError('Could not update notification.');
        }
      } catch {
        setNotifActionError('Could not update notification.');
      }
    }
  }

  async function handleNotificationClick(n: AppNotification) {
    await markNotificationRead(n.id);
    setShowNotifications(false);
    const href = notificationHref(n);
    if (href) router.push(href);
  }

  async function handleLogout() {
    await logout();
    setUser(null);
    setShowAccount(false);
    router.push('/login');
  }
  // حركة دوران للنجوم حول الشارة
  const OrbitStars = () => (
    <span className="absolute -top-2 -right-2 w-8 h-8 pointer-events-none animate-spin-slow">
      <span className="absolute left-0 top-1 w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-lg"></span>
      <span className="absolute right-0 bottom-1 w-1 h-1 bg-pink-400 rounded-full shadow"></span>
      <span className="absolute left-2 top-0 w-1 h-1 bg-blue-400 rounded-full shadow"></span>
    </span>
  );

  const tabs: Tab[] = [
    { id: 'home', name: 'Home', icon: HomeIcon, color: 'text' },
    { id: 'lab', name: 'Lab', icon: BeakerIcon, color: 'lab' },
    { id: 'bazaar', name: 'Bazaar', icon: ShoppingBagIcon, color: 'bazaar' },
    { id: 'vault', name: 'Vault', icon: ArchiveBoxIcon, color: 'vault' },
    { id: 'story', name: 'Story', icon: BookOpenIcon, color: 'story' },
    { id: 'shop', name: 'Shop', icon: ShoppingCartIcon, color: 'shop' },
  ];

  const tabColors: Record<TabId, string> = {
    home: 'text-text',
    lab: 'text-lab',
    bazaar: 'text-bazaar',
    vault: 'text-vault',
    story: 'text-story',
    shop: 'text-shop',
  };

  const tabBgColors: Record<TabId, string> = {
    home: 'bg-text',
    lab: 'bg-lab',
    bazaar: 'bg-bazaar',
    vault: 'bg-vault',
    story: 'bg-story',
    shop: 'bg-shop',
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <div className="mx-auto max-w-7xl">
        <div className="flex h-16 items-center justify-between rounded-[28px] bg-background/78 px-3 shadow-[0_18px_50px_rgba(6,3,24,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/[0.06] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/68 sm:px-5">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-text hover:opacity-90 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cosmory-icon.svg" alt="Cosmory" width={36} height={36} className="h-9 w-9 rounded-xl shadow-[0_0_20px_rgba(124,58,237,0.35)]" />
              <span className="bg-gradient-to-r from-white via-violet-100 to-sky-200 bg-clip-text text-transparent">Cosmory</span>
            </Link>
          </div>

          {/* Navigation Tabs — soft glass, no hard white outline */}
          <nav
            className="hidden lg:flex items-center gap-0.5 rounded-full bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
            aria-label={t('nav.mainNavigation')}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigateTab(tab.id)}
                  aria-label={tab.name}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 transition-all duration-200
                    ${isActive
                      ? `${tabColors[tab.id]} shadow-[0_8px_22px_rgba(17,12,42,0.28)]`
                      : 'text-text-secondary hover:bg-white/[0.06] hover:text-text'}
                  `}
                  style={isActive ? { fontWeight: 700 } : {}}
                >
                  <motion.span
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center"
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2 : 1.75} />
                  </motion.span>
                  <span className="hidden md:inline-block text-sm">{tab.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className={`absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full ${tabBgColors[tab.id]} opacity-90`}
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Side Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Search the cosmos…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) goToSearchResult(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                }}
                className="cosmic-input w-44 rounded-full !border-transparent bg-white/[0.06] !py-2 !pl-10 !pr-8 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:w-64 focus:!border-violet-400/40"
              />
              <MagnifyingGlassIcon className="h-4 w-4 text-text-secondary absolute left-3.5 top-1/2 transform -translate-y-1/2" strokeWidth={1.75} />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
                >
                  <XMarkIcon className="h-4 w-4" strokeWidth={2} />
                </button>
              )}
              {showSearch && searchQuery.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-14 z-50 max-h-[28rem] w-80 overflow-y-auto rounded-[22px] border border-white/10 bg-background/95 shadow-2xl backdrop-blur-2xl"
                >
                  {totalSearchResults === 0 ? (
                    <div className="px-4 py-6 text-center text-text-secondary text-sm">No results found.</div>
                  ) : (
                    <>
                      {searchResults.users.length > 0 && (
                        <div className="py-2">
                          <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">Creators</div>
                          {searchResults.users.slice(0, 3).map((u) => (
                            <button
                              key={`u-${u.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => goToSearchResult(`/profile/${u.id}`)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface transition-colors text-left"
                            >
                              {u.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full object-cover shrink-0" />
                              ) : (
                                <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-vault to-bazaar text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                                  {u.username.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block text-sm text-text font-medium truncate">{u.name}</span>
                                <span className="block text-xs text-text-secondary truncate">@{u.username}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {[
                        {
                          key: 'posts',
                          label: 'Posts',
                          icon: BookOpenIcon,
                          color: 'from-lab to-bazaar',
                          items: searchResults.posts.map((p) => ({
                            id: p.id,
                            primary: p.snippet || 'Untitled',
                            secondary: `@${p.author}`,
                            path: `/post/${p.id}`,
                          })),
                        },
                        {
                          key: 'reels',
                          label: 'Signals',
                          icon: PlayIcon,
                          color: 'from-vault to-story',
                          items: searchResults.reels.map((r) => ({
                            id: r.id,
                            primary: r.caption || 'Cosmic signal',
                            secondary: `@${r.author}`,
                            path: `/reels?id=${r.id}`,
                          })),
                        },
                        {
                          key: 'ideas',
                          label: 'Ideas',
                          icon: LightBulbIcon,
                          color: 'from-bazaar to-vault',
                          items: searchResults.ideas.map((i) => ({
                            id: i.id,
                            primary: i.title,
                            secondary: `@${i.owner}`,
                            path: `/bazaar/${i.id}`,
                          })),
                        },
                        {
                          key: 'stories',
                          label: 'Stories',
                          icon: BookOpenIcon,
                          color: 'from-story to-lab',
                          items: searchResults.stories.map((s) => ({
                            id: s.id,
                            primary: s.title,
                            secondary: `@${s.owner}`,
                            path: `/forge?story=${s.id}`,
                          })),
                        },
                        {
                          key: 'bottles',
                          label: 'Vault',
                          icon: ArchiveBoxIcon,
                          color: 'from-vault to-bazaar',
                          items: searchResults.bottles.map((b) => ({
                            id: b.id,
                            primary: b.message,
                            secondary: b.emotion_type,
                            path: `/bottles`,
                          })),
                        },
                        {
                          key: 'shop',
                          label: 'Shop',
                          icon: ShoppingCartIcon,
                          color: 'from-bazaar to-shop',
                          items: searchResults.shop.map((s) => ({
                            id: s.id,
                            primary: s.name,
                            secondary: `${s.price} ✨ · @${s.creator}`,
                            path: `/shop/${s.id}`,
                          })),
                        },
                      ].map(
                        (section) =>
                          section.items.length > 0 && (
                            <div key={section.key} className="py-2 border-t border-surface">
                              <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">{section.label}</div>
                              {section.items.slice(0, 3).map((item) => (
                                <button
                                  key={`${section.key}-${item.id}`}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => goToSearchResult(item.path)}
                                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface transition-colors text-left"
                                >
                                  <span className={`w-8 h-8 rounded-full bg-gradient-to-tr ${section.color} text-white flex items-center justify-center shrink-0`}>
                                    <section.icon className="h-4 w-4" strokeWidth={1.8} />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm text-text truncate">{item.primary}</span>
                                    <span className="block text-xs text-text-secondary truncate">{item.secondary}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ),
                      )}
                      <div className="border-t border-surface px-4 py-3">
                        <Link
                          href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setShowSearch(false);
                            setSearchQuery('');
                          }}
                          className="text-sm font-semibold text-vault hover:underline"
                        >
                          See all {totalSearchResults} results →
                        </Link>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </div>

            <div className="flex items-center gap-0.5 rounded-full bg-white/[0.04] p-0.5 sm:gap-1 sm:p-1">
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={toggleTheme}
              className="icon-only !border-transparent p-2 hover:!bg-white/[0.08]"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <SunIcon className="h-5 w-5" strokeWidth={1.75} />
              ) : (
                <MoonIcon className="h-5 w-5" strokeWidth={1.75} />
              )}
            </motion.button>

            <div className="relative flex items-center justify-center">
              <motion.button
                ref={notifRef}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                className="icon-only relative !border-transparent p-2 hover:!bg-white/[0.08]"
                onClick={toggleNotifications}
                aria-label={t('notifications.title')}
                aria-expanded={showNotifications}
              >
                <BellIcon className="h-5 w-5" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 z-10 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 to-fuchsia-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-background">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {unreadCount > 0 && <OrbitStars />}
              </motion.button>
              {showNotifications && (
                <motion.div
                  ref={notifPanelRef}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-[24px] border border-white/10 bg-background shadow-2xl"
                  style={{ boxShadow: '0 20px 50px -8px rgba(0, 0, 0, 0.55), 0 8px 32px 0 rgba(80, 0, 120, 0.25)' }}
                >
                  <div className="relative p-4 flex items-center gap-2 bg-gradient-to-r from-purple-700 to-blue-700">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                      className="inline-flex items-center justify-center w-8 h-8 text-blue-200 drop-shadow-glow"
                    >
                      <SparklesIcon className="h-5 w-5" strokeWidth={1.75} />
                    </motion.span>
                    <span className="font-bold text-base text-white tracking-wide">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="ml-auto bg-gradient-to-tr from-pink-400 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow hover:scale-105 transition" title="Mark all as read">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {notifActionError && (
                    <div className="px-4 py-2 text-xs font-medium text-red-400 bg-red-500/10" role="alert">
                      {notifActionError}
                    </div>
                  )}
                  <ul className="max-h-80 overflow-y-auto bg-background divide-y divide-white/[0.05]">
                    {notifications.length === 0 ? (
                      <li className="p-8 text-center text-text-secondary flex flex-col items-center gap-2">
                        <SparklesIcon className="h-8 w-8 animate-bounce" strokeWidth={1.75} />
                        <span>All is calm in the cosmos 🚀</span>
                      </li>
                    ) : (
                      notifications.map((n, i) => (
                        <motion.li
                          key={n.id}
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i }}
                          onClick={() => handleNotificationClick(n)}
                          className={`flex items-start gap-3 px-5 py-3.5 relative cursor-pointer transition-colors ${n.is_read ? 'bg-background hover:bg-surface' : 'bg-vault/[0.09] hover:bg-vault/[0.14]'}`}
                        >
                          {!n.is_read && <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-vault" />}
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-vault to-bazaar text-lg shadow-sm">
                            {n.reel ? '🛸' : verbIcon[n.verb] || '✨'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-text font-medium leading-snug">
                              <span className="font-bold">{n.actor?.username || 'Someone'}</span> {n.text}
                            </div>
                            <RelativeTime
                              date={n.created_at}
                              className="text-xs text-text-secondary mt-0.5 block"
                            />
                          </div>
                        </motion.li>
                      ))
                    )}
                  </ul>
                  <div className="p-3 border-t border-surface bg-background text-center">
                    <Link
                      href="/notifications"
                      onClick={() => setShowNotifications(false)}
                      className="text-sm font-semibold text-vault hover:underline"
                    >
                      {t('notifications.viewAll')}
                    </Link>
                  </div>
                </motion.div>
              )}
            </div>
            
            <Link
              href="/chat"
              className="icon-only hidden !border-transparent p-2 hover:!bg-white/[0.08] sm:inline-flex"
              title="Cosmic Chat"
              aria-label="Cosmic Chat"
            >
              <ChatBubbleLeftRightIcon className="h-5 w-5" strokeWidth={1.75} />
            </Link>

            <Link
              href="/settings"
              className="icon-only hidden !border-transparent p-2 hover:!bg-white/[0.08] sm:inline-flex"
              title="Settings"
              aria-label="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" strokeWidth={1.75} />
            </Link>
            </div>
            
            <div className="relative ml-0.5">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/25 to-sky-500/15 p-[3px] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_20px_rgba(76,29,149,0.25)] transition hover:shadow-[0_0_0_1px_rgba(167,139,250,0.35),0_10px_24px_rgba(76,29,149,0.35)]"
                onClick={() => setShowAccount(v => !v)}
                aria-label="Account menu"
                title={user?.username || 'Account'}
              >
                {user?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(user.avatar) || user.avatar}
                    alt=""
                    className="h-full w-full rounded-full object-cover ring-2 ring-background/80"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-bold text-white ring-2 ring-background/80">
                    {user?.username
                      ? (user.username.includes('@')
                          ? user.username.split('@')[0]
                          : user.username
                        ).slice(0, 2).toUpperCase()
                      : '?'}
                  </span>
                )}
              </motion.button>
              {showAccount && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-14 z-50 w-56 overflow-hidden rounded-[22px] border border-white/10 bg-background/95 shadow-2xl backdrop-blur-2xl"
                >
                  {user ? (
                    <>
                      <div className="px-4 py-3 border-b border-surface">
                        <div className="text-sm font-semibold text-text">{user.username}</div>
                        {user.email && <div className="text-xs text-text-secondary truncate">{user.email}</div>}
                      </div>
                      <a href={`/profile/${user.id}`} className="block px-4 py-3 text-sm text-text hover:bg-surface transition-colors">
                        Profile
                      </a>
                      <a href="/saved" className="block px-4 py-3 text-sm text-text hover:bg-surface transition-colors border-t border-surface">
                        Saved posts
                      </a>
                      <a href="/settings" className="block px-4 py-3 text-sm text-text hover:bg-surface transition-colors border-t border-surface">
                        Settings
                      </a>
                      {user.is_staff && (
                        <a href="/admin" className="block px-4 py-3 text-sm text-vault font-semibold hover:bg-surface transition-colors border-t border-surface">
                          Admin panel
                        </a>
                      )}
                      <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm text-text hover:bg-surface transition-colors border-t border-surface">
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <a href="/login" className="block px-4 py-3 text-sm text-text hover:bg-surface transition-colors">Sign in</a>
                      <a href="/register" className="block px-4 py-3 text-sm text-text hover:bg-surface transition-colors border-t border-surface">Create account</a>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 
