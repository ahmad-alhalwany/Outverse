"use client"

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperClipIcon,
  CameraIcon,
  VideoCameraIcon,
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { getUser, isAuthenticated } from '@/lib/auth';
import { apiFetch, apiFetchJson, apiUrl, mediaUrl } from '@/lib/api';

const API_URL = apiUrl('posts/');

const popularTags = [
  '#CreativeChallenge', '#DailyInspiration', '#ArtisticJourney', '#CreativeCommunity',
  '#DigitalArt', '#Inspiration', '#ArtisticExpression', '#CreativeFlow',
];

const moods = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🎨', label: 'Artsy' },
  { emoji: '💡', label: 'Inspired' },
  { emoji: '✨', label: 'Spark' },
  { emoji: '🎉', label: 'Celebratory' },
  { emoji: '🌈', label: 'Colorful' },
  { emoji: '💪', label: 'Empowered' },
  { emoji: '🚀', label: 'Ambitious' },
];

export default function CreatePostCard({ onPublished }: { onPublished?: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [text, setText] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const user = getUser();
  const avatar = user?.avatar ? mediaUrl(user.avatar) : null;
  const displayName = user?.first_name || user?.username || 'You';

  const handleTagClick = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const resetForm = () => {
    setText('');
    setSelectedMood(null);
    setSelectedTags([]);
    setImage(null);
    setVideo(null);
    setImageFile(null);
    setVideoFile(null);
  };

  const handlePublish = async () => {
    if (!isAuthenticated()) {
      setError('Please sign in to publish.');
      return;
    }
    setError('');
    setPublishing(true);
    try {
      const res = await apiFetchJson('posts/', {
        method: 'POST',
        json: {
          text: text.trim(),
          mood: selectedMood || '',
          tags: selectedTags.map((tag) => tag.replace(/^#/, '')),
        },
      });
      if (!res.ok) throw new Error('publish failed');
      const post = await res.json();
      const mediaFiles = [imageFile, videoFile].filter(Boolean) as File[];
      if (mediaFiles.length > 0) {
        const form = new FormData();
        mediaFiles.forEach((f) => form.append('media', f));
        await apiFetch(`posts/${post.id}/add_media/`, { method: 'POST', body: form });
      }
      resetForm();
      onPublished?.();
    } catch {
      setError('Could not publish your post. Check the connection.');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = !!(text.trim() || image || video);

  return (
    <div className="create-post-cosmic mb-6 rounded-2xl p-[2px]">
      <div className="rounded-[14px] bg-[var(--card-bg)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-vault/30" />
            ) : (
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-vault to-lab flex items-center justify-center text-white text-sm font-bold">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold text-text flex items-center gap-1">
                <SparklesIcon className="h-4 w-4 text-vault" />
                Share a spark
              </p>
              <p className="text-xs text-text-secondary">What&apos;s moving your creativity?</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="p-2 rounded-full text-text-secondary hover:bg-surface transition"
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
          </button>
        </div>

        <textarea
          className="w-full min-h-[72px] max-h-40 resize-none rounded-xl border border-vault/15 bg-surface/50 px-4 py-3 text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-vault/40 transition"
          placeholder="Share your thoughts, art, or inspiration with the cosmos…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setExpanded(true)}
        />

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              {(image || video) && (
                <div className="mt-3 flex gap-3 flex-wrap">
                  {image && <img src={image} alt="preview" className="max-h-36 rounded-xl border border-vault/20 object-cover" />}
                  {video && <video src={video} controls className="max-h-36 rounded-xl border border-vault/20" />}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="media-chip" onClick={() => imageInput.current?.click()}>
                  <CameraIcon className="h-4 w-4" /> Image
                </button>
                <input type="file" accept="image/*" ref={imageInput} className="hidden" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setImageFile(e.target.files[0]);
                    setImage(URL.createObjectURL(e.target.files[0]));
                  }
                }} />
                <button type="button" className="media-chip" onClick={() => videoInput.current?.click()}>
                  <VideoCameraIcon className="h-4 w-4" /> Video
                </button>
                <input type="file" accept="video/*" ref={videoInput} className="hidden" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setVideoFile(e.target.files[0]);
                    setVideo(URL.createObjectURL(e.target.files[0]));
                  }
                }} />
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">Mood</p>
                <div className="flex gap-1.5 flex-wrap">
                  {moods.map((m) => (
                    <button
                      key={m.emoji}
                      type="button"
                      className={`text-xl p-1.5 rounded-full border transition ${selectedMood === m.emoji ? 'border-vault bg-vault/15 scale-110' : 'border-transparent hover:border-vault/30'}`}
                      onClick={() => setSelectedMood(selectedMood === m.emoji ? null : m.emoji)}
                      title={m.label}
                    >
                      {m.emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {popularTags.slice(0, 5).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`px-2 py-0.5 rounded-full text-[11px] border transition ${selectedTags.includes(tag) ? 'bg-vault text-white border-vault' : 'border-vault/20 text-text-secondary hover:border-vault/50'}`}
                      onClick={() => handleTagClick(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

        <div className="flex justify-end mt-4">
          <button
            type="button"
            className="cosmic-btn !px-6 !py-2.5 text-sm disabled:opacity-40"
            onClick={handlePublish}
            disabled={publishing || !canPublish}
          >
            {publishing ? 'Publishing…' : 'Publish to Feed'}
          </button>
        </div>
      </div>
    </div>
  );
}
