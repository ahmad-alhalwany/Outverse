'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  BeakerIcon,
  PlusCircleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';
import { getCurrentUserId } from '@/lib/auth';

export default function HomeMobileNav() {
  const pathname = usePathname();
  const profileHref = `/profile/${getCurrentUserId()}`;

  const items = [
    { href: '/', label: 'Home', icon: HomeIcon, match: (p: string) => p === '/' },
    {
      href: '/reels',
      label: 'Signals',
      reels: true as const,
      match: (p: string) => p.startsWith('/reels'),
    },
    { href: '/lab', label: 'Lab', icon: BeakerIcon, match: (p: string) => p.startsWith('/lab') },
    { href: profileHref, label: 'Me', icon: UserCircleIcon, match: (p: string) => p.startsWith('/profile') },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-vault/15 bg-background/95 backdrop-blur-lg safe-area-pb"
      aria-label="Quick navigation"
    >
      <div className="flex items-center justify-around py-2 px-2">
        {items.map((item) => {
          const active = item.match(pathname);
          const isReels = 'reels' in item && item.reels;
          const Icon = 'icon' in item ? item.icon : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 min-w-[3.25rem] py-1 text-[10px] font-medium transition ${
                isReels ? 'home-mobile-nav__reels ' : ''
              }${active ? (isReels ? 'text-cyan-400' : 'text-vault') : 'text-text-secondary'}`}
            >
              {isReels ? (
                <span className={`home-mobile-nav__reels-ring${active ? ' home-mobile-nav__reels-ring--on' : ''}`}>
                  <ReelsIcon size={22} active={active} />
                </span>
              ) : (
                Icon && <Icon className="h-5 w-5" />
              )}
              {item.label}
            </Link>
          );
        })}
        <a
          href="#create-post"
          className="flex flex-col items-center gap-0.5 min-w-[3.5rem] py-1 text-[10px] font-semibold text-bazaar"
        >
          <PlusCircleIcon className="h-6 w-6" />
          Post
        </a>
      </div>
    </nav>
  );
}
