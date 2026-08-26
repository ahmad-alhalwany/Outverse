import type { ComponentType, CSSProperties } from 'react';
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

export type NavSection = 'create' | 'explore' | 'social' | 'commerce' | 'library' | 'stats';

export type NavLink = {
  nameKey: string;
  href: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: string | number; style?: CSSProperties }>;
  reelsIcon?: true;
  titleKey?: string;
  /** Which mobile "More" sheet section this belongs in — desktop's flat
   *  Sidebar list ignores it. */
  section?: NavSection;
};

/**
 * Single source of truth for the "More" navigation links — shared by the
 * desktop Sidebar's More group and the mobile bottom-sheet nav so they
 * can't silently drift apart (the mobile sheet used to hardcode its own,
 * much shorter, copy of this list).
 */
export const MORE_NAV_LINKS: NavLink[] = [
  { nameKey: 'nav.lab', icon: BeakerIcon, href: '/lab', section: 'create' },
  { nameKey: 'nav.bazaar', icon: ShoppingBagIcon, href: '/bazaar', section: 'create' },
  { nameKey: 'nav.story', icon: BookOpenIcon, href: '/forge', section: 'create' },
  { nameKey: 'nav.studio', icon: VideoCameraIcon, href: '/studio', section: 'create' },
  { nameKey: 'nav.simulator', icon: GlobeAltIcon, href: '/simulator', section: 'create' },
  { nameKey: 'nav.videos', icon: VideoCameraIcon, href: '/videos', section: 'explore' },
  { nameKey: 'nav.garden', icon: SunIcon, href: '/garden', section: 'explore' },
  { nameKey: 'nav.storyMap', icon: MapPinIcon, href: '/stories/map', section: 'explore' },
  { nameKey: 'nav.museum', icon: BuildingLibraryIcon, href: '/museum', section: 'explore' },
  { nameKey: 'nav.characters', icon: PuzzlePieceIcon, href: '/characters', section: 'explore' },
  { nameKey: 'nav.chat', icon: ChatBubbleLeftRightIcon, href: '/chat', section: 'social' },
  { nameKey: 'nav.rooms', icon: RectangleStackIcon, href: '/rooms', section: 'social' },
  { nameKey: 'nav.communities', icon: UserGroupIcon, href: '/communities', section: 'social' },
  { nameKey: 'nav.collab', icon: UsersIcon, href: '/collab', section: 'social' },
  { nameKey: 'nav.shop', icon: ShoppingCartIcon, href: '/shop', section: 'commerce' },
  { nameKey: 'nav.wallet', icon: SparklesIcon, href: '/wallet', section: 'commerce' },
  { nameKey: 'nav.premium', icon: HeartIcon, href: '/premium', section: 'commerce' },
  { nameKey: 'nav.vault', icon: ArchiveBoxIcon, href: '/bottles', section: 'library' },
  { nameKey: 'nav.playlists', icon: QueueListIcon, href: '/playlists', section: 'library' },
  { nameKey: 'nav.capsules', icon: ArchiveBoxIcon, href: '/capsules', section: 'library' },
  { nameKey: 'nav.library', icon: BookmarkSquareIcon, href: '/library', section: 'library' },
  { nameKey: 'nav.memories', icon: BanknotesIcon, href: '/memories', section: 'library' },
  { nameKey: 'nav.saved', icon: BookmarkIcon, href: '/saved', section: 'library' },
  { nameKey: 'nav.boards', icon: Squares2X2Icon, href: '/saved?filter=public', section: 'library' },
  { nameKey: 'nav.orbitLists', icon: QueueListIcon, href: '/orbit-lists', section: 'library' },
  { nameKey: 'nav.year', icon: TrophyIcon, href: '/year', section: 'stats' },
  { nameKey: 'nav.achievements', icon: TrophyIcon, href: '/achievements', section: 'stats' },
  { nameKey: 'nav.analytics', icon: ChartBarIcon, href: '/analytics', section: 'stats' },
];

export const SETTINGS_NAV_LINK: NavLink = { nameKey: 'nav.settings', icon: Cog6ToothIcon, href: '/settings' };
