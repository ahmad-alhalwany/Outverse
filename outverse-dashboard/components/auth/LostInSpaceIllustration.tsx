'use client';

import { motion } from 'framer-motion';

export default function LostInSpaceIllustration({ theme }: { theme: 'light' | 'dark' }) {
  const isDark = theme === 'dark';
  const sky = isDark ? '#0b1020' : '#e9e4fb';
  const starColor = isDark ? '#e5eefc' : '#7C3AED';

  return (
    <svg viewBox="0 0 240 160" className="mx-auto w-full max-w-[260px]" aria-hidden="true">
      <defs>
        <radialGradient id="lisSky" cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor={isDark ? '#1b2140' : '#f3f0fc'} />
          <stop offset="100%" stopColor={sky} />
        </radialGradient>
        <radialGradient id="lisPlanet" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="55%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0369a1" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="240" height="160" rx="24" fill="url(#lisSky)" />

      {[
        [22, 20], [200, 18], [60, 42], [180, 58], [24, 90], [210, 100], [140, 24], [96, 16],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill={starColor} opacity={0.8} />
      ))}

      <circle cx="70" cy="118" r="46" fill="url(#lisPlanet)" opacity={isDark ? 0.9 : 0.85} />
      <ellipse cx="55" cy="102" rx="16" ry="6" fill="#e0f2fe" opacity="0.35" />

      <motion.g
        animate={{ y: [0, -10, 0], rotate: [-4, 4, -4] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <line x1="150" y1="40" x2="168" y2="70" stroke={isDark ? '#475569' : '#C4B5FD'} strokeWidth="2" strokeDasharray="3 3" />
        <circle cx="168" cy="78" r="16" fill={isDark ? '#1e293b' : '#ffffff'} stroke={isDark ? '#475569' : '#C4B5FD'} strokeWidth="2" />
        <circle cx="168" cy="78" r="9" fill={isDark ? '#0f172a' : '#DCC9FA'} />
        <circle cx="171" cy="75" r="3" fill={isDark ? '#38bdf8' : '#7C3AED'} opacity="0.7" />
        <rect x="156" y="92" width="24" height="20" rx="8" fill={isDark ? '#e2e8f0' : '#ffffff'} stroke={isDark ? '#475569' : '#C4B5FD'} strokeWidth="2" />
        <rect x="150" y="96" width="8" height="5" rx="2.5" fill={isDark ? '#e2e8f0' : '#ffffff'} stroke={isDark ? '#475569' : '#C4B5FD'} strokeWidth="1.5" />
        <rect x="182" y="96" width="8" height="5" rx="2.5" fill={isDark ? '#e2e8f0' : '#ffffff'} stroke={isDark ? '#475569' : '#C4B5FD'} strokeWidth="1.5" />
      </motion.g>
    </svg>
  );
}
