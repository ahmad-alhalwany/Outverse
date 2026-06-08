'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CosmicVideoPlayer from './CosmicVideoPlayer';
import { mediaUrl } from '@/lib/api';

export type PostMediaItem = { type: 'image' | 'video'; url: string };

function resolveUrl(raw: string): string {
  return mediaUrl(raw) || '';
}

interface PostMediaGalleryProps {
  images?: string[];
  videos?: string[];
}

export default function PostMediaGallery({ images = [], videos = [] }: PostMediaGalleryProps) {
  const items: PostMediaItem[] = [
    ...images.map((url) => ({ type: 'image' as const, url: resolveUrl(url) })),
    ...videos.map((url) => ({ type: 'video' as const, url: resolveUrl(url) })),
  ].filter((m) => m.url);

  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setIdx(0);
    setFailed({});
    setLoaded({});
  }, [images, videos]);

  if (items.length === 0) return null;

  const current = items[idx];
  const hasMultiple = items.length > 1;

  const go = (delta: number) =>
    setIdx((i) => (i + delta + items.length) % items.length);

  return (
    <div className="post-media-gallery">
      <div className="post-media-gallery__frame">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${idx}-${current.url}`}
            className="post-media-gallery__slide"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            {!loaded[idx] && !failed[idx] && (
              <div className="post-media-gallery__skeleton" aria-hidden />
            )}
            {failed[idx] ? (
              <div className="post-media-gallery__error">
                <span aria-hidden>🛸</span>
                <p>Media unavailable</p>
              </div>
            ) : current.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.url}
                alt=""
                className={`post-media-gallery__img${loaded[idx] ? ' post-media-gallery__img--ready' : ''}`}
                onLoad={() => setLoaded((s) => ({ ...s, [idx]: true }))}
                onError={() => setFailed((s) => ({ ...s, [idx]: true }))}
              />
            ) : (
              <div className="post-media-gallery__video-wrap">
                <CosmicVideoPlayer
                  src={current.url}
                  className="post-media-gallery__video"
                  style={{ width: '100%', maxHeight: 'min(70vh, 520px)' }}
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {hasMultiple && (
          <>
            <button
              type="button"
              className="post-media-gallery__nav post-media-gallery__nav--prev"
              onClick={() => go(-1)}
              aria-label="Previous media"
            >
              ‹
            </button>
            <button
              type="button"
              className="post-media-gallery__nav post-media-gallery__nav--next"
              onClick={() => go(1)}
              aria-label="Next media"
            >
              ›
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div className="post-media-gallery__dots" role="tablist" aria-label="Media slides">
          {items.map((item, i) => (
            <button
              key={`${item.url}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Slide ${i + 1}, ${item.type}`}
              className={`post-media-gallery__dot${i === idx ? ' post-media-gallery__dot--active' : ''}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
