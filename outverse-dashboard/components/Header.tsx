'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { type AuthUser, getUser, logout } from '@/lib/auth';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { apiUrl } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { formatRelativeTime } from '@/utils/dateFormatter';
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
  MoonIcon
} from '@heroicons/react/24/outline';
import { useRef } from 'react';

type TabId = 'home' | 'lab' | 'bazaar' | 'vault' | 'story' | 'shop';

interface Tab {
  id: TabId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const NOTIFICATIONS_API = apiUrl('notifications/');
const SEARCH_API = apiUrl('search/');

interface SearchResults {
  users: { id: number; username: string; name: string; avatar: string | null }[];
  posts: { id: number; snippet: string; author: string }[];
}

interface AppNotification {
  id: number;
  actor: { id: number; username: string; avatar: string | null };
  verb: 'reaction' | 'comment' | 'follow';
  post: number | null;
  reel: number | null;
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
  vault: '/bottles',
  story: '/forge',
  shop: '/shop',
};

function tabFromPath(pathname: string): TabId {
  if (pathname.startsWith('/lab')) return 'lab';
  if (pathname.startsWith('/bazaar')) return 'bazaar';
  if (pathname.startsWith('/bottles')) return 'vault';
  if (pathname.startsWith('/forge')) return 'story';
  if (pathname.startsWith('/shop')) return 'shop';
  return 'home';
}

const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromPath(pathname));
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults>({ users: [], posts: [] });
  const [showSearch, setShowSearch] = useState(false);
  const notifRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults({ users: [], posts: [] });
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

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch('notifications/');
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data.results) ? data.results : []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setActiveTab(tabFromPath(pathname));
  }, [pathname]);

  useEffect(() => {
    setUser(getUser());
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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
      }
    } catch {
      /* ignore */
    }
  }

  function toggleNotifications() {
    setShowNotifications((v) => {
      if (!v) fetchNotifications();
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
        }
      } catch {
        /* ignore */
      }
    }
  }

  async function handleNotificationClick(n: AppNotification) {
    await markNotificationRead(n.id);
    setShowNotifications(false);
    if (n.verb === 'follow' && n.actor?.id) {
      router.push(`/profile/${n.actor.id}`);
    } else if (n.reel) {
      router.push(`/reels/${n.reel}`);
    } else if (n.post) {
      router.push(`/post/${n.post}`);
    }
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
    <header className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-b border-surface z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-2xl font-bold text-text hover:opacity-90 transition">
              Outverse
            </Link>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigateTab(tab.id)}
                  className={`relative px-4 py-2 rounded-lg flex items-center space-x-2 transition-all duration-200 group
                    ${isActive ? tabColors[tab.id] : 'text-text-secondary hover:text-text'}
                  `}
                  style={isActive ? { fontWeight: 700 } : {}}
                >
                  <motion.span
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center"
                  >
                    <Icon className="h-5 w-5" />
                  </motion.span>
                  <span className="hidden md:inline-block">{tab.name}</span>
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
          <div className="flex items-center space-x-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search creators & posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 150)}
                className="bg-surface text-text rounded-full pl-10 pr-4 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-lab"
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-text-secondary absolute left-3 top-1/2 transform -translate-y-1/2" />
              {showSearch && searchQuery.trim() && (
                <div className="absolute left-0 top-12 w-72 bg-background rounded-xl shadow-2xl z-50 overflow-hidden border border-surface max-h-96 overflow-y-auto">
                  {searchResults.users.length === 0 && searchResults.posts.length === 0 ? (
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
                    </>
                  )}
                </div>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.15, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              className="p-2 text-text-secondary hover:text-story transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </motion.button>

            <div className="relative flex items-center justify-center">
              <motion.button
                ref={notifRef}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-text-secondary hover:text-lab transition-colors relative"
                onClick={toggleNotifications}
              >
                <BellIcon className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-gradient-to-tr from-yellow-400 to-pink-400 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse shadow-lg border-2 border-background z-10">
                    {unreadCount}
                  </span>
                )}
                {unreadCount > 0 && <OrbitStars />}
              </motion.button>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-12 w-80 bg-background rounded-2xl shadow-2xl z-50 overflow-hidden border border-surface backdrop-blur-xl"
                  style={{ boxShadow: '0 8px 32px 0 rgba(80, 0, 120, 0.25)' }}
                >
                  <div className="relative p-4 border-b border-surface flex items-center gap-2 bg-gradient-to-r from-purple-700/80 to-blue-700/80">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
                      className="inline-block text-2xl text-blue-200 drop-shadow-glow"
                    >
                      <SparklesIcon className="h-7 w-7 animate-pulse" />
                    </motion.span>
                    <span className="font-bold text-base text-white tracking-wide drop-shadow">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="ml-auto bg-gradient-to-tr from-pink-400 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow hover:scale-105 transition" title="Mark all as read">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <ul className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <li className="p-8 text-center text-text-secondary flex flex-col items-center gap-2">
                        <SparklesIcon className="h-10 w-10 animate-bounce" />
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
                            <div className="text-xs text-text-secondary mt-0.5">{formatRelativeTime(new Date(n.created_at))}</div>
                          </div>
                          {i < notifications.length - 1 && (
                            <span className="absolute left-8 right-2 bottom-0 h-0.5 bg-gradient-to-r from-purple-400/30 via-blue-400/30 to-transparent rounded-full blur-sm" />
                          )}
                        </motion.li>
                      ))
                    )}
                  </ul>
                </motion.div>
              )}
            </div>
            
            <Link
              href="/chat"
              className="p-2 text-text-secondary hover:text-bazaar transition-colors inline-flex"
              title="Cosmic Chat"
              aria-label="Cosmic Chat"
            >
              <ChatBubbleLeftRightIcon className="h-6 w-6" />
            </Link>
            
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-text-secondary hover:text-vault transition-colors flex items-center gap-2"
                onClick={() => setShowAccount(v => !v)}
              >
                <UserCircleIcon className="h-6 w-6" />
                {user && <span className="hidden md:inline-block text-sm font-medium">{user.username}</span>}
              </motion.button>
              {showAccount && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 top-12 w-48 bg-background rounded-xl shadow-2xl z-50 overflow-hidden border border-surface"
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