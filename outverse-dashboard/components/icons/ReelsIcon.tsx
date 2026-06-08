'use client';

import { useId } from 'react';

export interface ReelsIconProps {
  className?: string;
  size?: number;
  /** Gradient stroke when true (nav active / brand) */
  active?: boolean;
  title?: string;
}

/**
 * Cosmic "signal reel" mark: vertical frame + radiating waves.
 */
export default function ReelsIcon({
  className = '',
  size = 24,
  active = false,
  title,
}: ReelsIconProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `reels-grad-${uid}`;

  const stroke = active ? `url(#${gradId})` : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`reels-icon ${active ? 'reels-icon--active' : ''} ${className}`.trim()}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {active && (
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="45%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#6a00ff" />
          </linearGradient>
        </defs>
      )}
      <rect
        x="11"
        y="2.5"
        width="10.5"
        height="19"
        rx="2.8"
        stroke={stroke}
        strokeWidth="1.65"
        fill={active ? 'rgba(106, 0, 255, 0.12)' : 'none'}
      />
      <circle cx="16.25" cy="5.5" r="1.1" fill={active ? '#22d3ee' : 'currentColor'} opacity={active ? 1 : 0.85} />
      <path
        d="M1.5 7.5c2.2-1.4 4-1.4 6.2 0s4 1.4 6.2 0"
        stroke={stroke}
        strokeWidth="1.45"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M1.5 12c2.5-1.6 4.5-1.6 7 0s4.5 1.6 7 0"
        stroke={stroke}
        strokeWidth="1.45"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        d="M1.5 16.5c1.8-1.2 3.2-1.2 5 0s3.2 1.2 5 0"
        stroke={stroke}
        strokeWidth="1.45"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="M14 9.5v5M12 11.5h4"
        stroke={stroke}
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity={active ? 0.9 : 0.7}
      />
    </svg>
  );
}
