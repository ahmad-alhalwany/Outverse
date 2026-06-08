'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { SparklesIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';
import { getUser, getCurrentUserId } from '@/lib/auth';

type WorldLink =
  | { href: string; label: string; color: string; reelsIcon: true }
  | { href: string; label: string; color: string; emoji: string };

const WORLDS: WorldLink[] = [
  { href: '/reels', label: 'Signals', reelsIcon: true, color: '#22D3EE' },
  { href: '/lab', label: 'Lab', emoji: '🧪', color: '#6A00FF' },
  { href: '/bazaar', label: 'Bazaar', emoji: '💡', color: '#FF6B9D' },
  { href: '/bottles', label: 'Vault', emoji: '🍶', color: '#00CCFF' },
  { href: '/forge', label: 'Forge', emoji: '📖', color: '#FFD700' },
  { href: '/shop', label: 'Shop', emoji: '🛒', color: '#32CD32' },
];

export default function FeedHero() {
  const user = getUser();
  const greeting = user?.first_name || user?.username || 'Creator';

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="feed-hero mb-6 rounded-2xl p-5 sm:p-6 relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-1 flex items-center gap-1">
              <SparklesIcon className="h-4 w-4 text-vault" />
              Outverse Feed
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-text">
              Hey,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-vault via-bazaar to-lab">
                {greeting}
              </span>
            </h1>
            <p className="text-sm text-text-secondary mt-2 max-w-md">
              Stories, sparks, and creativity from across the cosmos — all in one place.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href={`/profile/${getCurrentUserId()}`}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-vault/20 hover:bg-surface transition"
            >
              My profile
            </Link>
            <Link
              href="/settings"
              className="p-2 rounded-xl border border-vault/20 hover:bg-surface transition"
              aria-label="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5 text-text-secondary" />
            </Link>
          </div>
        </div>
        <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-thin">
          {WORLDS.map((w) => (
            <Link
              key={w.href}
              href={w.href}
              className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border transition hover:scale-[1.02]"
              style={{
                borderColor: `${w.color}44`,
                background: `${w.color}14`,
                color: 'var(--card-text)',
              }}
            >
              {'reelsIcon' in w ? (
                <ReelsIcon size={18} active className="shrink-0" />
              ) : (
                <span>{w.emoji}</span>
              )}
              {w.label}
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
