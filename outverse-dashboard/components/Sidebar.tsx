'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { useLocale } from '@/components/LocaleProvider';
import {
  HomeIcon,
  BeakerIcon,
  ShoppingBagIcon,
  ArchiveBoxIcon,
  BookOpenIcon,
  ShoppingCartIcon,
  FireIcon,
  BookmarkIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';

const navLinks = [
  { nameKey: 'nav.home', icon: HomeIcon, href: '/' },
  { nameKey: 'nav.reels', href: '/reels', reelsIcon: true as const },
  { nameKey: 'nav.lab', icon: BeakerIcon, href: '/lab' },
  { nameKey: 'nav.bazaar', icon: ShoppingBagIcon, href: '/bazaar' },
  { nameKey: 'nav.vault', icon: ArchiveBoxIcon, href: '/bottles' },
  { nameKey: 'nav.story', icon: BookOpenIcon, href: '/forge' },
  { nameKey: 'nav.shop', icon: ShoppingCartIcon, href: '/shop' },
  { nameKey: 'nav.chat', icon: ChatBubbleLeftRightIcon, href: '/chat' },
  { nameKey: 'nav.following', icon: UserGroupIcon, href: '/?feed=following' },
  { nameKey: 'nav.saved', icon: BookmarkIcon, href: '/saved' },
  { nameKey: 'nav.settings', icon: Cog6ToothIcon, href: '/settings' },
] as const;

const FALLBACK_TAGS = [
  'DigitalArt',
  'CreativeWriting',
  'Photography',
  'Illustration',
  'Animation',
];

function isNavActive(href: string, pathname: string, feed: string | null) {
  if (href === '/?feed=following') {
    return pathname === '/' && feed === 'following';
  }
  if (href === '/') {
    return pathname === '/' && feed !== 'following';
  }
  return pathname.startsWith(href);
}

export default function Sidebar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const [feed, setFeed] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(FALLBACK_TAGS);

  useEffect(() => {
    if (pathname === '/') {
      setFeed(new URLSearchParams(window.location.search).get('feed'));
    } else {
      setFeed(null);
    }
  }, [pathname]);

  useEffect(() => {
    fetch(apiUrl('posts/trending_tags/'))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const names = data
          .map((row: { tag?: string }) => row.tag)
          .filter((t): t is string => !!t);
        if (names.length) setTags(names);
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="w-64 pt-20 px-4 hidden lg:block">
      <nav className="mb-8">
        <ul className="space-y-2">
          {navLinks.map((link) => {
            const active = isNavActive(link.href, pathname, feed);
            const isReels = 'reelsIcon' in link && link.reelsIcon;
            const Icon = 'icon' in link ? link.icon : null;
            return (
              <li key={link.nameKey}>
                <Link
                  href={link.href}
                  className={`flex items-center space-x-3 font-medium py-2 px-3 rounded-lg transition-colors ${
                    isReels ? 'sidebar-link--reels ' : ''
                  }${
                    active
                      ? isReels
                        ? 'sidebar-link--reels-active text-text'
                        : 'bg-surface text-text'
                      : 'text-text-secondary hover:text-text hover:bg-surface/60'
                  }`}
                >
                  {isReels ? (
                    <ReelsIcon size={22} active={active} className="shrink-0" />
                  ) : (
                    Icon && <Icon className="h-5 w-5" />
                  )}
                  <span>{t(link.nameKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div>
        <h3 className="text-xs font-semibold text-text-secondary mb-2 flex items-center gap-1">
          <FireIcon className="h-4 w-4" /> {t('nav.popularTags')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag}
              href={`/tag/${encodeURIComponent(tag)}`}
              className="bg-surface text-xs text-text-secondary px-2 py-1 rounded-full hover:bg-lab/15 hover:text-lab transition"
            >
              #{tag}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
