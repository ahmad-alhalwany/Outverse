"use client"

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';

interface Comment {
  id: number;
  user: {
    name: string;
    avatar: string;
  };
  text: string;
  time: string;
}

interface CommentsProps {
  comments: Comment[];
  onAddComment: (text: string) => void;
}

export default function Comments({ comments, onAddComment }: CommentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment);
      setNewComment('');
    }
  };

  return (
    <div className="mt-4">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-gray-500 hover:text-gray-700"
      >
        <span>💬</span>
        <span className="text-sm">Comments ({comments.length})</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-4"
          >
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <motion.input
                whileFocus={{ scale: 1.02 }}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-lab"
              />
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                type="submit"
                className="px-4 py-2 bg-lab text-white rounded-lg"
              >
                Send
              </motion.button>
            </form>

            <div className="space-y-4">
              {comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex space-x-3"
                >
                  <img
                    src={comment.user.avatar}
                    alt={comment.user.name}
                    className="w-8 h-8 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="font-semibold text-sm">{comment.user.name}</div>
                      <p className="text-sm text-gray-700">{comment.text}</p>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{comment.time}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 