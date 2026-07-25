'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function NotFound() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#0b0f24 0%,#141a3a 55%,#1b1340 100%)', color: '#fff' }}
    >
      {/* Drifting stars - reduced count, only if no reduced motion preference */}
      {!reduceMotion &&
        Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full animate-404-star"
            style={{
              left: `${(i * 73) % 100}%`,
              top: `${(i * 47) % 100}%`,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              background: i % 3 === 0 ? '#a259ff' : i % 3 === 1 ? '#22d3ee' : '#fff',
              opacity: 0.3 + (i % 5) * 0.12,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2.5 + (i % 3)}s`,
            }}
          />
        ))}

      {/* CSS-only static star field fallback */}
      {reduceMotion && (
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:
            'radial-gradient(circle at 20% 30%, #fff2 1px, transparent 1px), radial-gradient(circle at 60% 70%, #fff3 1.5px, transparent 1.5px), radial-gradient(circle at 80% 20%, #a259ff44 2px, transparent 2px)',
          backgroundSize: '200px 200px',
          opacity: 0.6,
        }} />
      )}

      {/* Floating astronaut - static when reduced motion */}
      <div
        className="text-8xl mb-6 relative z-10"
        style={reduceMotion ? undefined : { animation: 'float 6s ease-in-out infinite' }}
      >
        🧑‍🚀
      </div>

      <h1
        className="text-6xl font-bold relative z-10 bg-clip-text text-transparent"
        style={{
          backgroundImage: 'linear-gradient(to right, #00CCFF, #6A00FF)',
          WebkitBackgroundClip: 'text',
        }}
      >
        404
      </h1>
      <h2 className="text-2xl font-semibold mt-3 relative z-10">Lost in the Cosmory</h2>
      <p className="mt-2 max-w-md relative z-10" style={{ color: '#aab2e0' }}>
        Looks like you&apos;ve drifted into unknown territory. Let&apos;s guide you back to a familiar galaxy.
      </p>

      <Link
        href="/"
        prefetch={true}
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white relative z-10 transition-transform hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-white/50 outline-none"
        style={{
          background: 'var(--gradient-accent-h, linear-gradient(90deg,#6A00FF,#00CCFF))',
          boxShadow: '0 8px 28px #6A00FF55',
        }}
      >
        🚀 Return to Home
      </Link>
    </div>
  );
}