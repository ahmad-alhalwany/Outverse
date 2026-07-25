import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Video } from 'expo-av';
import { useTheme } from '@/hooks/useTheme';
import { Ad } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AdCardProps {
  ad: Ad;
  placement: 'feed' | 'stories' | 'reels' | 'explore' | 'profile';
  onImpression?: () => void;
  onClick?: () => void;
}

export default function AdCard({ ad, placement, onImpression, onClick }: AdCardProps) {
  const { colors } = useTheme();
  const [impressionLogged, setImpressionLogged] = useState(false);
  const adRef = useRef<TouchableOpacity>(null);

  const creative = ad.creative;
  const mediaUrls = creative.media_urls || [];
  const isVideo = creative.format === 'video' || creative.format === 'reel';
  const isCarousel = creative.format === 'carousel';

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !impressionLogged) {
            onImpression?.();
            setImpressionLogged(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (adRef.current) {
      observer.observe(adRef.current as any);
    }

    return () => observer.disconnect();
  }, [impressionLogged, onImpression]);

  const handleClick = () => {
    onClick?.();
    if (creative.landing_url) {
      console.log('Open URL:', creative.landing_url);
    }
  };

  const getAspectRatio = () => {
    switch (creative.aspect_ratio) {
      case '9:16': return { aspectRatio: 9 / 16 };
      case '4:5': return { aspectRatio: 4 / 5 };
      case '16:9': return { aspectRatio: 16 / 9 };
      default: return { aspectRatio: 1 };
    }
  };

  const renderMedia = () => {
    if (!mediaUrls[0]) return null;

    if (isVideo) {
      return (
        <Video
          source={{ uri: mediaUrls[0] }}
          style={styles.media}
          isLooping
          isMuted
          useNativeControls={false}
        />
      );
    }

    if (isCarousel) {
      return (
        <View style={styles.carousel}>
          {mediaUrls.map((url, idx) => (
            <Image key={idx} source={{ uri: url }} style={styles.carouselImage} />
          ))}
        </View>
      );
    }

    return (
      <Image
        source={{ uri: mediaUrls[0] }}
        style={styles.media}
        resizeMode="contain"
      />
    );
  };

  return (
    <TouchableOpacity
      ref={adRef}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={handleClick}
      activeOpacity={0.9}
    >
      <View style={styles.sponsoredBadge}>
        <Text style={styles.sponsoredText}>Sponsored</Text>
      </View>

      <View style={[styles.mediaContainer, getAspectRatio(), { backgroundColor: colors.surfaceSecondary }]}>
        {renderMedia()}
      </View>

      <View style={styles.content}>
        {creative.primary_text && (
          <Text style={[styles.primaryText, { color: colors.text }]} numberOfLines={3}>
            {creative.primary_text}
          </Text>
        )}

        <View style={styles.bottomRow}>
          <View style={styles.info}>
            {creative.headline && (
              <Text style={[styles.headline, { color: colors.text }]}>{creative.headline}</Text>
            )}
            {creative.description && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>{creative.description}</Text>
            )}
          </View>

          {creative.cta_text && creative.landing_url && (
            <TouchableOpacity style={[styles.ctaButton, { backgroundColor: colors.primary }]} onPress={handleClick}>
              <Text style={styles.ctaButtonText}>{creative.cta_text}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sponsoredText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366F1',
  },
  mediaContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  media: {
    width: '100%',
    height: 200,
  },
  carousel: {
    width: '100%',
    height: 200,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  content: {
    marginBottom: 8,
  },
  primaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  info: { flex: 1 },
  headline: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  description: { fontSize: 13, fontWeight: '500' },
  ctaButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});