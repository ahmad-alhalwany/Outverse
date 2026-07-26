'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { ArrowsPointingOutIcon, ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/react/24/solid';
import CosmicVideoPlayer from './CosmicVideoPlayer';
import ReactionBurst from './ReactionBurst';
import Image from 'next/image';
import { mediaUrl } from '@/lib/api';

export type PostMediaItem = { type: 'image' | 'video'; url: string };

const MIN_ASPECT = 4 / 5;
const MAX_ASPECT = 1.91;
const DEFAULT_ASPECT = 4 / 5;

function resolveUrl(raw: string): string {
  return mediaUrl(raw) || '';
}

function clampAspect(w: number, h: number) {
  if (!w || !h) return DEFAULT_ASPECT;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, w / h));
}

interface PostMediaGalleryProps {
  images?: string[];
  videos?: string[];
  imageAlts?: string[];
  onDoubleTap?: (coords: { x: number; y: number }) => void;
}

export default function PostMediaGallery({
  images = [],
  videos = [],
  imageAlts = [],
  onDoubleTap,
}: PostMediaGalleryProps) {
  const items: PostMediaItem[] = [
    ...images.map((url) => ({ type: 'image' as const, url: resolveUrl(url) })),
    ...videos.map((url) => ({ type: 'video' as const, url: resolveUrl(url) })),
  ].filter((m) => m.url);

  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [aspect, setAspect] = useState<Record<number, number>>({});
  const [burst, setBurst] = useState<{ id: number; x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef(0);

  useEffect(() => {
    setIdx(0);
    setFailed({});
    setLoaded({});
    setAspect({});
    setLightbox(false);
  }, [images, videos]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false);
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % items.length);
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, items.length]);

  if (items.length === 0) return null;

  const current = items[idx];
  const hasMultiple = items.length > 1;
  const allImages = items.every((m) => m.type === 'image');
  const useCollage = allImages && items.length >= 2;
  const currentAspect = !useCollage
    ? current.type === 'image'
      ? (aspect[idx] ?? DEFAULT_ASPECT)
      : 16 / 9
    : undefined;

  const go = (delta: number) =>
    setIdx((i) => (i + delta + items.length) % items.length);

  const openAt = (i: number) => {
    setIdx(i);
    setLightbox(true);
  };

  const handleTap = (e: React.MouseEvent) => {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 320;
    lastTapRef.current = now;
    if (!isDoubleTap) return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const coords = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setBurst({ id: Date.now(), x: coords.x, y: coords.y });
    onDoubleTap?.(coords);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (!hasMultiple) return;
    const threshold = 60;
    if (info.offset.x < -threshold) go(1);
    else if (info.offset.x > threshold) go(-1);
  };

  const BLUR_PLACEHOLDER =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8/5+hnoEIwDiqkL4KAcT9G0AB4DD4z9wHwAAAABJRU5ErkJggg==';

  const collageCount = Math.min(items.length, 4);
  const collageExtra = items.length - collageCount;

  const renderCollage = () => (
    <div
      ref={frameRef}
      className={`post-media-collage post-media-collage--${collageCount}`}
      onClick={handleTap}
    >
      {items.slice(0, collageCount).map((item, i) => (
        <button
          key={`collage-${item.url}-${i}`}
          type="button"
          className={`post-media-collage__cell post-media-collage__cell--${i}`}
          onClick={(e) => {
            e.stopPropagation();
            openAt(i);
          }}
          aria-label={`Open image ${i + 1}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={imageAlts[i] || ''} className="post-media-collage__img" />
          {i === collageCount - 1 && collageExtra > 0 ? (
            <span className="post-media-collage__more">+{collageExtra}</span>
          ) : null}
        </button>
      ))}
      {burst && (
        <ReactionBurst
          key={burst.id}
          emoji="✨"
          x={burst.x}
          y={burst.y}
          onDone={() => setBurst(null)}
        />
      )}
    </div>
  );

  const renderSlide = (inLightbox = false) => (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${idx}-${current.url}-${inLightbox ? 'lb' : 'in'}`}
        className="post-media-gallery__slide"
        drag={hasMultiple ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.65}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.985 }}
        transition={{ duration: 0.22 }}
      >
        {!loaded[idx] && !failed[idx] && current.type === 'image' ? (
          <div className="post-media-gallery__skeleton" aria-hidden />
        ) : null}
        {failed[idx] ? (
          <div className="post-media-gallery__error">
            <span aria-hidden>✦</span>
            <p>Media unavailable</p>
          </div>
        ) : current.type === 'image' ? (
          <Image
            src={current.url}
            alt={imageAlts[idx] || ''}
            fill
            sizes={inLightbox ? '100vw' : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'}
            className={`post-media-gallery__img${loaded[idx] ? ' post-media-gallery__img--ready' : ''}${inLightbox ? ' post-media-gallery__img--lightbox' : ''}`}
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            loading="lazy"
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              setAspect((s) => ({ ...s, [idx]: clampAspect(img.naturalWidth, img.naturalHeight) }));
              setLoaded((s) => ({ ...s, [idx]: true }));
            }}
            onError={() => setFailed((s) => ({ ...s, [idx]: true }))}
          />
        ) : (
          <div className="post-media-gallery__video-wrap">
            <CosmicVideoPlayer
              src={current.url}
              className="post-media-gallery__video"
              style={{
                width: '100%',
                height: '100%',
                maxHeight: inLightbox ? '82vh' : 'min(75vh, 560px)',
                aspectRatio: 'unset',
                borderRadius: inLightbox ? '1rem' : 0,
              }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );

  return (
    <div className="post-media-gallery">
      {useCollage ? (
        renderCollage()
      ) : (
      <div
        ref={frameRef}
        className="post-media-gallery__frame post-media-gallery__frame--tappable"
        style={currentAspect ? { aspectRatio: currentAspect } : undefined}
        onClick={handleTap}
      >
        {renderSlide(false)}

        {burst && (
          <ReactionBurst
            key={burst.id}
            emoji="✨"
            x={burst.x}
            y={burst.y}
            onDone={() => setBurst(null)}
          />
        )}

        {current.type === 'image' && !failed[idx] ? (
          <button
            type="button"
            className="post-media-gallery__expand"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(true);
            }}
            aria-label="Expand image"
          >
            <ArrowsPointingOutIcon className="h-4 w-4" />
          </button>
        ) : null}

        {hasMultiple && (
          <>
            <button
              type="button"
              className="post-media-gallery__nav post-media-gallery__nav--prev"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous media"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="post-media-gallery__nav post-media-gallery__nav--next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next media"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <span className="post-media-gallery__counter">
              {idx + 1}/{items.length}
            </span>
            <div className="post-media-gallery__dots post-media-gallery__dots--overlay" role="tablist" aria-label="Media slides">
              {items.map((item, i) => (
                <button
                  key={`${item.url}-${i}`}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={`Slide ${i + 1}, ${item.type}`}
                  className={`post-media-gallery__dot${i === idx ? ' post-media-gallery__dot--active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIdx(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      )}

      {!useCollage && items.length >= 3 ? (
        <div className="post-media-gallery__thumbs" role="list">
          {items.map((item, i) => (
            <button
              key={`thumb-${item.url}-${i}`}
              type="button"
              role="listitem"
              className={`post-media-gallery__thumb${i === idx ? ' post-media-gallery__thumb--active' : ''}`}
              onClick={() => setIdx(i)}
              aria-label={`Go to slide ${i + 1}`}
            >
              {item.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="post-media-gallery__thumb-img" />
              ) : (
                <span className="post-media-gallery__thumb-video">▶</span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      <AnimatePresence>
        {lightbox ? (
          <motion.div
            className="post-media-gallery__lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setLightbox(false)}
          >
            <button
              type="button"
              className="post-media-gallery__lightbox-close"
              onClick={() => setLightbox(false)}
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <div
              className="post-media-gallery__lightbox-stage"
              onClick={(e) => e.stopPropagation()}
            >
              {renderSlide(true)}
              {hasMultiple ? (
                <>
                  <button type="button" className="post-media-gallery__nav post-media-gallery__nav--prev" onClick={() => go(-1)} aria-label="Previous">
                    <ChevronLeftIcon className="h-6 w-6" />
                  </button>
                  <button type="button" className="post-media-gallery__nav post-media-gallery__nav--next" onClick={() => go(1)} aria-label="Next">
                    <ChevronRightIcon className="h-6 w-6" />
                  </button>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
