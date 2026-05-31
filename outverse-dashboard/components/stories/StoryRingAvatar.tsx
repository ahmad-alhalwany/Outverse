'use client';

import { motion } from 'framer-motion';

type Props = {
  name: string;
  avatar?: string;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  isNew?: boolean;
  onClick?: () => void;
  layout?: 'vertical' | 'horizontal';
};

const SIZES = {
  sm: { ring: 'w-14 h-14', inner: 'w-[52px] h-[52px]', text: 'text-[10px]' },
  md: { ring: 'w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20', inner: 'w-[4.25rem] h-[4.25rem] sm:w-[4.65rem] sm:h-[4.65rem]', text: 'text-[11px]' },
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
}: Props) {
  const s = SIZES[size];
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const label = name.split(' ')[0] || name;

  const ring = (
    <motion.div
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      className={`story-ring-outer relative rounded-full p-[3px] ${s.ring} ${isNew ? 'story-ring-new' : 'story-ring-seen'}`}
    >
      <div
        className={`story-ring-inner ${s.inner} rounded-full overflow-hidden flex items-center justify-center bg-[#1a1a2e]`}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-vault via-bazaar to-lab">
            {initials}
          </span>
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
      <span className={`${s.text} font-medium text-text-secondary max-w-[76px] truncate mt-1.5 group-hover:text-text transition`}>
        {label}
      </span>
    </button>
  );
}
