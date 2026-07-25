import { useState, useCallback, useRef } from 'react';
import { api } from '@/api/client';

export type AdRecord = {
  id: string | number;
  creative?: {
    headline?: string;
    primary_text?: string;
    cta_text?: string;
    landing_url?: string;
    media_urls?: string[];
  };
  campaign?: { name?: string };
  [key: string]: unknown;
};

export function useAds() {
  const [currentAd, setCurrentAd] = useState<AdRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const impressionIdRef = useRef<string | null>(null);

  const fetchAd = useCallback(
    async (placement: 'feed' | 'stories' | 'reels' | 'explore' | 'profile' = 'feed') => {
      setLoading(true);
      try {
        const ad = await api.getAd(placement);
        setCurrentAd(ad as AdRecord | null);
        impressionIdRef.current = null;
      } catch (error) {
        console.error('Failed to fetch ad:', error);
        setCurrentAd(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logImpression = useCallback(
    async (adId: string | number, placement: string) => {
      try {
        const result = await api.logAdImpression({
          ad_id: String(adId),
          placement,
        });
        if (result?.impression_id) {
          impressionIdRef.current = String(result.impression_id);
        }
        return result;
      } catch (error) {
        console.error('Failed to log impression:', error);
        return null;
      }
    },
    [],
  );

  const logClick = useCallback(
    async (landingUrl: string) => {
      const impressionId = impressionIdRef.current;
      if (!impressionId) return null;
      try {
        const result = await api.logAdClick({
          impression_id: impressionId,
          landing_url: landingUrl,
        });
        return result;
      } catch (error) {
        console.error('Failed to log click:', error);
        return null;
      }
    },
    [],
  );

  return {
    currentAd,
    loading,
    fetchAd,
    logImpression,
    logClick,
  };
}
