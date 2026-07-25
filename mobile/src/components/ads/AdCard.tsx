import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Linking,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { AdRecord } from '@/hooks/useAds';

type Props = {
  ad: AdRecord;
  placement?: string;
  onImpression?: (adId: string | number, placement: string) => void;
  onClickLogged?: (landingUrl: string) => void;
  logClick?: (landingUrl: string) => void;
};

export default function AdCard({
  ad,
  placement = 'feed',
  onImpression,
  logClick,
}: Props) {
  const { colors } = useTheme();
  const impressionLogged = useRef(false);

  const creative = ad.creative ?? {};
  const headline = creative.headline || (ad as any).headline || 'Sponsored';
  const body = creative.primary_text || (ad as any).primary_text || '';
  const cta = creative.cta_text || (ad as any).cta_text || 'Learn More';
  const landingUrl = creative.landing_url || (ad as any).landing_url || '';
  const mediaUrl =
    (creative.media_urls && creative.media_urls[0]) ||
    (ad as any).image_url ||
    null;

  useEffect(() => {
    if (!impressionLogged.current && onImpression) {
      impressionLogged.current = true;
      onImpression(ad.id, placement);
    }
  }, [ad.id, placement, onImpression]);

  const handlePress = async () => {
    if (logClick) {
      await logClick(landingUrl);
    }
    if (landingUrl) {
      Linking.openURL(landingUrl).catch(() => null);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handlePress}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.sponsoredLabel, { color: colors.textSecondary }]}>Sponsored</Text>
      {mediaUrl ? (
        <Image
          source={{ uri: mediaUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.headline, { color: colors.text }]} numberOfLines={2}>
          {headline}
        </Text>
        {body ? (
          <Text style={[styles.bodyText, { color: colors.textSecondary }]} numberOfLines={3}>
            {body}
          </Text>
        ) : null}
        <View style={[styles.ctaBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.ctaText}>{cta}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 6,
    overflow: 'hidden',
  },
  sponsoredLabel: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingTop: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  image: {
    width: '100%',
    height: 180,
    marginTop: 6,
  },
  body: {
    padding: 12,
  },
  headline: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  ctaBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ctaText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
