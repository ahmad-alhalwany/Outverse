'use client';

import { motion } from 'framer-motion';
import PostReactions from './PostReactions';
import Comments from './Comments';

interface PostCardProps {
  user: {
    name: string;
    avatar: string;
  };
  time: string;
  text: string;
  image: string;
  stats: {
    views: number;
    comments: number;
    shares: number;
  };
}

const mockComments = [
  {
    id: 1,
    user: {
      name: 'Alex Chen',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    text: 'This is amazing! The colors are so vibrant.',
    time: '1 hour ago',
  },
  {
    id: 2,
    user: {
      name: 'Maria Garcia',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    text: 'I love how you captured the essence of creativity here.',
    time: '45 minutes ago',
  },
];

export default function PostCard({ user, time, text, image, stats }: PostCardProps) {
  const handleReaction = (reaction: string) => {
    console.log(`User reacted with: ${reaction}`);
  };

  const handleAddComment = (text: string) => {
    console.log(`New comment: ${text}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow p-6 mb-6"
    >
      <div className="flex items-center mb-4">
        <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full mr-3" />
        <div>
          <div className="font-semibold text-gray-900">{user.name}</div>
          <div className="text-xs text-gray-400">{time}</div>
        </div>
      </div>
      <div className="mb-4">
        <p className="text-gray-800 mb-2">{text}</p>
        <motion.img
          whileHover={{ scale: 1.02 }}
          src={image}
          alt="post"
          className="rounded-lg w-full object-cover max-h-96"
        />
      </div>
      <div className="flex items-center space-x-6 text-gray-500 text-sm">
        <PostReactions onReaction={handleReaction} />
        <div className="flex items-center space-x-1">
          <span>👁️</span>
          <span>{stats.views}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>🔗</span>
          <span>{stats.shares}</span>
        </div>
      </div>
      <Comments comments={mockComments} onAddComment={handleAddComment} />
    </motion.div>
  );
} 