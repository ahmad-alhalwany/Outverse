'use client';

import { motion } from 'framer-motion';
import PostReactions from './PostReactions';
import Comments from './Comments';
import { useState, useEffect } from 'react';
import ShareBottleAnimation from './ShareBottleAnimation';
import Slider from './Slider';
import LinkPreview from './LinkPreview';

interface PostCardProps {
  user: {
    name: string;
    avatar: string;
  };
  time: string;
  text: string;
  images?: string[];
  image?: string;
  video?: string;
  audio?: string;
  description?: string;
  stats: {
    views: number;
    comments: number;
    shares: number;
  };
}

// Define the Comment type explicitly for reuse
type CommentType = {
  id: number;
  user: { id: number; name: string; avatar: string; };
  text: string;
  time: string;
  images?: string[];
  image?: string;
  video?: string;
  audio?: string;
  description?: string;
  gifUrl?: string;
  stickerUrl?: string;
  style?: React.CSSProperties;
  replies?: CommentType[];
};

const mockCommentsData: CommentType[] = [
  {
    id: 1,
    user: {
      id: 101,
      name: 'Alex Chen',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    text: 'This is amazing! The colors are so vibrant.',
    time: '1 hour ago',
    images: [
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
      'https://images.unsplash.com/photo-1465101046530-73398c7f28ca',
      'https://images.unsplash.com/photo-1519125323398-675f0ddb6308',
      'https://images.unsplash.com/photo-1465101178521-c3a6088ed0c4',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429',
      'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8c3BhY2V8ZW58MHx8MHx8',
      'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?ixid=MnwxMjA3fDB8MHxzZWFyY2h8M3x8c3BhY2V8ZW58MHx8MHx8',
    ],
    replies: [],
  },
  {
    id: 2,
    user: {
      id: 102,
      name: 'Maria Garcia',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    text: 'I love how you captured the essence of creativity here.',
    time: '45 minutes ago',
    image: 'https://images.unsplash.com/photo-1519125323398-675f0ddb6308',
    replies: [],
  },
  {
    id: 3,
    user: {
      id: 103,
      name: 'Video Lover',
      avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    },
    text: 'Check out this creative video!',
    time: '10 minutes ago',
    video: 'https://www.w3schools.com/html/mov_bbb.mp4',
    replies: [],
  },
  {
    id: 4,
    user: {
      id: 104,
      name: 'Detail Writer',
      avatar: 'https://randomuser.me/api/portraits/women/55.jpg',
    },
    text: 'A deep dive into the creative process.',
    time: '5 minutes ago',
    description: 'This post explores the journey of creativity, from the first spark of inspiration to the final masterpiece. It covers techniques, mindset, and the emotional rollercoaster every artist faces. Read on for tips, stories, and more!\n\nKey points:\n- Inspiration sources\n- Overcoming creative block\n- Sharing your work with the world',
    replies: [],
  },
];

const reactionList = [
  { emoji: '💡', label: 'Inspired', color: '#FFD700' },
  { emoji: '🌌', label: 'Cosmic', color: '#4B0082' },
  { emoji: '🌀', label: 'Mind-Bending', color: '#00CED1' },
  { emoji: '🌱', label: 'Growing', color: '#32CD32' },
  { emoji: '✨', label: 'Spark', color: '#FF69B4' },
];

export default function PostCard({ user, time, text, images, image, video, audio, description, stats }: PostCardProps) {
  const [showShareAnim, setShowShareAnim] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<{emoji: string, label: string} | null>(null);
  const [comments, setComments] = useState<CommentType[]>(mockCommentsData);
  const [imgIdx, setImgIdx] = useState(0);
  const hasImages = images && images.length > 0;
  const nextImg = () => setImgIdx(i => hasImages ? (i + 1) % images.length : 0);
  const prevImg = () => setImgIdx(i => hasImages ? (i - 1 + images.length) % images.length : 0);
  const surpriseImg = () => setImgIdx(() => hasImages ? Math.floor(Math.random() * images.length) : 0);
  useEffect(() => { setImgIdx(0); }, [images]);

  const handleReaction = (reactionEmoji: string) => {
    // ابحث عن التفاعل المختار من القائمة
    const found = reactionList.find(r => r.emoji === reactionEmoji);
    if (found) setSelectedReaction({ emoji: found.emoji, label: found.label });
    else setSelectedReaction(null);
  };

  const handleAddComment = (data: { text: string; gifUrl?: string; stickerUrl?: string; style?: React.CSSProperties }) => {
    const newComment: CommentType = {
      id: Date.now(),
      user: { id: 99, name: 'Current User', avatar: 'https://randomuser.me/api/portraits/lego/1.jpg' },
      text: data.text,
      gifUrl: data.gifUrl,
      stickerUrl: data.stickerUrl,
      style: data.style,
      time: 'Just now',
      replies: []
    };
    setComments(prev => [newComment, ...prev]);
  };

  const handleReply = (parentId: number, data: { text: string; gifUrl?: string; stickerUrl?: string; }) => {
    const newReply = {
      id: Date.now(),
      user: { id: 99, name: 'Current User', avatar: 'https://randomuser.me/api/portraits/lego/1.jpg' },
      text: data.text,
      gifUrl: data.gifUrl,
      stickerUrl: data.stickerUrl,
      time: 'Just now',
      replies: []
    };
    setComments(prev => 
      prev.map(c => 
        c.id === parentId 
        ? { ...c, replies: [...(c.replies || []), newReply] } 
        : c
      )
    );
  };

  const handleDeleteComment = (commentId: number) => {
    const deleteRecursively = (commentsList: CommentType[]): CommentType[] => {
      return commentsList.filter(comment => {
        if (comment.id === commentId) {
          return false;
        }
        if (comment.replies) {
          comment.replies = deleteRecursively(comment.replies);
        }
        return true;
      });
    };
    setComments(prev => deleteRecursively([...prev]));
  };

  const handleEditComment = (commentId: number, newText: string) => {
    const editRecursively = (commentsList: CommentType[]): CommentType[] => {
      return commentsList.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, text: newText };
        }
        if (comment.replies) {
          comment.replies = editRecursively(comment.replies);
        }
        return comment;
      });
    };
    setComments(prev => editRecursively([...prev]));
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
        {/* عرض الصور */}
        {images && images.length > 1 ? (
          <Slider images={images} />
        ) : images && images.length === 1 ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            whileHover={{ scale: 1.03 }}
            src={images[0]}
            alt="post"
            className="rounded-lg w-full object-cover max-h-96"
          />
        ) : image ? (
          <motion.img
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            whileHover={{ scale: 1.03 }}
            src={image}
            alt="post"
            className="rounded-lg w-full object-cover max-h-96"
          />
        ) : null}
        {/* عرض الفيديو */}
        {video && (
          <video controls className="rounded-lg w-full max-h-96 mt-2">
            <source src={video} />
            Your browser does not support the video tag.
          </video>
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
      </div>
      {showShareAnim && <ShareBottleAnimation onClose={handleCloseShare} />}
      <Comments 
        comments={comments} 
        onAddComment={handleAddComment} 
        onReply={handleReply}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        user={{ id: 99, name: 'Current User' }}
        postOwner={{ id: 101, name: 'Alex Chen' }}
      />
    </motion.div>
  );
} 