'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect, useCallback } from 'react';
import useSound from './useSound';
import ReactorsModal from './ReactorsModal';
import {
  COSMIC_REACTIONS,
  hapticReaction,
  type ReactionType,
} from '@/lib/reactions';
import type { ReactionContentType } from '@/lib/reactionsApi';
import { useLocale } from './LocaleProvider';

interface PostReactionsProps {
  onReaction: (reaction: string) => void;
  selectedReaction?: string;
  reactionCounts?: Record<string, number>;
  compact?: boolean;
  variant?: 'default' | 'reel';
  contentType?: ReactionContentType;
  contentId?: number;
}

const LONG_PRESS_MS = 420;

export default function PostReactions({
  onReaction,
  selectedReaction,
  reactionCounts = {},
  compact = false,
  variant = 'default',
  contentType,
  contentId,
}: PostReactionsProps) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const [particles, setParticles] = useState<{ id: number; emoji: string }[]>([]);
  const [showReactors, setShowReactors] = useState(false);
  const [reactorFilter, setReactorFilter] = useState<ReactionType | 'all'>('all');
  const wrapRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

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

  const spawnParticles = (emoji: string) => {
    const batch = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      emoji: i % 2 === 0 ? emoji : '✦',
    }));
    setParticles((p) => [...p, ...batch]);
    setTimeout(() => setParticles((p) => p.filter((x) => !batch.some((b) => b.id === x.id))), 700);
  };

  const pick = (emoji: string) => {
    playSounds[emoji]?.();
    hapticReaction('medium');
    onReaction(emoji);
    setBurst((k) => k + 1);
    spawnParticles(emoji);
    setTimeout(() => setIsOpen(false), 350);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    longPressTriggered.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      hapticReaction('light');
      setIsOpen(true);
    }, LONG_PRESS_MS);
  };

  const onTriggerClick = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    // Reels: tap = quick spark (TikTok-style). Long-press opens the full orbit.
    if (variant === 'reel') {
      pick(selectedReaction || '✨');
      return;
    }
    if (selectedReaction) {
      pick(selectedReaction);
    } else {
      setIsOpen((o) => !o);
    }
  };

  const openReactors = (type: ReactionType | 'all') => {
    if (!contentId || !contentType) return;
    setReactorFilter(type);
    setShowReactors(true);
  };

  const triggerLabel = selected ? (
    <>
      <motion.span
        key={burst}
        className="text-lg leading-none"
        initial={{ scale: 0.5, rotate: -12 }}
        animate={{ scale: [1, 1.4, 1], rotate: [0, 8, 0] }}
        transition={{ duration: 0.4, type: 'spring' }}
      >
        {selected.emoji}
      </motion.span>
      {!compact && <span className="hidden sm:inline">{t(`reactions.${selected.type}` as 'reactions.spark')}</span>}
      {variant !== 'reel' && total > 0 && <span className="opacity-80">{total}</span>}
    </>
  ) : (
    <>
      <span className="text-lg cosmic-reactions__idle">✨</span>
      {!compact && <span className="hidden sm:inline">{t('feed.react')}</span>}
      {variant !== 'reel' && total > 0 && <span className="opacity-70">{total}</span>}
    </>
  );

  return (
    <div
      className={`cosmic-reactions${variant === 'reel' ? ' cosmic-reactions--reel' : ''}`}
      ref={wrapRef}
    >
      <div className="cosmic-reactions__particles" aria-hidden>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="cosmic-reactions__particle"
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.2, y: -28 - Math.random() * 20 }}
            transition={{ duration: 0.65 }}
          >
            {p.emoji}
          </motion.span>
        ))}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={onTriggerClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsOpen(true);
        }}
        onPointerDown={startLongPress}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
        className={`cosmic-reactions__trigger${selected ? ' cosmic-reactions__trigger--picked' : ''}`}
        style={
          selected
            ? {
                color: selected.color,
                borderColor: `${selected.color}55`,
                boxShadow: `0 0 22px ${selected.color}44`,
              }
            : undefined
        }
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t('feed.react')}
      >
        {triggerLabel}
      </motion.button>

      {summary.length > 0 && (
        <div className="cosmic-reactions__summary">
          {summary.map(([emoji, count]) => {
            const meta = COSMIC_REACTIONS.find((r) => r.emoji === emoji);
            return (
              <button
                key={emoji}
                type="button"
                className={`cosmic-reactions__pill${selectedReaction === emoji ? ' cosmic-reactions__pill--mine' : ''}`}
                onClick={() => {
                  if (contentId && contentType) {
                    openReactors(meta?.type ?? 'all');
                  } else {
                    pick(emoji);
                  }
                }}
                title={t('reactions.tapToSee', { count: String(count) })}
              >
                <span>{emoji}</span>
                <span>{count}</span>
              </button>
            );
          })}
          {contentId && contentType && total > 0 && (
            <button
              type="button"
              className="cosmic-reactions__see-all"
              onClick={() => openReactors('all')}
            >
              {t('reactions.seeAll')}
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: variant === 'reel' ? 0 : 10, x: variant === 'reel' ? 10 : 0, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 480, damping: 26 }}
            className={`cosmic-reactions__orbit${variant === 'reel' ? ' cosmic-reactions__orbit--reel' : ''}`}
            role="menu"
          >
            <p className="cosmic-reactions__orbit-hint">{t('reactions.pickVibe')}</p>
            <div className="cosmic-reactions__orbit-inner">
              {COSMIC_REACTIONS.map((r, i) => (
                <motion.button
                  key={r.emoji}
                  type="button"
                  role="menuitem"
                  className={`cosmic-reactions__orb-btn${selectedReaction === r.emoji ? ' cosmic-reactions__orb-btn--active' : ''}`}
                  style={{ '--orb-color': r.color, '--orb-i': i } as React.CSSProperties}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, type: 'spring', stiffness: 400 }}
                  whileHover={{ scale: 1.18, y: -6 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => pick(r.emoji)}
                >
                  <span className="cosmic-reactions__orb-emoji">{r.emoji}</span>
                  <span className="cosmic-reactions__orb-label">{t(`reactions.${r.type}` as 'reactions.spark')}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {contentId && contentType && (
        <ReactorsModal
          open={showReactors}
          onClose={() => setShowReactors(false)}
          contentType={contentType}
          contentId={contentId}
          initialFilter={reactorFilter}
        />
      )}
    </div>
  );
}
