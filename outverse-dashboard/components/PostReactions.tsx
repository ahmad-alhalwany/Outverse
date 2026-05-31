'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import useSound from './useSound';
import { COSMIC_REACTIONS } from '@/lib/reactions';
import { useLocale } from './LocaleProvider';

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
  const [burst, setBurst] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const playSounds: Record<string, () => void> = {
    '💡': useSound(COSMIC_REACTIONS[0].sound, 0.45),
    '🌌': useSound(COSMIC_REACTIONS[1].sound, 0.45),
    '🌀': useSound(COSMIC_REACTIONS[2].sound, 0.45),
    '🌱': useSound(COSMIC_REACTIONS[3].sound, 0.45),
    '✨': useSound(COSMIC_REACTIONS[4].sound, 0.45),
  };

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
                  <span>{r.emoji}</span>
                  <span className="cosmic-reactions__orb-label">{r.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
