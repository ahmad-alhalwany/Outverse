'use client';

import { motion } from 'framer-motion';

export type MapDot = {
  id: number | string;
  x: number; // 0-100 (% from left)
  y: number; // 0-100 (% from top)
  color: string;
  emoji: string;
  place?: string;
};

interface MoodMapProps {
  dots: MapDot[];
  className?: string;
  height?: number | string;
  variant?: 'dark' | 'light';
}

/**
 * A stylised, dependency-free "global mood map".
 * Supports a dark cosmic look and a soft light look.
 * A real interactive map (Leaflet/Mapbox) can replace this later
 * without touching the page layout.
 */
export default function MoodMap({
  dots,
  className = '',
  height = '100%',
  variant = 'dark',
}: MoodMapProps) {
  const light = variant === 'light';

  const containerStyle = light
    ? {
        height,
        background:
          'radial-gradient(120% 120% at 30% 10%, #eef2f7 0%, #e4e9f0 60%, #dde3ec 100%)',
        border: '1px solid rgba(120,120,140,0.18)',
        boxShadow: 'inset 0 0 60px rgba(150,160,180,0.25)',
      }
    : {
        height,
        background:
          'radial-gradient(120% 120% at 20% 10%, #1b2550 0%, #121734 55%, #0b0f24 100%)',
        border: '1px solid rgba(0,204,255,0.18)',
        boxShadow: 'inset 0 0 80px rgba(0,0,0,0.45)',
      };

  const gridColor = light ? 'rgba(120,130,150,0.12)' : 'rgba(120,160,255,0.06)';
  const continent = light ? 'rgba(180,190,205,0.55)' : 'rgba(70,90,160,0.32)';

  return (
    <div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={containerStyle}
    >
      {/* faint grid (latitude / longitude) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />

      {/* blurred "continents" */}
      <div className="absolute pointer-events-none" style={{ left: '8%', top: '24%', width: 180, height: 120, background: continent, filter: 'blur(28px)', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ left: '46%', top: '14%', width: 220, height: 150, background: continent, filter: 'blur(34px)', borderRadius: '50%' }} />
      <div className="absolute pointer-events-none" style={{ left: '62%', top: '52%', width: 160, height: 120, background: continent, filter: 'blur(30px)', borderRadius: '50%' }} />

      {/* glowing emotion dots */}
      {dots.map((dot, i) => (
        <motion.div
          key={dot.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 group"
          style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 200 }}
        >
          <motion.span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: 22, height: 22, background: dot.color, opacity: 0.25 }}
            animate={{ scale: [1, 2.2, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.2 }}
          />
          <span
            className="relative block rounded-full"
            style={{
              width: 12,
              height: 12,
              background: dot.color,
              boxShadow: `0 0 12px 2px ${dot.color}`,
              border: light ? '2px solid rgba(255,255,255,0.85)' : 'none',
            }}
          />
          <span
            className="absolute left-1/2 -translate-x-1/2 -top-9 whitespace-nowrap px-2 py-1 rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={
              light
                ? { background: '#ffffff', color: '#5b4636', border: `1px solid ${dot.color}66`, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }
                : { background: 'rgba(10,12,30,0.95)', color: '#cfd6ff', border: `1px solid ${dot.color}55` }
            }
          >
            {dot.emoji} {dot.place}
          </span>
        </motion.div>
      ))}
    </div>
  );
}
