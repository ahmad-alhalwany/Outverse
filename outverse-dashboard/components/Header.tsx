'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useRef } from 'react';

type TabId = 'home' | 'lab' | 'bazaar' | 'vault' | 'story' | 'shop';

interface Tab {
  id: TabId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const mockNotifications = [
  { id: 1, text: 'Alex liked your post', icon: '⭐', time: '2m ago', read: false },
  { id: 2, text: 'Maria commented: Amazing!', icon: '💬', time: '10m ago', read: false },
  { id: 3, text: 'New challenge available!', icon: '🚀', time: '1h ago', read: true },
];

const Header = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = mockNotifications.filter(n => !n.read).length;
  const notifRef = useRef<HTMLButtonElement>(null);
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
            <h1 className="text-2xl font-bold text-text">Outverse</h1>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
                placeholder="Search..."
                className="bg-surface text-text rounded-full pl-10 pr-4 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-lab"
              />
              <MagnifyingGlassIcon className="h-5 w-5 text-text-secondary absolute left-3 top-1/2 transform -translate-y-1/2" />
            </div>
            
            <div className="relative flex items-center justify-center">
              <motion.button
                ref={notifRef}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 text-text-secondary hover:text-lab transition-colors relative"
                onClick={() => setShowNotifications(v => !v)}
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
                  className="absolute right-0 top-12 w-80 bg-gradient-to-br from-[#1a1333] via-[#23244d] to-[#1a1333] rounded-2xl shadow-2xl z-50 overflow-hidden border border-surface backdrop-blur-xl"
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
                    <button className="ml-auto bg-gradient-to-tr from-pink-400 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow hover:scale-105 transition" title="Mark all as read">
                      Mark all as read
                    </button>
                  </div>
                  <ul className="max-h-80 overflow-y-auto">
                    {mockNotifications.length === 0 ? (
                      <li className="p-8 text-center text-blue-200 flex flex-col items-center gap-2">
                        <SparklesIcon className="h-10 w-10 animate-bounce" />
                        <span>All is calm in the cosmos 🚀</span>
                      </li>
                    ) : (
                      mockNotifications.map((n, i) => (
                        <motion.li
                          key={n.id}
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 * i }}
                          className={`flex items-start gap-3 px-5 py-4 border-0 relative ${n.read ? 'bg-transparent' : 'bg-blue-900/30 backdrop-blur-sm shadow-inner'} rounded-xl mb-1`}
                          style={{ boxShadow: n.read ? undefined : '0 0 12px 2px #7f5fff33' }}
                        >
                          <span className="text-2xl mt-0.5 drop-shadow-glow">{n.icon}</span>
                          <div className="flex-1">
                            <div className="text-sm text-white font-medium drop-shadow">{n.text}</div>
                            <div className="text-xs text-blue-200 mt-0.5">{n.time}</div>
                          </div>
                          {/* خط فاصل كوني */}
                          {i < mockNotifications.length - 1 && (
                            <span className="absolute left-8 right-2 bottom-0 h-0.5 bg-gradient-to-r from-purple-400/30 via-blue-400/30 to-transparent rounded-full blur-sm" />
                          )}
                        </motion.li>
                      ))
                    )}
                  </ul>
                </motion.div>
              )}
            </div>
            
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 text-text-secondary hover:text-bazaar transition-colors"
            >
              <ChatBubbleLeftRightIcon className="h-6 w-6" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 text-text-secondary hover:text-vault transition-colors"
            >
              <UserCircleIcon className="h-6 w-6" />
            </motion.button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 