'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logAdImpression, logAdClick, type Ad, type AdImpressionResponse } from '@/lib/adsApi';
import { apiFetch } from '@/lib/api';
import { ArrowTopRightOnSquareIcon, SparklesIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

interface AdFeedProps {
  placement: 'feed' | 'stories' | 'reels' | 'explore' | 'profile';
  /** Pass an already-fetched ad (e.g. from a list that fetches once and
   * reuses it across virtualized slots) to skip this component's own fetch. */
  ad?: Ad;
  onImpressionLogged?: (impressionId: number) => void;
  onClickLogged?: (clickId: number, redirectUrl: string) => void;
}

interface UseAdReturn {
  ad: Ad | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
}

export function useAd(placement: AdFeedProps['placement'], options?: { skip?: boolean }): UseAdReturn {
  const skip = options?.skip ?? false;
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(false);

  const fetchAd = useCallback(async () => {
    if (skip) return;
    setLoading(true);
    setError(false);
    try {
      // Hit Django directly — more reliable than the Next BFF under slow cold starts.
      const pick = (payload: unknown): Ad | null => {
        const list = Array.isArray(payload)
          ? payload
          : payload && typeof payload === 'object' && Array.isArray((payload as { results?: unknown[] }).results)
            ? (payload as { results: unknown[] }).results
            : [];
        return (list[0] as Ad) || null;
      };

      const primary = await apiFetch(`ads/ads/?placement=${encodeURIComponent(placement)}`);
      if (primary.ok) {
        const chosen = pick(await primary.json());
        if (chosen) {
          setAd(chosen);
          return;
        }
      }
      const fallback = await apiFetch('ads/ads/');
      if (fallback.ok) {
        setAd(pick(await fallback.json()));
      } else {
        setAd(null);
      }
    } catch {
      setAd(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [placement, skip]);

  useEffect(() => {
    if (!skip) fetchAd();
  }, [fetchAd, skip]);

  return { ad, loading, error, refresh: fetchAd };
}

interface AdDisplayProps {
  ad: Ad;
  placement: AdFeedProps['placement'];
  onImpressionLogged?: (impressionId: number) => void;
  onClickLogged?: (clickId: number, redirectUrl: string) => void;
}

function AdDisplay({ ad, placement, onImpressionLogged, onClickLogged }: AdDisplayProps) {
  const [impressionLogged, setImpressionLogged] = useState(false);
  const [impressionId, setImpressionId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [visible, setVisible] = useState(false);

  // Track viewability for impression
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !impressionLogged) {
          setVisible(true);
          // Log impression
          logAdImpression({
            ad_id: ad.id,
            placement,
            session_id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          }).then((res) => {
            if (res?.success && res.impression_id) {
              setImpressionId(res.impression_id);
              setImpressionLogged(true);
              onImpressionLogged?.(res.impression_id);
            }
          });
          observerRef.current?.unobserve(container);
        }
      },
      { threshold: 0.5, rootMargin: '100px' }
    );

    observerRef.current.observe(container);
    return () => observerRef.current?.disconnect();
  }, [ad.id, placement, impressionLogged, onImpressionLogged]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const res = await logAdClick({
        impression_id: impressionId || 0,
        landing_url: ad.creative.landing_url,
        referrer_url: window.location.href,
      });
      if (res?.success && res.redirect_url) {
        onClickLogged?.(res.click_id, res.redirect_url);
        window.open(res.redirect_url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // Fallback: direct navigation
      window.open(ad.creative.landing_url, '_blank', 'noopener,noreferrer');
    }
  };

  const creative = ad.creative;
  const isVideo = creative.format === 'video' || creative.format === 'reel';
  const isCarousel = creative.format === 'carousel';
  const mediaUrls = creative.media_urls || [];

  return (
    <div
      ref={containerRef}
      className="ad-card relative rounded-2xl overflow-hidden bg-surface/60 border border-vault/20 shadow-xl"
      role="article"
      aria-label={`Sponsored: ${creative.headline || creative.primary_text}`}
    >
      {/* Sponsored badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-text-secondary shadow-sm">
        <SparklesIcon className="h-3 w-3 text-vault" />
        <span>Sponsored</span>
      </div>

      {/* Ad content */}
      <div className="p-4" onClick={handleClick}>
        {/* Headline */}
        {creative.headline && (
          <h3 className="font-semibold text-text mb-2 text-lg line-clamp-2">
            {creative.headline}
          </h3>
        )}

        {/* Primary text */}
        {creative.primary_text && (
          <p className="text-text-secondary mb-3 text-sm line-clamp-3">
            {creative.primary_text}
          </p>
        )}

        {/* Media */}
        <div className="relative rounded-xl overflow-hidden mb-3">
          {isVideo && mediaUrls[0] ? (
            <video
              src={mediaUrls[0]}
              className="w-full h-auto max-h-[400px] object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : isCarousel && mediaUrls.length > 1 ? (
            <div className="relative aspect-square">
              {mediaUrls.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Ad slide ${idx + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${idx === 0 ? 'opacity-100' : 'opacity-0'}`}
                  loading="lazy"
                />
              ))}
            </div>
          ) : mediaUrls[0] ? (
            <img
              src={mediaUrls[0]}
              alt={creative.headline || 'Ad creative'}
              className="w-full h-auto max-h-[400px] object-cover"
              loading="lazy"
            />
          ) : null}

          {/* CTA Overlay on media */}
          {creative.cta_text && (
            <div className="absolute bottom-3 right-3">
              <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-sm font-semibold text-text shadow-lg">
                {creative.cta_text}
                <ArrowTopRightOnSquareIcon className="inline h-3 w-3 ml-1" />
              </span>
            </div>
          )}
        </div>

        {/* Footer with CTA and trust indicators */}
        <div className="flex items-center justify-between pt-2 border-t border-vault/10">
          <div className="flex items-center gap-2">
            {creative.description && (
              <span className="text-xs text-text-tertiary font-medium">{creative.description}</span>
            )}
            <ShieldCheckIcon className="h-4 w-4 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">Verified advertiser</span>
          </div>

          <button
            onClick={handleClick}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-vault to-bazaar text-white text-sm font-semibold shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
            aria-label={creative.cta_text || 'Learn more'}
          >
            {creative.cta_text || 'Learn More'}
            <ArrowTopRightOnSquareIcon className="inline h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Main export
export function AdFeed({ placement, ad: providedAd, onImpressionLogged, onClickLogged }: AdFeedProps) {
  const { ad: fetchedAd, loading, error } = useAd(placement, { skip: !!providedAd });
  const ad = providedAd ?? fetchedAd;

  if (!providedAd) {
    if (loading) {
      return (
        <div className="ad-skeleton rounded-2xl bg-surface/40 animate-pulse h-[300px]" />
      );
    }
    if (error || !ad) {
      return null; // Don't show anything if no ad available
    }
  }

  if (!ad) return null;

  return <AdDisplay ad={ad} placement={placement} onImpressionLogged={onImpressionLogged} onClickLogged={onClickLogged} />;
}

// Convenience re-export
export { AdFeed as Ad };