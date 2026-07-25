'use client';

import { motion } from 'framer-motion';
import { useEffect } from 'react';

type Props = {
  emoji: string;
  x: number;
  y: number;
  onDone?: () => void;
};

/** Instagram-style floating burst at tap coordinates. */
export default function ReactionBurst({ emoji, x, y, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 900);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="reaction-burst-layer" aria-hidden>
      <motion.span
        className="reaction-burst__main"
        style={{ left: x, top: y }}
        initial={{ scale: 0.2, opacity: 0 }}
        animate={{ scale: [0.2, 1.35, 1], opacity: [0, 1, 0] }}
        transition={{ duration: 0.75, ease: 'easeOut' }}
      >
        {emoji}
      </motion.span>
      {particles.map((i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dx = Math.cos(angle) * (36 + i * 4);
        const dy = Math.sin(angle) * (36 + i * 4);
        return (
          <motion.span
            key={i}
            className="reaction-burst__particle"
            style={{ left: x, top: y }}
            initial={{ scale: 0, opacity: 0.9, x: 0, y: 0 }}
            animate={{ scale: [0, 1, 0.4], opacity: [0.9, 0.6, 0], x: dx, y: dy }}
            transition={{ duration: 0.65, delay: i * 0.02, ease: 'easeOut' }}
          >
            ✦
          </motion.span>
        );
      })}
    </div>
  );
}
