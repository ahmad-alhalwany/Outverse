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
  SparklesIcon,
  TrophyIcon,
  ChartBarIcon,
  BookmarkSquareIcon,
  UsersIcon,
  RocketLaunchIcon,
  GlobeAltIcon,
  BuildingLibraryIcon,
  SunIcon,
  VideoCameraIcon,
  BanknotesIcon,
  PuzzlePieceIcon,
  RectangleStackIcon,
  HeartIcon,
  QueueListIcon,
  MapPinIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';

const navLinks = [
  { nameKey: 'nav.home', icon: HomeIcon, href: '/' },
  { nameKey: 'nav.reels', href: '/reels', reelsIcon: true as const },
  { nameKey: 'nav.lab', icon: BeakerIcon, href: '/lab' },
  { nameKey: 'nav.bazaar', icon: ShoppingBagIcon, href: '/bazaar' },
  { nameKey: 'nav.vault', icon: ArchiveBoxIcon, href: '/bottles' },
  { nameKey: 'nav.story', icon: BookOpenIcon, href: '/forge' },
  { nameKey: 'nav.videos', icon: VideoCameraIcon, href: '/videos' },
  { nameKey: 'nav.playlists', icon: QueueListIcon, href: '/playlists' },
  { nameKey: 'nav.storyMap', icon: MapPinIcon, href: '/stories/map' },
  { nameKey: 'nav.shop', icon: ShoppingCartIcon, href: '/shop' },
  { nameKey: 'nav.chat', icon: ChatBubbleLeftRightIcon, href: '/chat' },
  { nameKey: 'nav.rooms', icon: RectangleStackIcon, href: '/rooms' },
  { nameKey: 'nav.communities', icon: UserGroupIcon, href: '/communities' },
  { nameKey: 'nav.wallet', icon: SparklesIcon, href: '/wallet' },
  { nameKey: 'nav.capsules', icon: ArchiveBoxIcon, href: '/capsules' },
  { nameKey: 'nav.year', icon: TrophyIcon, href: '/year' },
  { nameKey: 'nav.achievements', icon: TrophyIcon, href: '/achievements' },
  { nameKey: 'nav.analytics', icon: ChartBarIcon, href: '/analytics' },
  { nameKey: 'nav.library', icon: BookmarkSquareIcon, href: '/library' },
  { nameKey: 'nav.collab', icon: UsersIcon, href: '/collab' },
  { nameKey: 'nav.premium', icon: HeartIcon, href: '/premium' },
  { nameKey: 'nav.simulator', icon: GlobeAltIcon, href: '/simulator' },
  { nameKey: 'nav.museum', icon: BuildingLibraryIcon, href: '/museum' },
  { nameKey: 'nav.garden', icon: SunIcon, href: '/garden' },
  { nameKey: 'nav.studio', icon: VideoCameraIcon, href: '/studio' },
  { nameKey: 'nav.memories', icon: BanknotesIcon, href: '/memories' },
  { nameKey: 'nav.characters', icon: PuzzlePieceIcon, href: '/characters' },
  { nameKey: 'nav.following', icon: UserGroupIcon, href: '/?feed=following' },
  { nameKey: 'nav.saved', icon: BookmarkIcon, href: '/saved' },
  { nameKey: 'nav.boards', icon: Squares2X2Icon, href: '/saved?filter=public' },
  { nameKey: 'nav.orbitLists', icon: QueueListIcon, href: '/orbit-lists' },
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
  return pathname.startsWith(href.split('?')[0]);
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
    <aside className="home-sidebar sticky top-24 hidden h-fit w-[260px] shrink-0 px-4 lg:block">
      <nav className="home-sidebar-panel mb-6">
        <ul className="space-y-2">
          {navLinks.map((link) => {
            const active = isNavActive(link.href, pathname, feed);
            const isReels = 'reelsIcon' in link && link.reelsIcon;
            const Icon = 'icon' in link ? link.icon : null;
            return (
              <li key={link.nameKey}>
                <Link
                  href={link.href}
                  className={`group flex items-center gap-3 font-medium py-2.5 px-3.5 rounded-2xl transition-all ${
                    isReels ? 'sidebar-link--reels ' : ''
                  }${
                    active
                      ? isReels
                        ? 'sidebar-link--reels-active text-text shadow-[0_14px_30px_rgba(17,12,42,0.22)]'
                        : 'bg-surface text-text shadow-[0_14px_30px_rgba(17,12,42,0.18)]'
                      : 'text-text-secondary hover:text-text hover:bg-white/[0.04]'
                  }`}
                >
                  {isReels ? (
                    <ReelsIcon size={22} active={active} className="shrink-0" />
                  ) : (
                    Icon && <Icon className="h-[1.15rem] w-[1.15rem] shrink-0 transition-colors group-hover:text-text" strokeWidth={1.8} />
                  )}
                  <span className="text-sm">{t(link.nameKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="home-sidebar-panel">
        <h3 className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-text-secondary">
          <FireIcon className="h-4 w-4" strokeWidth={1.8} /> {t('nav.popularTags')}
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
