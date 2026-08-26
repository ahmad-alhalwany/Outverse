import type { ComponentType } from 'react';
import {
  BeakerIcon,
  ShoppingBagIcon,
  BookOpenIcon,
  VideoCameraIcon,
  SunIcon,
  ShoppingCartIcon,
  ArchiveBoxIcon,
  QueueListIcon,
  MapPinIcon,
  BuildingLibraryIcon,
  GlobeAltIcon,
  PuzzlePieceIcon,
  ChatBubbleLeftRightIcon,
  RectangleStackIcon,
  UserGroupIcon,
  UsersIcon,
  SparklesIcon,
  TrophyIcon,
  ChartBarIcon,
  BookmarkSquareIcon,
  HeartIcon,
  BanknotesIcon,
  BookmarkIcon,
  Squares2X2Icon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

export type NavLink = {
  nameKey: string;
  href: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: string | number }>;
  reelsIcon?: true;
  titleKey?: string;
};

/**
 * Single source of truth for the "More" navigation links — shared by the
 * desktop Sidebar's More group and the mobile bottom-sheet nav so they
 * can't silently drift apart (the mobile sheet used to hardcode its own,
 * much shorter, copy of this list).
 */
export const MORE_NAV_LINKS: NavLink[] = [
  { nameKey: 'nav.lab', icon: BeakerIcon, href: '/lab' },
  { nameKey: 'nav.bazaar', icon: ShoppingBagIcon, href: '/bazaar' },
  { nameKey: 'nav.story', icon: BookOpenIcon, href: '/forge' },
  { nameKey: 'nav.videos', icon: VideoCameraIcon, href: '/videos' },
  { nameKey: 'nav.studio', icon: VideoCameraIcon, href: '/studio' },
  { nameKey: 'nav.garden', icon: SunIcon, href: '/garden' },
  { nameKey: 'nav.shop', icon: ShoppingCartIcon, href: '/shop' },
  { nameKey: 'nav.vault', icon: ArchiveBoxIcon, href: '/bottles' },
  { nameKey: 'nav.playlists', icon: QueueListIcon, href: '/playlists' },
  { nameKey: 'nav.storyMap', icon: MapPinIcon, href: '/stories/map' },
  { nameKey: 'nav.museum', icon: BuildingLibraryIcon, href: '/museum' },
  { nameKey: 'nav.simulator', icon: GlobeAltIcon, href: '/simulator' },
  { nameKey: 'nav.characters', icon: PuzzlePieceIcon, href: '/characters' },
  { nameKey: 'nav.chat', icon: ChatBubbleLeftRightIcon, href: '/chat' },
  { nameKey: 'nav.rooms', icon: RectangleStackIcon, href: '/rooms' },
  { nameKey: 'nav.communities', icon: UserGroupIcon, href: '/communities' },
  { nameKey: 'nav.collab', icon: UsersIcon, href: '/collab' },
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
];

export const SETTINGS_NAV_LINK: NavLink = { nameKey: 'nav.settings', icon: Cog6ToothIcon, href: '/settings' };
