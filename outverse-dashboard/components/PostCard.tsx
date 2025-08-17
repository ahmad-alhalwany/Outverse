'use client';

import { motion } from 'framer-motion';
import PostReactions from './PostReactions';
import Comments from './Comments';
import { useState, useEffect } from 'react';
import ShareBottleAnimation from './ShareBottleAnimation';
import Slider from './Slider';
import LinkPreview from './LinkPreview';
import { formatRelativeTime } from '../utils/dateFormatter';
import CosmicVideoPlayer from './CosmicVideoPlayer';

interface PostCardProps {
  id: number;
  user: {
    name: string;
    avatar: string;
  };
  time: string;
  text: string;
  images?: string[];
  videos?: string[];
  audio?: string;
  description?: string;
  stats: {
    views: number;
    comments: number;
    shares: number;
  };
}

// Mock user data for now - this should come from authentication context
const mockUser = { id: 1, name: 'Current User' };

const reactionList = [
  { emoji: '💡', label: 'Inspired', color: '#FFD700' },
  { emoji: '🌌', label: 'Cosmic', color: '#4B0082' },
  { emoji: '🌀', label: 'Mind-Bending', color: '#00CED1' },
  { emoji: '🌱', label: 'Growing', color: '#32CD32' },
  { emoji: '✨', label: 'Spark', color: '#FF69B4' },
];

export default function PostCard({ id, user, time, text, images, videos, audio, description, stats }: PostCardProps) {
  const [showShareAnim, setShowShareAnim] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<{emoji: string, label: string} | null>(null);
  const [commentsCount, setCommentsCount] = useState(stats.comments);

  // دمج الصور والفيديوهات في مصفوفة واحدة مرتبة
  const media = [
    ...(images || []).map((url) => ({ type: 'image', url })),
    ...(videos || []).map((url) => ({ type: 'video', url })),
  ];
  const [imgIdx, setImgIdx] = useState(0);
  const hasMedia = media.length > 0;
  const nextMedia = () => setImgIdx(i => hasMedia ? (i + 1) % media.length : 0);
  const prevMedia = () => setImgIdx(i => hasMedia ? (i - 1 + media.length) % media.length : 0);
  const surpriseMedia = () => setImgIdx(() => hasMedia ? Math.floor(Math.random() * media.length) : 0);
  useEffect(() => { setImgIdx(0); }, [images, videos]);

  const handleReaction = (reactionEmoji: string) => {
    // ابحث عن التفاعل المختار من القائمة
    const found = reactionList.find(r => r.emoji === reactionEmoji);
    if (found) setSelectedReaction({ emoji: found.emoji, label: found.label });
    else setSelectedReaction(null);
  };



  const handleShare = () => {
    setShowShareAnim(true);
  };

  const handleCloseShare = () => {
    setShowShareAnim(false);
  };

  // تقسيم النص إلى كلمات
  const words = text.split(' ');

  // متغيرات Framer Motion
  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
      },
    },
  };
  const wordAnim = {
    hidden: (i: number) => ({ opacity: 0, y: 20 * Math.sin(i * 0.5) }),
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 20, delay: i * 0.02 } }),
  };

  // استخراج أول رابط من النص
  const urlMatch = text.match(/https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=%]+/i);
  const firstUrl = urlMatch ? urlMatch[0] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ boxShadow: '0 8px 32px 0 rgba(80,120,255,0.18)' }}
      className="bg-white rounded-xl shadow p-6 mb-6 transition-all duration-300"
    >
      <div className="flex items-center mb-4">
        <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full mr-3" />
        <div>
          <div className="font-semibold text-gray-900">{user.name}</div>
          <div className="text-xs text-gray-400">{time}</div>
        </div>
      </div>
      <div className="mb-4">
        {/* نص متحرك كلمة كلمة مع تأثير wave وhover */}
        <motion.p
          className="text-gray-800 mb-2 flex flex-wrap gap-x-1 gap-y-2"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          {words.map((word, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={wordAnim}
              className="inline-block cursor-pointer transition-colors duration-200"
              whileHover={{ y: -6, color: '#1976d2' }}
            >
              {word}
            </motion.span>
          ))}
        </motion.p>
        {firstUrl && <LinkPreview url={firstUrl} />}
        {/* في مكان عرض الصور: */}
        {hasMedia && (
          <div className="relative w-full flex flex-col items-center">
            <div className="rounded-2xl overflow-hidden shadow-lg bg-black/80 flex items-center justify-center" style={{ minHeight: 320, minWidth: 320, maxHeight: 480 }}>
              {media[imgIdx].type === 'image' ? (
                <img src={media[imgIdx].url} alt="media" className="object-cover w-full h-full" style={{ maxHeight: 480 }} />
              ) : (
                <CosmicVideoPlayer src={media[imgIdx].url} />
              )}
            </div>
            {/* أزرار التنقل */}
            {media.length > 1 && (
              <>
                <button onClick={prevMedia} className="absolute left-2 top-1/2 -translate-y-1/2 bg-purple-500/80 text-white rounded-full p-2 shadow-lg z-10">&#8592;</button>
                <button onClick={nextMedia} className="absolute right-2 top-1/2 -translate-y-1/2 bg-purple-500/80 text-white rounded-full p-2 shadow-lg z-10">&#8594;</button>
                <button onClick={surpriseMedia} className="absolute top-2 left-1/2 -translate-x-1/2 bg-green-700/80 text-white rounded-full px-4 py-1 shadow">Surprise Me 🚀</button>
              </>
            )}
            {/* نقاط السلايدر */}
            {media.length > 1 && (
              <div className="flex gap-2 mt-4">
                {media.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`w-3 h-3 rounded-full transition-all duration-200 ${i === imgIdx ? 'bg-purple-500 scale-125 shadow-lg' : 'bg-gray-400/50'}`}
                    aria-label={`Go to media ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {/* عرض الصوت */}
        {audio && (
          <audio controls className="w-full mt-2">
            <source src={audio} />
            Your browser does not support the audio element.
          </audio>
        )}
        {/* عرض description */}
        {description && (
          <div className="text-gray-600 text-sm mt-2 whitespace-pre-line">{description}</div>
        )}
      </div>
      <div className="flex items-center space-x-6 text-gray-500 text-sm">
        <div className="flex items-center space-x-2">
          {selectedReaction ? (
            <button
              type="button"
              onClick={() => setSelectedReaction(null)}
              className="flex items-center space-x-2 focus:outline-none group"
              style={{ color: selectedReaction ? reactionList.find(r => r.emoji === selectedReaction.emoji)?.color : undefined }}
              title="Change your reaction"
            >
              <span className="text-xl group-hover:scale-125 transition-transform duration-200">{selectedReaction.emoji}</span>
              <span className="font-semibold text-base group-hover:underline">{selectedReaction.label}</span>
            </button>
          ) : (
            <PostReactions onReaction={handleReaction} />
          )}
        </div>
        <div className="flex items-center space-x-1">
          <span>👁️</span>
          <span>{stats.views}</span>
        </div>
        <button onClick={handleShare} className="flex items-center space-x-1 hover:text-lab transition">
          <span>🚀</span>
          <span>Share</span>
        </button>
        <div className="flex items-center space-x-1">
          <span>🔗</span>
          <span>{stats.shares}</span>
        </div>
        <div className="flex items-center space-x-1">
          <span>💬</span>
          <span>{commentsCount}</span>
        </div>
      </div>
      {showShareAnim && <ShareBottleAnimation onClose={handleCloseShare} />}
      <Comments 
        postId={id}
        user={mockUser}
        postOwner={{ id: 1, name: user.name }}
        onCommentsCountUpdate={setCommentsCount}
      />
    </motion.div>
  );
} 