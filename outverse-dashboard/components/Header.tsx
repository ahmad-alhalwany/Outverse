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
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

type TabId = 'home' | 'lab' | 'bazaar' | 'vault' | 'story' | 'shop';

interface Tab {
  id: TabId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const Header = () => {
  const [activeTab, setActiveTab] = useState<TabId>('home');

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
            
            <motion.button
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 text-text-secondary hover:text-lab transition-colors"
            >
              <BellIcon className="h-6 w-6" />
            </motion.button>
            
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