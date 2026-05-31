'use client';

import { motion, AnimatePresence } from 'framer-motion';
<<<<<<< HEAD
import { useState, useRef, useEffect } from 'react';
import useSound from './useSound';
import { COSMIC_REACTIONS } from '@/lib/reactions';
import { useLocale } from './LocaleProvider';
=======
import { useState, useRef } from 'react';
import useSound from "./useSound";

const reactions = [
  { emoji: '💡', label: 'Inspired', color: '#FFD700', sound: '/sounds/bubblepop-254773.mp3' },
  { emoji: '🌌', label: 'Cosmic', color: '#4B0082', sound: '/sounds/shine-11-268907.mp3' },
  { emoji: '🌀', label: 'Mind-Bending', color: '#00CED1', sound: '/sounds/mystical-chime-196405.mp3' },
  { emoji: '🌱', label: 'Growing', color: '#32CD32', sound: '/sounds/sound-effects-finger-snap-without-reverb-113862.mp3' },
  { emoji: '✨', label: 'Spark', color: '#FF69B4', sound: '/sounds/logo-transparent-139678.mp3' },
];
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660

interface PostReactionsProps {
  onReaction: (reaction: string) => void;
  selectedReaction?: string;
  reactionCounts?: Record<string, number>;
  compact?: boolean;
}

export default function PostReactions({
  onReaction,
  selectedReaction,
  reactionCounts = {},
  compact = false,
}: PostReactionsProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
<<<<<<< HEAD
  const [burst, setBurst] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

=======
  const [cosmicBurst, setCosmicBurst] = useState<{ x: number; y: number; key: number } | null>(null);
  const burstKey = useRef(0);
  // أصوات التفاعلات
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
  const playSounds: Record<string, () => void> = {
    '💡': useSound(COSMIC_REACTIONS[0].sound, 0.45),
    '🌌': useSound(COSMIC_REACTIONS[1].sound, 0.45),
    '🌀': useSound(COSMIC_REACTIONS[2].sound, 0.45),
    '🌱': useSound(COSMIC_REACTIONS[3].sound, 0.45),
    '✨': useSound(COSMIC_REACTIONS[4].sound, 0.45),
  };

<<<<<<< HEAD
  const selected = selectedReaction
    ? COSMIC_REACTIONS.find((r) => r.emoji === selectedReaction)
    : null;

  const summary = Object.entries(reactionCounts).filter(([, n]) => n > 0);
  const total = summary.reduce((s, [, n]) => s + n, 0);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isOpen]);

  const pick = (emoji: string) => {
    playSounds[emoji]?.();
    onReaction(emoji);
    setBurst((k) => k + 1);
    setTimeout(() => setIsOpen(false), 400);
=======
  const handleReaction = (reaction: string) => {
    if (playSounds[reaction]) playSounds[reaction]();
    onReaction(reaction);
    // تأثير كوني: نجوم متطايرة
    setCosmicBurst({ x: Math.random() * 40 - 20, y: -30 + Math.random() * 10, key: burstKey.current++ });
    setTimeout(() => setIsOpen(false), 1000);
    setTimeout(() => setCosmicBurst(null), 700);
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
  };

  const triggerLabel = selected ? (
    <>
      <motion.span
        key={burst}
        className="text-lg leading-none"
        initial={{ scale: 0.6 }}
        animate={{ scale: [1, 1.35, 1] }}
        transition={{ duration: 0.35 }}
      >
        {selected.emoji}
      </motion.span>
      {!compact && <span>{selected.label}</span>}
      {total > 0 && <span className="opacity-80">{total}</span>}
    </>
  ) : (
    <>
      <span className="text-lg">✨</span>
      {!compact && <span>{t('feed.react')}</span>}
      {total > 0 && <span className="opacity-70">{total}</span>}
    </>
  );

  return (
    <div className="cosmic-reactions" ref={wrapRef}>
      <motion.button
<<<<<<< HEAD
        type="button"
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          if (selectedReaction) onReaction(selectedReaction);
          else setIsOpen((o) => !o);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsOpen(true);
        }}
        className={`cosmic-reactions__trigger${selected ? ' cosmic-reactions__trigger--picked' : ''}`}
        style={selected ? { color: selected.color, borderColor: `${selected.color}55` } : undefined}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {triggerLabel}
=======
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 1.2, boxShadow: '0 0 16px 4px #a78bfa, 0 0 32px 8px #38bdf8' }}
        onClick={() => selectedReaction ? onReaction(selectedReaction) : setIsOpen(!isOpen)}
        className={`flex items-center space-x-2 relative ${selectedReaction ? 'text-lab font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
        style={{ color: selectedReactionDetails?.color }}
      >
        {/* تأثير كوني: نجوم متطايرة عند التفاعل */}
        {cosmicBurst && (
          <motion.span
            key={cosmicBurst.key}
            initial={{ opacity: 1, scale: 0.7, x: 0, y: 0 }}
            animate={{ opacity: 0, scale: 1.8, x: cosmicBurst.x, y: cosmicBurst.y }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="absolute left-1/2 top-1/2 pointer-events-none"
            style={{ zIndex: 20 }}
          >
            <span className="text-yellow-300 text-lg drop-shadow-glow">★</span>
            <span className="text-blue-400 text-base drop-shadow-glow">✦</span>
            <span className="text-pink-400 text-base drop-shadow-glow">✧</span>
          </motion.span>
        )}
        {selectedReaction ? (
          <>
            <span className="text-xl">{selectedReaction}</span>
            <span className="text-sm">{selectedReactionDetails?.label}</span>
            {reactionCounts && reactionCounts[selectedReaction] > 0 && (
              <span className="text-sm ml-1">({reactionCounts[selectedReaction]})</span>
            )}
          </>
        ) : (
          <>
            <span>💫</span>
            <span className="text-sm">React</span>
            {reactionCounts && Object.values(reactionCounts).some(count => count > 0) && (
              <div className="flex items-center space-x-1 ml-2">
                {Object.entries(reactionCounts).map(([reaction, count]) => count > 0 && (
                  <div key={reaction} className="flex items-center">
                    <span className="text-sm">{reaction}</span>
                    <span className="text-xs ml-1">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
      </motion.button>

      {summary.length > 0 && (
        <div className="cosmic-reactions__summary">
          {summary.map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              className={`cosmic-reactions__pill${selectedReaction === emoji ? ' cosmic-reactions__pill--mine' : ''}`}
              onClick={() => pick(emoji)}
              title={`${count} reaction${count !== 1 ? 's' : ''}`}
            >
              <span>{emoji}</span>
              <span>{count}</span>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="cosmic-reactions__orbit"
            role="menu"
          >
            <div className="cosmic-reactions__orbit-inner">
              {COSMIC_REACTIONS.map((r) => (
                <motion.button
                  key={r.emoji}
                  type="button"
                  role="menuitem"
                  className={`cosmic-reactions__orb-btn${selectedReaction === r.emoji ? ' cosmic-reactions__orb-btn--active' : ''}`}
                  style={{ '--orb-color': r.color } as React.CSSProperties}
                  whileHover={{ scale: 1.12, y: -4 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => pick(r.emoji)}
                >
<<<<<<< HEAD
                  <span>{r.emoji}</span>
                  <span className="cosmic-reactions__orb-label">{r.label}</span>
=======
                  <motion.span
                    className="text-2xl"
                    animate={selectedReaction === reaction.emoji ? {
                      scale: [1, 1.8, 1.2, 1],
                      rotate: [0, 360],
                      filter: [
                        'drop-shadow(0 0 8px #a78bfa)',
                        'drop-shadow(0 0 16px #38bdf8)',
                        'drop-shadow(0 0 8px #a78bfa)',
                        'none'
                      ]
                    } : {}}
                    transition={{ duration: 0.7 }}
                  >
                    {reaction.emoji}
                  </motion.span>
                  <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {reaction.label}
                    {reactionCounts && reactionCounts[reaction.emoji] > 0 && ` (${reactionCounts[reaction.emoji]})`}
                  </span>
>>>>>>> e510d1e377ae974ece29ee583e54641c26f00660
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
