"use client"

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef } from 'react';
import useSound from "./useSound";

const reactions = [
  { emoji: '💡', label: 'Inspired', color: '#FFD700', sound: '/sounds/bubblepop-254773.mp3' },
  { emoji: '🌌', label: 'Cosmic', color: '#4B0082', sound: '/sounds/shine-11-268907.mp3' },
  { emoji: '🌀', label: 'Mind-Bending', color: '#00CED1', sound: '/sounds/mystical-chime-196405.mp3' },
  { emoji: '🌱', label: 'Growing', color: '#32CD32', sound: '/sounds/sound-effects-finger-snap-without-reverb-113862.mp3' },
  { emoji: '✨', label: 'Spark', color: '#FF69B4', sound: '/sounds/logo-transparent-139678.mp3' },
];

interface PostReactionsProps {
  onReaction: (reaction: string) => void;
  selectedReaction?: string;
  reactionCounts?: { [key: string]: number };
}

export default function PostReactions({ onReaction, selectedReaction, reactionCounts }: PostReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cosmicBurst, setCosmicBurst] = useState<{ x: number; y: number; key: number } | null>(null);
  const burstKey = useRef(0);
  // أصوات التفاعلات
  const playSounds: Record<string, () => void> = {
    '💡': useSound(reactions[0].sound, 0.5),
    '🌌': useSound(reactions[1].sound, 0.5),
    '🌀': useSound(reactions[2].sound, 0.5),
    '🌱': useSound(reactions[3].sound, 0.5),
    '✨': useSound(reactions[4].sound, 0.5),
  };

  const handleReaction = (reaction: string) => {
    if (playSounds[reaction]) playSounds[reaction]();
    onReaction(reaction);
    // تأثير كوني: نجوم متطايرة
    setCosmicBurst({ x: Math.random() * 40 - 20, y: -30 + Math.random() * 10, key: burstKey.current++ });
    setTimeout(() => setIsOpen(false), 1000);
    setTimeout(() => setCosmicBurst(null), 700);
  };

  // Find the selected reaction details
  const selectedReactionDetails = selectedReaction ? reactions.find(r => r.emoji === selectedReaction) : null;

  return (
    <div className="relative">
      <motion.button
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
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg p-2"
          >
            <div className="flex space-x-2">
              {reactions.map((reaction) => (
                <motion.button
                  key={reaction.emoji}
                  whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
                  whileTap={{ scale: 0.8 }}
                  onClick={() => handleReaction(reaction.emoji)}
                  className="relative group"
                >
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
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 