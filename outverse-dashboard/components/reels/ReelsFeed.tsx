'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchJson } from '@/lib/api';
import { getUser } from '@/lib/auth';
import type { ReelItem } from '@/lib/reelTypes';
import ReelSlide from './ReelSlide';
import ReelsFeedProgress from './ReelsFeedProgress';
import { useLocale } from '../LocaleProvider';

interface ReelsFeedProps {
  feed: 'all' | 'following';
  tag?: string | null;
  focusId?: number | null;
}

export default function ReelsFeed({ feed, tag, focusId }: ReelsFeedProps) {
  const { t } = useLocale();
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLElement | null)[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (feed === 'following') params.set('feed', 'following');
      if (tag) params.set('tag', tag);
      const qs = params.toString();
      const res = await apiFetch(`reels/${qs ? `?${qs}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setReels(list);
        if (focusId) {
          const idx = list.findIndex((r: ReelItem) => r.id === focusId);
          setActiveIdx(idx >= 0 ? idx : 0);
        } else {
          setActiveIdx(0);
        }
      } else {
        setReels([]);
      }
    } catch {
      setReels([]);
    } finally {
      setLoading(false);
    }
  }, [feed, tag, focusId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.55) return;
          const idx = slideRefs.current.findIndex((el) => el === entry.target);
          if (idx >= 0) setActiveIdx(idx);
        });
      },
      { root, threshold: [0.55, 0.75] },
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [reels.length]);

  useEffect(() => {
    if (!focusId || loading || reels.length === 0) return;
    const idx = reels.findIndex((r) => r.id === focusId);
    if (idx < 0) return;
    const el = slideRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setActiveIdx(idx);
  }, [focusId, loading, reels]);

  const handleLike = async (id: number) => {
    if (!getUser()) return null;
    try {
      const res = await apiFetchJson(`reels/${id}/react/`, { method: 'POST' });
      if (res.ok) return res.json();
    } catch {
      /* ignore */
    }
    return null;
  };

  const handleView = async (id: number) => {
    try {
      await apiFetch(`reels/${id}/record_view/`, { method: 'POST' });
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="reels-feed reels-feed--loading">
        <div className="reels-feed__loader">
          <span className="reels-feed__orb" />
          <p>{t('reels.loading')}</p>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="reels-feed reels-feed--empty">
        <p className="reels-feed__empty-icon" aria-hidden>
          <span className="reels-feed__orb reels-feed__orb--small" />
        </p>
        <p>{t('reels.emptyTitle')}</p>
        <p className="text-sm opacity-70 mt-2">{t('reels.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="reels-feed-wrap">
      <ReelsFeedProgress total={reels.length} activeIndex={activeIdx} />
      <div ref={containerRef} className="reels-feed">
      {reels.map((reel, i) => (
        <div
          key={reel.id}
          ref={(el) => {
            slideRefs.current[i] = el;
          }}
          className="reels-feed__snap"
        >
          <ReelSlide
            reel={reel}
            active={i === activeIdx}
            onLike={handleLike}
            onView={handleView}
            onDeleted={load}
          />
        </div>
      ))}
      </div>
    </div>
  );
}
