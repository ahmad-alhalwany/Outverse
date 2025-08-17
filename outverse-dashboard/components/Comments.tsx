"use client"

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import useSound from "./useSound";
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { FaRegSmile, FaPalette, FaEdit, FaTrash, FaThumbtack, FaChevronDown, FaChevronUp, FaSpinner } from 'react-icons/fa';
import { MdGif } from 'react-icons/md';
import { ChromePicker } from 'react-color';
import PostReactions from './PostReactions';
import { formatRelativeTime } from '../utils/dateFormatter';

interface Comment {
  id: number;
  user: {
    id: number;
    name: string;
    avatar: string;
  };
  text: string;
  time: string;
  gifUrl?: string;
  stickerUrl?: string;
  style?: React.CSSProperties;
  reaction?: string;
  replies?: Comment[];
}

interface User {
  id: number;
  name: string;
}

interface CommentsProps {
  postId: number;
  user: User;
  postOwner: User;
  onCommentsCountUpdate?: (count: number) => void;
}

// قائمة مستخدمين وهمية للاقتراح
const mockUsers = [
  { id: 1, name: 'Sarah Mitchell' },
  { id: 2, name: 'David Chen' },
  { id: 3, name: 'Elena Rodriguez' },
  { id: 4, name: 'Alex Chen' },
  { id: 5, name: 'Maria Garcia' },
];

export default function Comments({ postId, user, postOwner, onCommentsCountUpdate }: CommentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [showGif, setShowGif] = useState(false);
  const [stickerUrl, setStickerUrl] = useState<string | null>(null);
  const [showStickers, setShowStickers] = useState(false);
  const [customStyle, setCustomStyle] = useState<React.CSSProperties>({});
  const [showColor, setShowColor] = useState(false);
  const playComment = useSound("/sounds/comment.mp3", 0.5);
  const [commentReactions, setCommentReactions] = useState<{ [id: number]: { reaction: string; count: number } }>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [selectedCommentReactions, setSelectedCommentReactions] = useState<{ [id: number]: string }>({});
  const [commentReactionCounts, setCommentReactionCounts] = useState<{ [id: number]: { [reaction: string]: number } }>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState<number | null>(null);
  const [expandedComments, setExpandedComments] = useState<{ [id: number]: boolean }>({});
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionPos, setMentionPos] = useState<{top: number, left: number} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // API states
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const [addingComment, setAddingComment] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [deletingLoading, setDeletingLoading] = useState<number | null>(null);

  // States for Rich Replies
  const [showReplyEmoji, setShowReplyEmoji] = useState(false);
  const [showReplyGif, setShowReplyGif] = useState(false);
  const [showReplyStickers, setShowReplyStickers] = useState(false);
  const [replyGifUrl, setReplyGifUrl] = useState<string | null>(null);
  const [replyStickerUrl, setReplyStickerUrl] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLInputElement>(null);

  const stickers = [
    '/stickers/sticker1.png',
    '/stickers/sticker2.png',
    '/stickers/sticker3.png',
  ];

  const gifs = [
    'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  ];

  // Fetch comments from API
  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, postId]);

  // Fetch comments count when component mounts
  useEffect(() => {
    fetchCommentsCount();
  }, [postId]);

  // Update comments count when comments change
  useEffect(() => {
    setCommentsCount(comments.length);
  }, [comments]);

  const fetchCommentsCount = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/comments/?post=${postId}`);
      if (response.ok) {
        const data = await response.json();
        setCommentsCount(data.length);
        if (onCommentsCountUpdate) {
          onCommentsCountUpdate(data.length);
        }
      }
    } catch (error) {
      console.error('Error fetching comments count:', error);
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`http://localhost:8000/api/comments/?post=${postId}`);
      if (response.ok) {
        const data = await response.json();
        const mappedComments = data.map((comment: any) => ({
          id: comment.id,
          user: {
            id: comment.user.id,
            name: comment.user.first_name && comment.user.last_name 
              ? `${comment.user.first_name} ${comment.user.last_name}` 
              : comment.user.username,
            avatar: comment.user.avatar || '',
          },
          text: comment.text,
          time: formatRelativeTime(new Date(comment.created_at)),
          gifUrl: comment.gif_url,
          stickerUrl: comment.sticker_url,
          style: comment.custom_style,
          replies: comment.replies?.map((reply: any) => ({
            id: reply.id,
            user: {
              id: reply.user.id,
              name: reply.user.first_name && reply.user.last_name 
                ? `${reply.user.first_name} ${reply.user.last_name}` 
                : reply.user.username,
              avatar: reply.user.avatar || '',
            },
            text: reply.text,
            time: formatRelativeTime(new Date(reply.created_at)),
            gifUrl: reply.gif_url,
            stickerUrl: reply.sticker_url,
          })) || [],
        }));
        setComments(mappedComments);
        setCommentsCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleStickerSelect = (url: string) => {
    setStickerUrl(url);
    setShowStickers(false);
  };

  const handleColorChange = (color: any) => {
    setCustomStyle({ ...customStyle, background: color.hex });
    setShowColor(false);
  };

  const handleEmojiSelect = (emoji: any) => {
    setNewComment(newComment + emoji.native);
    setShowEmoji(false);
  };

  const handleGifSelect = (url: string) => {
    setGifUrl(url);
    setShowGif(false);
  };

  const handleCommentReaction = async (commentId: number, reaction: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/comments/${commentId}/add_reaction/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reaction: reaction,
          user_id: user.id,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update local state based on API response
        setSelectedCommentReactions(prev => {
          if (data.reaction) {
            return { ...prev, [commentId]: data.reaction };
          } else {
            const newState = { ...prev };
            delete newState[commentId];
            return newState;
          }
        });
        
        // Refresh comments to get updated reaction counts
        fetchComments();
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const handleReply = async (parentId: number) => {
    if (replyText.trim() || replyGifUrl || replyStickerUrl) {
      try {
        const response = await fetch('http://localhost:8000/api/comments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post: postId,
            user_id: user.id,
            parent: parentId,
            text: replyText,
            gif_url: replyGifUrl || null,
            sticker_url: replyStickerUrl || null,
          }),
        });
        
        if (response.ok) {
          // Reset all reply states and close the form
          setReplyText('');
          setReplyGifUrl(null);
          setReplyStickerUrl(null);
          setReplyingTo(null);
          setShowReplyEmoji(false);
          setShowReplyGif(false);
          setShowReplyStickers(false);
          // Refresh comments and update count
          fetchComments();
          setCommentsCount(prev => prev + 1);
          if (onCommentsCountUpdate) {
            onCommentsCountUpdate(commentsCount + 1);
          }
        }
      } catch (error) {
        console.error('Error adding reply:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() || gifUrl || stickerUrl) {
      setAddingComment(true);
      try {
        const response = await fetch('http://localhost:8000/api/comments/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            post: postId,
            user_id: user.id,
            text: newComment,
            gif_url: gifUrl || null,
            sticker_url: stickerUrl || null,
            custom_style: customStyle,
          }),
        });
        
        if (response.ok) {
          playComment();
          setNewComment('');
          setGifUrl(null);
          setStickerUrl(null);
          setCustomStyle({});
          // Refresh comments and update count
          fetchComments();
          setCommentsCount(prev => prev + 1);
          if (onCommentsCountUpdate) {
            onCommentsCountUpdate(commentsCount + 1);
          }
        }
      } catch (error) {
        console.error('Error adding comment:', error);
      } finally {
        setAddingComment(false);
      }
    }
  };

  const handleEdit = (id: number, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const handleSaveEditAction = async (id: number) => {
    if (editText.trim()) {
      setEditingLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/comments/${id}/`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: editText,
          }),
        });
        
        if (response.ok) {
          setEditingId(null);
          setEditText('');
          // Refresh comments
          fetchComments();
        }
      } catch (error) {
        console.error('Error editing comment:', error);
      } finally {
        setEditingLoading(false);
      }
    }
  };

  const handleDeleteAction = async (id: number) => {
    setDeletingLoading(id);
    try {
      const response = await fetch(`http://localhost:8000/api/comments/${id}/`, {
        method: 'DELETE',
      });
      
              if (response.ok) {
          setShowConfirmDelete(null);
          // Refresh comments and update count
          fetchComments();
          setCommentsCount(prev => prev - 1);
          if (onCommentsCountUpdate) {
            onCommentsCountUpdate(commentsCount - 1);
          }
        }
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setDeletingLoading(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePin = (id: number) => {
    setPinnedId(id === pinnedId ? null : id);
  };

  const sortedComments = [...comments];
  if (pinnedId) {
    const idx = sortedComments.findIndex(c => c.id === pinnedId);
    if (idx > -1) {
      const [pinned] = sortedComments.splice(idx, 1);
      sortedComments.unshift(pinned);
    }
  }

  // عند الكتابة في حقل التعليق
  const handleCommentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    const cursor = e.target.selectionStart || 0;
    const textUpToCursor = value.slice(0, cursor);
    const match = textUpToCursor.match(/@([\w ]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setShowMentionList(true);
      // حساب موضع القائمة
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setMentionPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX });
      }
    } else {
      setShowMentionList(false);
      setMentionQuery('');
    }
  };
  // عند اختيار اسم من القائمة
  const handleMentionSelect = (name: string) => {
    const cursor = inputRef.current?.selectionStart || 0;
    const before = newComment.slice(0, cursor).replace(/@([\w ]*)$/, `@${name} `);
    const after = newComment.slice(cursor);
    setNewComment(before + after);
    setShowMentionList(false);
    setMentionQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleReplyEmojiSelect = (emoji: any) => {
    setReplyText(prev => prev + emoji.native);
    setShowReplyEmoji(false);
  };

  const handleReplyGifSelect = (url: string) => {
    setReplyGifUrl(url);
    setShowReplyGif(false);
  };

  const handleReplyStickerSelect = (url: string) => {
    setReplyStickerUrl(url);
    setShowReplyStickers(false);
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
        <span className="text-sm">Comments ({commentsCount})</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-4"
          >
            <form onSubmit={handleSubmit} className="flex flex-col space-y-2 relative">
              <div className="flex space-x-2 items-center">
                <motion.input
                  ref={inputRef}
                  whileFocus={{ scale: 1.02 }}
                  type="text"
                  value={newComment}
                  onChange={handleCommentInput}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-lab text-black"
                />
                <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="text-xl p-1 text-gray-700 hover:text-black transition" title="Emoji"><FaRegSmile /></button>
                <button type="button" onClick={() => setShowGif(!showGif)} className="text-xl p-1 text-gray-700 hover:text-black transition" title="GIF"><MdGif /></button>
                <button type="button" onClick={() => setShowStickers(!showStickers)} className="text-xl p-1 text-gray-700 hover:text-black transition" title="Sticker">🌟</button>
                <button type="button" onClick={() => setShowColor(!showColor)} className="text-xl p-1 text-gray-700 hover:text-black transition" title="خلفية"><FaPalette /></button>
                {customStyle.background && (
                  <span className="inline-block w-5 h-5 rounded-full border ml-1" style={{ background: customStyle.background }}></span>
                )}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="submit"
                  className="px-4 py-2 bg-lab text-white rounded-lg ml-2 flex items-center"
                  disabled={addingComment}
                >
                  {addingComment ? <FaSpinner className="animate-spin mr-1" /> : null} Send
                </motion.button>
              </div>
              {showEmoji && (
                <div className="absolute z-50 top-12 left-0">
                  <Picker data={data} onEmojiSelect={handleEmojiSelect} theme="auto" />
                </div>
              )}
              {showGif && (
                <div className="absolute z-50 top-12 left-20 bg-white p-2 rounded shadow flex space-x-2">
                  {gifs.map((url) => (
                    <img key={url} src={url} alt="gif" className="w-16 h-16 cursor-pointer rounded" onClick={() => handleGifSelect(url)} />
                  ))}
                </div>
              )}
              {showStickers && (
                <div className="absolute z-50 top-12 left-40 bg-white p-2 rounded shadow flex space-x-2">
                  {stickers.map((url) => (
                    <img key={url} src={url} alt="sticker" className="w-10 h-10 cursor-pointer" onClick={() => handleStickerSelect(url)} />
                  ))}
                </div>
              )}
              {showColor && (
                <div className="absolute z-50 top-12 left-60 bg-white p-2 rounded shadow">
                  <ChromePicker color={customStyle.background || '#fff'} onChange={handleColorChange} disableAlpha={true} />
                </div>
              )}
              <div className="flex space-x-2 items-center mt-1">
                {gifUrl && <img src={gifUrl} alt="gif" className="w-16 h-16 rounded" />}
                {stickerUrl && <img src={stickerUrl} alt="sticker" className="w-10 h-10" />}
              </div>
              {/* قائمة الاقتراحات */}
              {showMentionList && mentionQuery !== undefined && (
                <div style={{ position: 'absolute', top: mentionPos?.top, left: mentionPos?.left, zIndex: 1000 }} className="bg-white border rounded shadow p-1 w-48">
                  {mockUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).map(u => (
                    <div key={u.id} className="px-2 py-1 hover:bg-lab/10 cursor-pointer" onClick={() => handleMentionSelect(u.name)}>
                      @{u.name}
                    </div>
                  ))}
                  {mockUsers.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase())).length === 0 && (
                    <div className="px-2 py-1 text-gray-400">No users found</div>
                  )}
                </div>
              )}
            </form>

            {loadingComments ? (
              <div className="flex justify-center items-center py-8 text-gray-400"><FaSpinner className="animate-spin mr-2" /> Loading comments...</div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {sortedComments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.4, type: 'spring', stiffness: 80 }}
                      className={`flex space-x-3 relative ${pinnedId === comment.id ? 'bg-yellow-50 border-l-4 border-yellow-400' : ''}`}
                    >
                      {/* لمسة كونية: نجمة متوهجة عند إضافة تعليق جديد (آخر تعليق مضاف) */}
                      {comment.id === sortedComments[0]?.id && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1.2, opacity: 1 }}
                          transition={{ duration: 0.5, type: 'spring' }}
                          className="absolute -left-5 top-2 text-yellow-300 drop-shadow-glow pointer-events-none"
                        >
                          ✨
                        </motion.span>
                      )}
                      <img
                        src={comment.user.avatar}
                        alt={comment.user.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <motion.div
                          className="rounded-lg p-3 relative"
                          style={comment.style || { background: '#f9fafb' }}
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm text-black">{comment.user.name}</div>
                            <div className="flex items-center space-x-2">
                              {user && postOwner && user.id === postOwner.id && (
                                <button onClick={() => handlePin(comment.id)} title="Pin" className={`text-lg ${pinnedId === comment.id ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}><FaThumbtack /></button>
                              )}
                              {user && user.id === comment.user.id && (
                                <button onClick={() => handleEdit(comment.id, comment.text)} title="Edit" className="text-gray-400 hover:text-blue-500 ml-2"><FaEdit /></button>
                              )}
                              {user && postOwner && (user.id === comment.user.id || user.id === postOwner.id) && (
                                <button onClick={() => setShowConfirmDelete(comment.id)} title="Delete" className="text-gray-400 hover:text-red-500"><FaTrash /></button>
                              )}
                            </div>
                          </div>
                          {editingId === comment.id ? (
                            <div className="flex space-x-2 mt-2">
                              <input
                                type="text"
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm !text-black"
                                disabled={editingLoading}
                              />
                              <button className="px-2 py-1 bg-lab text-white rounded text-sm flex items-center" onClick={() => handleSaveEditAction(comment.id)} disabled={editingLoading}>
                                {editingLoading ? <FaSpinner className="animate-spin mr-1" /> : null} Save
                              </button>
                              <button className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm" onClick={() => setEditingId(null)} disabled={editingLoading}>Cancel</button>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-700">
                              {comment.text.split(/(@[\w ]+)/g).map((part, i) =>
                                part.startsWith('@') ? (
                                  <span key={i} className="text-lab font-semibold">{part}</span>
                                ) : part
                              )}
                            </p>
                          )}
                          {showConfirmDelete === comment.id && (
                            <div className="mt-2 bg-white border p-2 rounded shadow text-xs">
                              Are you sure you want to delete this comment?
                              <div className="flex space-x-2 mt-1">
                                <button className="px-2 py-1 bg-red-500 text-white rounded flex items-center" onClick={() => handleDeleteAction(comment.id)} disabled={deletingLoading === comment.id}>
                                  {deletingLoading === comment.id ? <FaSpinner className="animate-spin mr-1" /> : null} Delete
                                </button>
                                <button className="px-2 py-1 text-gray-500" onClick={() => setShowConfirmDelete(null)} disabled={deletingLoading === comment.id}>Cancel</button>
                              </div>
                            </div>
                          )}
                          <div className="mt-2 flex items-center space-x-4">
                            <div className="relative">
                              <PostReactions 
                                onReaction={(reaction) => handleCommentReaction(comment.id, reaction)}
                                selectedReaction={selectedCommentReactions[comment.id]}
                                reactionCounts={commentReactionCounts[comment.id]}
                              />
                            </div>
                            
                            <button 
                              className="text-sm text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                              onClick={() => setReplyingTo(comment.id)}
                            >
                              <span>Reply</span>
                            </button>
                          </div>

                          {replyingTo === comment.id && (
                            <motion.form 
                              onSubmit={(e) => { e.preventDefault(); handleReply(comment.id); }}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="mt-2 flex flex-col space-y-1 relative"
                            >
                              <div className="flex space-x-2 items-center">
                                <input
                                  ref={replyInputRef}
                                  type="text"
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  placeholder="Write a reply..."
                                  className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm !text-black"
                                  autoFocus
                                />
                                <button 
                                  type="submit"
                                  className="px-3 py-1 bg-lab text-white rounded text-sm hover:bg-opacity-90"
                                >
                                  Send
                                </button>
                              </div>
                              <div className="flex space-x-2 items-center pl-1">
                                <button type="button" onClick={() => setShowReplyEmoji(!showReplyEmoji)} className="text-lg p-1 text-gray-500 hover:text-black transition" title="Emoji"><FaRegSmile /></button>
                                <button type="button" onClick={() => setShowReplyGif(!showReplyGif)} className="text-lg p-1 text-gray-500 hover:text-black transition" title="GIF"><MdGif /></button>
                                <button type="button" onClick={() => setShowReplyStickers(!showReplyStickers)} className="text-lg p-1 text-gray-500 hover:text-black transition" title="Sticker">🌟</button>
                                
                                <button 
                                  type="button"
                                  className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                                  onClick={() => { 
                                    setReplyingTo(null); 
                                    setReplyText(''); 
                                    setShowReplyEmoji(false);
                                    setShowReplyGif(false);
                                    setShowReplyStickers(false);
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                              {/* Reply Emoji Picker */}
                              {showReplyEmoji && (
                                <div className="relative z-50 mt-1">
                                  <Picker data={data} onEmojiSelect={handleReplyEmojiSelect} theme="auto" />
                                </div>
                              )}
                              {/* Reply GIF Picker */}
                              {showReplyGif && (
                                <div className="relative z-50 mt-1 bg-white p-2 rounded shadow flex space-x-2">
                                  {gifs.map((url) => (
                                    <img key={url} src={url} alt="gif" className="w-16 h-16 cursor-pointer rounded" onClick={() => handleReplyGifSelect(url)} />
                                  ))}
                                </div>
                              )}
                              {showReplyStickers && (
                                <div className="relative z-50 mt-1 bg-white p-2 rounded shadow flex space-x-2">
                                  {stickers.map((url) => (
                                    <img key={url} src={url} alt="sticker" className="w-10 h-10 cursor-pointer" onClick={() => handleReplyStickerSelect(url)} />
                                  ))}
                                </div>
                              )}
                              {(replyGifUrl || replyStickerUrl) && (
                                  <div className="flex space-x-2 items-center mt-1 pl-1">
                                      {replyGifUrl && <img src={replyGifUrl} alt="gif" className="w-16 h-16 rounded" />}
                                      {replyStickerUrl && <img src={replyStickerUrl} alt="sticker" className="w-10 h-10" />}
                                  </div>
                              )}
                            </motion.form>
                          )}

                          {comment.replies && comment.replies.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="mt-2 ml-4 border-l-2 border-gray-200 pl-2 space-y-2"
                            >
                              {comment.replies.map((reply) => (
                                <div key={reply.id} className="text-sm flex items-start space-x-2">
                                  <img
                                    src={reply.user.avatar}
                                    alt={reply.user.name}
                                    className="w-7 h-7 rounded-full mt-0.5"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-black">{reply.user.name}</span>
                                      <div className="flex items-center space-x-2">
                                        {user && user.id === reply.user.id && (
                                          <button onClick={() => handleEdit(reply.id, reply.text)} title="Edit" className="text-gray-400 hover:text-blue-500 ml-2"><FaEdit /></button>
                                        )}
                                        {user && postOwner && (user.id === reply.user.id || user.id === postOwner.id) && (
                                          <button onClick={() => setShowConfirmDelete(reply.id)} title="Delete" className="text-gray-400 hover:text-red-500"><FaTrash /></button>
                                        )}
                                      </div>
                                    </div>

                                    {editingId === reply.id ? (
                                      <div className="flex space-x-2 mt-2">
                                        <input type="text" value={editText} onChange={e => setEditText(e.target.value)} className="flex-1 px-2 py-1 rounded border border-gray-300 text-sm !text-black" autoFocus />
                                        <button className="px-2 py-1 bg-lab text-white rounded text-sm flex items-center" onClick={() => handleSaveEditAction(reply.id)} disabled={editingLoading}>
                                          {editingLoading ? <FaSpinner className="animate-spin mr-1" /> : null} Save
                                        </button>
                                        <button className="px-2 py-1 text-gray-500 hover:text-gray-700 text-sm" onClick={() => setEditingId(null)} disabled={editingLoading}>Cancel</button>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="text-gray-700 ml-1">{reply.text}</span>
                                        {reply.gifUrl && <img src={reply.gifUrl} alt="gif" className="w-16 h-16 rounded mt-1" />}
                                        {reply.stickerUrl && <img src={reply.stickerUrl} alt="sticker" className="w-8 h-8 ml-2 inline-block" />}
                                      </>
                                    )}

                                    {showConfirmDelete === reply.id && (
                                      <div className="mt-2 bg-white border p-2 rounded shadow text-xs">
                                        Are you sure?
                                        <div className="flex space-x-2 mt-1">
                                          <button className="px-2 py-1 bg-red-500 text-white rounded flex items-center" onClick={() => handleDeleteAction(reply.id)} disabled={deletingLoading === reply.id}>
                                            {deletingLoading === reply.id ? <FaSpinner className="animate-spin mr-1" /> : null} Delete
                                          </button>
                                          <button className="px-2 py-1 text-gray-500" onClick={() => setShowConfirmDelete(null)} disabled={deletingLoading === reply.id}>Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="mt-1">
                                      <PostReactions
                                        onReaction={(reaction) => {
                                          setCommentReactionCounts(prev => {
                                            const newState = { ...prev };
                                            if (!newState[reply.id]) newState[reply.id] = {};
                                            if (selectedCommentReactions[reply.id] === reaction) {
                                              newState[reply.id][reaction] = (newState[reply.id][reaction] || 1) - 1;
                                              if (newState[reply.id][reaction] <= 0) delete newState[reply.id][reaction];
                                            } else {
                                              const oldReaction = selectedCommentReactions[reply.id];
                                              if (oldReaction) {
                                                newState[reply.id][oldReaction] = (newState[reply.id][oldReaction] || 1) - 1;
                                                if (newState[reply.id][oldReaction] <= 0) delete newState[reply.id][oldReaction];
                                              }
                                              newState[reply.id][reaction] = (newState[reply.id][reaction] || 0) + 1;
                                            }
                                            return newState;
                                          });
                                          setSelectedCommentReactions(prev => {
                                            if (prev[reply.id] === reaction) {
                                              const newState = { ...prev };
                                              delete newState[reply.id];
                                              return newState;
                                            }
                                            return { ...prev, [reply.id]: reaction };
                                          });
                                        }}
                                        selectedReaction={selectedCommentReactions[reply.id]}
                                        reactionCounts={commentReactionCounts[reply.id]}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </motion.div>
                        <div className="text-xs text-gray-400 mt-1">{comment.time}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 