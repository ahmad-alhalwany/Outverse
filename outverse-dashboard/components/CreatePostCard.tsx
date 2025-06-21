"use client"

import { useRef, useState } from 'react';
import { PaperClipIcon, CameraIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

const popularTags = [
  '#CreativeChallenge', '#DailyInspiration', '#ArtisticJourney', '#CreativeCommunity', '#DigitalArt', '#Inspiration', '#ArtisticExpression', '#CreativeFlow',
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
  { emoji: '❤️', label: 'Loving' },
];

export default function CreatePostCard() {
  const [text, setText] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleTagClick = (tag: string) => {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleMoodSelect = (emoji: string) => {
    setSelectedMood(emoji === selectedMood ? null : emoji);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(URL.createObjectURL(e.target.files[0]));
    }
  };
  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideo(URL.createObjectURL(e.target.files[0]));
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handlePublish = () => {
    // TODO: إرسال البيانات إلى الباك اند
    setText('');
    setSelectedMood(null);
    setSelectedTags([]);
    setImage(null);
    setVideo(null);
    setFile(null);
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 mb-6 border border-surface/40">
      {/* سؤال يومي ديناميكي مستقبلاً */}
      <div className="mb-3">
        <span className="text-base font-semibold text-text">Express your creativity today…</span>
      </div>
      <textarea
        className="w-full min-h-[60px] max-h-40 resize-none rounded-lg border border-surface/60 bg-surface px-4 py-2 text-text placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-lab/40 transition mb-3"
        placeholder="Share your thoughts, art, or inspiration…"
        value={text}
        onChange={e => setText(e.target.value)}
      />
      {/* معاينة صورة/فيديو */}
      {(image || video) && (
        <div className="mb-3 flex gap-3">
          {image && <img src={image} alt="preview" className="max-h-40 rounded-lg border" />}
          {video && <video src={video} controls className="max-h-40 rounded-lg border" />}
        </div>
      )}
      {/* أزرار إضافة ميديا */}
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface hover:bg-lab/10 text-text-secondary hover:text-lab transition"
          onClick={() => imageInput.current?.click()}
        >
          <CameraIcon className="h-5 w-5" />
          <span className="text-xs">Add Image</span>
        </button>
        <input type="file" accept="image/*" ref={imageInput} className="hidden" onChange={handleImageChange} />
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface hover:bg-lab/10 text-text-secondary hover:text-lab transition"
          onClick={() => videoInput.current?.click()}
        >
          <VideoCameraIcon className="h-5 w-5" />
          <span className="text-xs">Add Video</span>
        </button>
        <input type="file" accept="video/*" ref={videoInput} className="hidden" onChange={handleVideoChange} />
        <button
          type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface hover:bg-lab/10 text-text-secondary hover:text-lab transition"
          onClick={() => fileInput.current?.click()}
        >
          <PaperClipIcon className="h-5 w-5" />
          <span className="text-xs">Add File</span>
        </button>
        <input type="file" ref={fileInput} className="hidden" onChange={handleFileChange} />
      </div>
      {/* شريط التاغات */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-text-secondary mb-1 flex items-center gap-2">
          <span className="text-lg">#</span> Popular Tags
        </div>
        <div className="flex flex-wrap gap-2">
          {popularTags.map(tag => (
            <button
              key={tag}
              type="button"
              className={`px-2 py-1 rounded-full text-xs border transition ${selectedTags.includes(tag) ? 'bg-lab text-white border-lab' : 'bg-surface text-text-secondary border-surface hover:bg-lab/10 hover:text-lab'}`}
              onClick={() => handleTagClick(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      {/* اختيار المزاج */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-text-secondary mb-1">How are you feeling creative today?</div>
        <div className="flex gap-2 flex-wrap">
          {moods.map(mood => (
            <button
              key={mood.emoji}
              type="button"
              className={`text-2xl p-2 rounded-full border transition ${selectedMood === mood.emoji ? 'bg-lab/10 border-lab scale-110' : 'bg-surface border-surface hover:bg-lab/10 hover:border-lab'}`}
              onClick={() => handleMoodSelect(mood.emoji)}
              title={mood.label}
            >
              {mood.emoji}
            </button>
          ))}
        </div>
      </div>
      {/* زر النشر */}
      <div className="flex justify-end">
        <button
          type="button"
          className="px-6 py-2 rounded-lg bg-lab text-white font-semibold shadow hover:bg-lab/90 transition disabled:opacity-50"
          onClick={handlePublish}
          disabled={!text && !image && !video && !file}
        >
          Publish
        </button>
      </div>
    </div>
  );
} 