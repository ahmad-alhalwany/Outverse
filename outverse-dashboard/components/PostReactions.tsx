"use client"

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

const reactions = [
  { emoji: '💡', label: 'Inspired', color: '#FFD700' },
  { emoji: '🌌', label: 'Cosmic', color: '#4B0082' },
  { emoji: '🌀', label: 'Mind-Bending', color: '#00CED1' },
  { emoji: '🌱', label: 'Growing', color: '#32CD32' },
  { emoji: '✨', label: 'Spark', color: '#FF69B4' },
];

interface PostReactionsProps {
  onReaction: (reaction: string) => void;
}

export default function PostReactions({ onReaction }: PostReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);

  const handleReaction = (reaction: string) => {
    setSelectedReaction(reaction);
    onReaction(reaction);
    setTimeout(() => setIsOpen(false), 1000);
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
      >
        <span>💫</span>
        <span className="text-sm">React</span>
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
                      scale: [1, 1.5, 1],
                      rotate: [0, 360],
                    } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    {reaction.emoji}
                  </motion.span>
                  <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {reaction.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedReaction && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-10 left-1/2 transform -translate-x-1/2"
        >
          <motion.span
            className="text-3xl"
            animate={{
              y: [-20, 0],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 1 }}
          >
            {selectedReaction}
          </motion.span>
        </motion.div>
      )}
    </div>
  );
} 