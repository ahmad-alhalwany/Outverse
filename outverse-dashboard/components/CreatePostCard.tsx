"use client"

import Image from 'next/image';
import { useMemo, useRef, useState } from 'react';
import {
  CameraIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { isAuthenticated } from '@/lib/auth';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { apiFetch, apiFetchJson, mediaUrl } from '@/lib/api';

const popularTags = [
  '#CreativeChallenge', '#DailyInspiration', '#ArtisticJourney', '#CreativeCommunity',
  '#DigitalArt', '#Inspiration', '#ArtisticExpression', '#CreativeFlow',
];

const moods = [
  { emoji: '😊', label: 'Happy' },
  { emoji: '🎨', label: 'Artistic' },
  { emoji: '💡', label: 'Inspired' },
  { emoji: '🎉', label: 'Energetic' },
  { emoji: '✨', label: 'Spark' },
  { emoji: '🌈', label: 'Colorful' },
  { emoji: '💪', label: 'Empowered' },
  { emoji: '🚀', label: 'Ambitious' },
];

export default function CreatePostCard({ onPublished }: { onPublished?: () => void }) {
  const [text, setText] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const attachmentInput = useRef<HTMLInputElement>(null);

  const user = useAuthUser();
  const avatar = user?.avatar ? mediaUrl(user.avatar) : null;
  const displayName = user?.first_name || user?.username || 'You';
  const visibleTags = useMemo(() => popularTags.slice(0, 6), []);
  const visibleMoods = useMemo(() => moods.slice(0, 5), []);

  const handleTagClick = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const resetForm = () => {
    setText('');
    setSelectedMood(null);
    setSelectedTags([]);
    setImage(null);
    setVideo(null);
    setAttachmentName(null);
    setAttachmentFile(null);
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
      const mediaFiles = [imageFile, videoFile, attachmentFile].filter(Boolean) as File[];

      if (mediaFiles.length > 0) {
        const form = new FormData();
        mediaFiles.forEach((file) => form.append('media', file));
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

  const canPublish = !!(text.trim() || image || video || attachmentName);

  return (
    <div className="create-post-card mb-6">
      <div className="create-post-card__shell">
        <div className="create-post-card__header">
          <div className="flex items-center gap-3 min-w-0">
            {avatar ? (
              <Image
                src={avatar}
                alt={`${displayName} avatar`}
                width={44}
                height={44}
                className="h-11 w-11 rounded-full object-cover border border-[#d8c7bf]"
                unoptimized
              />
            ) : (
              <span className="create-post-card__avatar-fallback">
                {displayName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="create-post-card__eyebrow">{displayName}</p>
              <p className="create-post-card__subtle">Share your next creative spark</p>
            </div>
          </div>
        </div>

        <textarea
          className="create-post-card__textarea"
          placeholder="Express your creativity today..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {(image || video || attachmentName) && (
          <div className="create-post-card__preview-row">
            {image && (
              <Image
                src={image}
                alt="Selected post image preview"
                width={320}
                height={144}
                className="create-post-card__preview-media"
                unoptimized
              />
            )}
            {video && <video src={video} controls className="create-post-card__preview-media" />}
            {attachmentName && (
              <div className="create-post-card__attachment-pill">
                <PaperClipIcon className="h-4 w-4" />
                <span>{attachmentName}</span>
              </div>
            )}
          </div>
        )}

        <div className="create-post-card__toolbar">
          <button
            type="button"
            className="create-post-card__tool"
            onClick={() => imageInput.current?.click()}
            aria-label="Add image"
          >
            <CameraIcon className="h-5 w-5" />
          </button>
          <input
            type="file"
            accept="image/*"
            ref={imageInput}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setImageFile(e.target.files[0]);
                setImage(URL.createObjectURL(e.target.files[0]));
              }
            }}
          />

          <button
            type="button"
            className="create-post-card__tool"
            onClick={() => videoInput.current?.click()}
            aria-label="Add video"
          >
            <VideoCameraIcon className="h-5 w-5" />
          </button>
          <input
            type="file"
            accept="video/*"
            ref={videoInput}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setVideoFile(e.target.files[0]);
                setVideo(URL.createObjectURL(e.target.files[0]));
              }
            }}
          />

          <button
            type="button"
            className="create-post-card__tool"
            onClick={() => attachmentInput.current?.click()}
            aria-label="Add file"
          >
            <PaperClipIcon className="h-5 w-5" />
          </button>
          <input
            type="file"
            ref={attachmentInput}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                setAttachmentFile(e.target.files[0]);
                setAttachmentName(e.target.files[0].name);
              }
            }}
          />
        </div>

        <div className="create-post-card__section">
          <p className="create-post-card__section-title"># Trending Tags</p>
          <div className="create-post-card__chips">
            {visibleTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`create-post-card__chip ${selectedTags.includes(tag) ? 'create-post-card__chip--active' : ''}`}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="create-post-card__section create-post-card__section--mood">
          <p className="create-post-card__section-heading">How are you feeling?</p>
          <div className="create-post-card__moods">
            {visibleMoods.map((mood) => (
              <button
                key={mood.emoji}
                type="button"
                className={`create-post-card__mood ${selectedMood === mood.emoji ? 'create-post-card__mood--active' : ''}`}
                onClick={() => setSelectedMood(selectedMood === mood.emoji ? null : mood.emoji)}
                title={mood.label}
              >
                <span className="create-post-card__mood-emoji">{mood.emoji}</span>
                <span className="create-post-card__mood-label">{mood.label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="create-post-card__publish disabled:opacity-40"
            onClick={handlePublish}
            disabled={publishing || !canPublish}
          >
            <PaperAirplaneIcon className="h-4 w-4" />
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}