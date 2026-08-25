'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  SparklesIcon,
  Cog6ToothIcon,
  BellIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import { useAuthUser, useProfileHref } from '@/lib/hooks/useAuthUser';

export default function FeedHero() {
  const user = useAuthUser();
  const profileHref = useProfileHref();
  const greeting = user?.first_name || user?.username || 'Creator';
  const heroStats = [
    { value: '24/7', label: 'Fresh inspiration' },
    { value: 'Live', label: 'Community pulse' },
  ];

  return (
    <motion.section
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      className="feed-hero mb-5 rounded-[28px] p-4 sm:p-5 relative overflow-hidden"
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-text-secondary/80 mb-1 flex items-center gap-1">
              <SparklesIcon className="h-4 w-4 text-vault" />
              Home
            </p>
            <h1 className="text-[1.75rem] sm:text-[2.1rem] leading-tight font-bold text-text">
              Hey,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-vault via-bazaar to-lab">
                {greeting}
              </span>
            </h1>
            <p className="text-sm text-text-secondary max-w-xl">
              Discover ideas, join communities, and create something new every day.
            </p>
            <div className="feed-hero__stats">
              {heroStats.map((stat) => (
                <div key={stat.label} className="feed-hero__stat">
                  <span className="feed-hero__stat-value">{stat.value}</span>
                  <span className="feed-hero__stat-label">{stat.label}</span>
                </div>
              ))}
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-text-secondary">
              <span className="home-hero-pill">
                <BellIcon className="h-3.5 w-3.5" />
                Fresh challenges
              </span>
              <span className="home-hero-pill">
                <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                Live creator chatter
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              href="#create-post"
              className="feed-hero__cta-primary text-xs font-semibold px-4 py-2.5 rounded-full"
            >
              Share a spark
            </Link>
            <Link
              href={profileHref}
              className="feed-hero__cta-secondary text-xs font-semibold px-3.5 py-2.5 rounded-full"
            >
              My profile
            </Link>
            <Link
              href="/settings"
              className="feed-hero__cta-secondary p-2.5 rounded-full"
              aria-label="Settings"
            >
              <Cog6ToothIcon className="h-5 w-5 text-text-secondary" />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
