'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { type AuthUser, getUser, logout, refreshSession } from '@/lib/auth';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { apiUrl } from '@/lib/api';
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
  UserCircleIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
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
    try {
      const res = await apiFetch('notifications/');
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
    refreshSession().then((u) => setUser(u ?? getUser()));
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 120000);
    return () => clearInterval(interval);
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
        <div className="flex h-16 items-center justify-between rounded-[24px] border border-white/10 bg-background/72 px-3 shadow-[0_20px_60px_rgba(9,6,28,0.35)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/62 sm:px-5">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-text hover:opacity-90 transition">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/cosmory-icon.svg" alt="Cosmory" width={36} height={36} className="h-9 w-9 rounded-xl" />
              <span>Cosmory</span>
            </Link>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex space-x-1 rounded-2xl border border-white/6 bg-white/[0.03] p-1" aria-label={t('nav.mainNavigation')}>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigateTab(tab.id)}
                  aria-label={tab.name}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex items-center gap-2 rounded-xl px-3 py-2 transition-all duration-200 group
                    ${isActive ? `${tabColors[tab.id]} shadow-[0_10px_24px_rgba(17,12,42,0.22)]` : 'text-text-secondary hover:bg-white/[0.04] hover:text-text'}
                  `}
                  style={isActive ? { fontWeight: 700 } : {}}
                >
                  <motion.span
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.96 }}
                    className="flex items-center"
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </motion.span>
                  <span className="hidden md:inline-block text-sm">{tab.name}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className={`absolute bottom-0 left-0 right-0 h-0.5 rounded ${tabBgColors[tab.id]}`}
                      initial={false}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Side Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative hidden sm:block">
              <input
                type="text"
                placeholder="Search creators & posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                className="cosmic-input w-44 rounded-full border-white/10 bg-white/[0.05] py-2 pl-10 pr-4 text-sm sm:w-56"
              />
              <MagnifyingGlassIcon className="h-4 w-4 text-text-secondary absolute left-3.5 top-1/2 transform -translate-y-1/2" strokeWidth={1.75} />
              {showSearch && searchQuery.trim() && (
                <div className="absolute left-0 top-14 z-50 max-h-96 w-72 overflow-y-auto rounded-[22px] border border-white/10 bg-background/95 shadow-2xl backdrop-blur-2xl">
                  {totalSearchResults === 0 ? (
                    <div className="px-4 py-6 text-center text-text-secondary text-sm">No results found.</div>
                  ) : (
                    <>
                      {searchResults.users.length > 0 && (
                        <div className="py-2">
                          <div className="px-4 py-1 text-[10px] uppercase tracking-wide text-text-secondary">Creators</div>
                          {searchResults.users.map((u) => (
                            <button
                              key={`u-${u.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => goToSearchResult(`/profile/${u.id}`)}
                              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-surface transition-colors text-left"
                            >
                              {u.avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatar} alt={u.username} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-vault to-bazaar text-white flex items-center justify-center text-[10px] font-bold">
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
                      {searchResults.posts.length > 0 && (
                        <div className="py-2 border-t border-surface">
                          <div className="px-4 py-1 text-[10px] uppercase tracking-wide text-text-secondary">Posts</div>
                          {searchResults.posts.map((p) => (
                            <button
                              key={`p-${p.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => goToSearchResult(`/post/${p.id}`)}
                              className="w-full flex flex-col px-4 py-2 hover:bg-surface transition-colors text-left"
                            >
                              <span className="text-sm text-text truncate">{p.snippet || 'Untitled'}</span>
                              <span className="text-xs text-text-secondary">@{p.author}</span>
                            </button>
                          ))}
                        </div>
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
                          See all results
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={toggleTheme}
              className="icon-only border border-white/6 bg-white/[0.04] p-2"
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
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                className="icon-only relative border border-white/6 bg-white/[0.04] p-2"
                onClick={toggleNotifications}
                aria-label={t('notifications.title')}
                aria-expanded={showNotifications}
              >
                <BellIcon className="h-5 w-5" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-tr from-yellow-400 to-pink-400 text-white text-[10px] font-bold rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-1 shadow-lg border-2 border-background z-10">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
                {unreadCount > 0 && <OrbitStars />}
              </motion.button>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-14 z-50 w-80 overflow-hidden rounded-[24px] border border-white/10 bg-background/92 shadow-2xl backdrop-blur-2xl"
                  style={{ boxShadow: '0 8px 32px 0 rgba(80, 0, 120, 0.25)' }}
                >
                  <div className="relative p-4 border-b border-surface flex items-center gap-2 bg-gradient-to-r from-purple-700/80 to-blue-700/80">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                      className="inline-flex items-center justify-center w-8 h-8 text-blue-200 drop-shadow-glow"
                    >
                      <SparklesIcon className="h-5 w-5" strokeWidth={1.75} />
                    </motion.span>
                    <span className="font-bold text-base text-white tracking-wide drop-shadow">Notifications</span>
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
                  <ul className="max-h-80 overflow-y-auto">
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
                          className={`flex items-start gap-3 px-5 py-4 border-0 relative cursor-pointer hover:bg-surface transition-colors ${n.is_read ? 'bg-transparent' : 'bg-vault/10 backdrop-blur-sm shadow-inner'} rounded-xl mb-1`}
                          style={{ boxShadow: n.is_read ? undefined : '0 0 12px 2px #7f5fff33' }}
                        >
                          <span className="text-2xl mt-0.5 drop-shadow-glow">
                            {n.reel ? '🛸' : verbIcon[n.verb] || '✨'}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm text-text font-medium">
                              <span className="font-bold">{n.actor?.username || 'Someone'}</span> {n.text}
                            </div>
                            <RelativeTime
                              date={n.created_at}
                              className="text-xs text-text-secondary mt-0.5 block"
                            />
                          </div>
                          {i < notifications.length - 1 && (
                            <span className="absolute left-8 right-2 bottom-0 h-0.5 bg-gradient-to-r from-purple-400/30 via-blue-400/30 to-transparent rounded-full blur-sm" />
                          )}
                        </motion.li>
                      ))
                    )}
                  </ul>
                  <div className="p-3 border-t border-surface text-center">
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
              className="icon-only hidden border border-white/6 bg-white/[0.04] p-2 sm:inline-flex"
              title="Cosmic Chat"
              aria-label="Cosmic Chat"
            >
              <ChatBubbleLeftRightIcon className="h-5 w-5" strokeWidth={1.75} />
            </Link>

            <Link
              href="/settings"
              className="icon-only hidden border border-white/6 bg-white/[0.04] p-2 sm:inline-flex"
              title="Settings"
              aria-label="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5" strokeWidth={1.75} />
            </Link>
            
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] py-1 pl-1 pr-2 transition-colors hover:bg-white/[0.08]"
                onClick={() => setShowAccount(v => !v)}
                aria-label="Account menu"
              >
                <UserCircleIcon className="h-6 w-6 text-text-secondary" strokeWidth={1.75} />
                {user && <span className="hidden lg:inline-block text-sm font-medium">{user.username}</span>}
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
