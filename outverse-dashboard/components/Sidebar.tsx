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
  ChevronDownIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';

type NavLink = {
  nameKey: string;
  href: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  reelsIcon?: true;
};

type NavGroup = {
  groupKey: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  links: NavLink[];
};

/** Always visible, no accordion — the links used daily. */
const topLinks: NavLink[] = [
  { nameKey: 'nav.home', icon: HomeIcon, href: '/' },
  { nameKey: 'nav.reels', href: '/reels', reelsIcon: true },
  { nameKey: 'nav.following', icon: UserGroupIcon, href: '/?feed=following' },
];

const groups: NavGroup[] = [
  {
    groupKey: 'nav.groupCreate',
    icon: PaintBrushIcon,
    links: [
      { nameKey: 'nav.lab', icon: BeakerIcon, href: '/lab' },
      { nameKey: 'nav.bazaar', icon: ShoppingBagIcon, href: '/bazaar' },
      { nameKey: 'nav.story', icon: BookOpenIcon, href: '/forge' },
      { nameKey: 'nav.videos', icon: VideoCameraIcon, href: '/videos' },
      { nameKey: 'nav.studio', icon: VideoCameraIcon, href: '/studio' },
      { nameKey: 'nav.garden', icon: SunIcon, href: '/garden' },
    ],
  },
  {
    groupKey: 'nav.groupExplore',
    icon: RocketLaunchIcon,
    links: [
      { nameKey: 'nav.shop', icon: ShoppingCartIcon, href: '/shop' },
      { nameKey: 'nav.vault', icon: ArchiveBoxIcon, href: '/bottles' },
      { nameKey: 'nav.playlists', icon: QueueListIcon, href: '/playlists' },
      { nameKey: 'nav.storyMap', icon: MapPinIcon, href: '/stories/map' },
      { nameKey: 'nav.museum', icon: BuildingLibraryIcon, href: '/museum' },
      { nameKey: 'nav.simulator', icon: GlobeAltIcon, href: '/simulator' },
      { nameKey: 'nav.characters', icon: PuzzlePieceIcon, href: '/characters' },
    ],
  },
  {
    groupKey: 'nav.groupSocial',
    icon: ChatBubbleLeftRightIcon,
    links: [
      { nameKey: 'nav.chat', icon: ChatBubbleLeftRightIcon, href: '/chat' },
      { nameKey: 'nav.rooms', icon: RectangleStackIcon, href: '/rooms' },
      { nameKey: 'nav.communities', icon: UserGroupIcon, href: '/communities' },
      { nameKey: 'nav.collab', icon: UsersIcon, href: '/collab' },
    ],
  },
  {
    groupKey: 'nav.groupYou',
    icon: SparklesIcon,
    links: [
      { nameKey: 'nav.wallet', icon: SparklesIcon, href: '/wallet' },
      { nameKey: 'nav.capsules', icon: ArchiveBoxIcon, href: '/capsules' },
      { nameKey: 'nav.year', icon: TrophyIcon, href: '/year' },
      { nameKey: 'nav.achievements', icon: TrophyIcon, href: '/achievements' },
      { nameKey: 'nav.analytics', icon: ChartBarIcon, href: '/analytics' },
      { nameKey: 'nav.library', icon: BookmarkSquareIcon, href: '/library' },
      { nameKey: 'nav.premium', icon: HeartIcon, href: '/premium' },
      { nameKey: 'nav.memories', icon: BanknotesIcon, href: '/memories' },
      { nameKey: 'nav.saved', icon: BookmarkIcon, href: '/saved' },
      { nameKey: 'nav.boards', icon: Squares2X2Icon, href: '/saved?filter=public' },
      { nameKey: 'nav.orbitLists', icon: QueueListIcon, href: '/orbit-lists' },
    ],
  },
];

/** Always visible, pinned at the bottom. */
const bottomLinks: NavLink[] = [{ nameKey: 'nav.settings', icon: Cog6ToothIcon, href: '/settings' }];

const OPEN_GROUPS_KEY = 'cosmory-sidebar-open-groups';
const FALLBACK_TAGS = ['DigitalArt', 'CreativeWriting', 'Photography', 'Illustration', 'Animation'];

function isNavActive(href: string, pathname: string, feed: string | null) {
  if (href === '/?feed=following') {
    return pathname === '/' && feed === 'following';
  }
  if (href === '/') {
    return pathname === '/' && feed !== 'following';
  }
  return pathname.startsWith(href.split('?')[0]);
}

function NavItem({ link, active, t }: { link: NavLink; active: boolean; t: (k: string) => string }) {
  const isReels = !!link.reelsIcon;
  const Icon = link.icon;
  return (
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
  );
}

export default function Sidebar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const [feed, setFeed] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>(FALLBACK_TAGS);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

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

  // Restore which groups the user left open, then always add whichever group
  // holds the current route so a deep link never lands on a collapsed section.
  useEffect(() => {
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY) || '[]');
    } catch {
      /* ignore */
    }
    setOpenGroups(new Set(stored));
    setHydrated(true);
  }, []);

  useEffect(() => {
    const activeGroup = groups.find((g) => g.links.some((l) => isNavActive(l.href, pathname, feed)));
    if (activeGroup) {
      setOpenGroups((prev) => (prev.has(activeGroup.groupKey) ? prev : new Set(prev).add(activeGroup.groupKey)));
    }
  }, [pathname, feed]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(Array.from(openGroups)));
  }, [openGroups, hydrated]);

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <aside className="home-sidebar sticky top-24 hidden h-fit w-[260px] shrink-0 px-4 lg:block">
      <nav className="home-sidebar-panel mb-6" aria-label={t('nav.mainNavigation')}>
        <ul className="space-y-2">
          {topLinks.map((link) => (
            <li key={link.nameKey}>
              <NavItem link={link} active={isNavActive(link.href, pathname, feed)} t={t} />
            </li>
          ))}
        </ul>

        <div className="mt-2 space-y-1">
          {groups.map((group) => {
            const isOpen = openGroups.has(group.groupKey);
            const GroupIcon = group.icon;
            const hasActive = group.links.some((l) => isNavActive(l.href, pathname, feed));
            return (
              <div key={group.groupKey}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.groupKey)}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-2xl text-sm font-semibold transition-all ${
                    hasActive ? 'text-text' : 'text-text-secondary hover:text-text hover:bg-white/[0.04]'
                  }`}
                >
                  <GroupIcon className="h-[1.1rem] w-[1.1rem] shrink-0" strokeWidth={1.8} />
                  <span className="flex-1 text-start">{t(group.groupKey)}</span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    strokeWidth={2}
                  />
                </button>
                {isOpen && (
                  <ul className="space-y-1 py-1 ps-3">
                    {group.links.map((link) => (
                      <li key={link.nameKey}>
                        <NavItem link={link} active={isNavActive(link.href, pathname, feed)} t={t} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <ul className="mt-2 space-y-2 border-t border-white/[0.06] pt-2">
          {bottomLinks.map((link) => (
            <li key={link.nameKey}>
              <NavItem link={link} active={isNavActive(link.href, pathname, feed)} t={t} />
            </li>
          ))}
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
