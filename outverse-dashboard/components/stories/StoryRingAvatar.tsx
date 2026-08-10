'use client';

import { motion } from 'framer-motion';
import { moodRingCss } from '@/lib/storyStudio';

type Props = {
  name: string;
  avatar?: string;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  isNew?: boolean;
  onClick?: () => void;
  layout?: 'vertical' | 'horizontal';
  mood?: string;
  isLocked?: boolean;
  audience?: string;
};

const SIZES = {
  sm: { ring: 'w-14 h-14', inner: 'w-[52px] h-[52px]', text: 'text-[10px]' },
  md: { ring: 'w-20 h-20 sm:w-[5.25rem] sm:h-[5.25rem]', inner: 'w-[4.65rem] h-[4.65rem] sm:w-[4.9rem] sm:h-[4.9rem]', text: 'text-[11px]' },
  lg: { ring: 'w-[3.25rem] h-[3.25rem]', inner: 'w-12 h-12', text: 'text-[10px]' },
};

export default function StoryRingAvatar({
  name,
  avatar,
  count = 1,
  size = 'md',
  isNew = true,
  onClick,
  layout = 'vertical',
  mood,
  isLocked,
  audience,
}: Props) {
  const s = SIZES[size];
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const label = name.split(' ')[0] || name;
  const isCloseFriends = audience === 'close_friends';
  // Close-friends audience always wins visually — it's a privacy signal,
  // like IG's green ring, so it shouldn't be masked by the mood color.
  const moodRing = isCloseFriends ? null : moodRingCss(mood);

  const ring = (
    <motion.div
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      className={`story-ring-outer relative rounded-full p-[3px] ${s.ring} ${isNew ? 'story-ring-new' : 'story-ring-seen'}${isCloseFriends ? ' story-ring-close-friends' : ''}`}
      style={moodRing ? { background: moodRing } : undefined}
    >
      <div
        className={`story-ring-inner ${s.inner} rounded-full overflow-hidden flex items-center justify-center bg-surface`}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className={`w-full h-full object-cover${isLocked ? ' story-ring-locked-media' : ''}`} />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-[#7C3AED] to-[#22D3EE]">
            {initials}
          </span>
        )}
        {isLocked && (
          <span className="story-ring-lock-badge" aria-label="Time capsule — sealed">🔒</span>
        )}
      </div>
      {count > 1 && (
        <span className="story-ring-badge">{count}</span>
      )}
    </motion.div>
  );

  if (layout === 'horizontal') {
    return (
      <button type="button" onClick={onClick} className="story-ring-btn-horizontal">
        {ring}
        <div className="text-left min-w-0">
          <p className={`font-semibold text-text truncate ${s.text}`}>{label}</p>
          <p className="text-[10px] text-text-secondary">{count} {count === 1 ? 'story' : 'stories'}</p>
        </div>
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} className="story-ring-btn-vertical group shrink-0 snap-start">
      {ring}
      <span className={`${s.text} font-medium text-text-secondary max-w-[88px] truncate mt-1.5 group-hover:text-text transition`}>
        {label}
      </span>
    </button>
  );
}
