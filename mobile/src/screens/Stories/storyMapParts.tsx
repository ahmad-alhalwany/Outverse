import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { STORY_MAP_C, relativeStoryTime, type StoryMapPin } from '@/lib/storyMap';

export function StoryMapPinBubble({ hasThumbnail }: { hasThumbnail: boolean }) {
  return (
    <View style={styles.pinWrap} pointerEvents="none">
      <View style={styles.pinPulse} />
      <LinearGradient colors={['#fbbf24', '#f59e0b', '#7c3aed']} style={styles.pin}>
        <Text style={styles.pinEmoji}>{hasThumbnail ? '📸' : '✨'}</Text>
      </LinearGradient>
    </View>
  );
}

export function StoryMapPinCard({
  pin,
  onPress,
}: {
  pin: StoryMapPin;
  onPress: () => void;
}) {
  const time = relativeStoryTime(pin.createdAt);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.88 : 1 }]}>
      {pin.thumbnail ? (
        <Image source={{ uri: pin.thumbnail }} style={styles.thumb} />
      ) : (
        <LinearGradient colors={['#5b21b6', '#0e7490']} style={[styles.thumb, styles.thumbFallback]}>
          <Text style={{ fontSize: 18 }}>✨</Text>
        </LinearGradient>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.author} numberOfLines={1}>
          @{pin.author}
        </Text>
        <View style={styles.locRow}>
          <Ionicons name="location" size={13} color={STORY_MAP_C.cyanSoft} />
          <Text style={styles.loc} numberOfLines={1}>
            {pin.locationName || `${pin.lat.toFixed(2)}, ${pin.lng.toFixed(2)}`}
          </Text>
        </View>
        {time ? <Text style={styles.time}>{time}</Text> : null}
      </View>
    </Pressable>
  );
}

export function StoryMapAtlas({
  pins,
  onOpen,
  emptyLabel,
}: {
  pins: StoryMapPin[];
  onOpen: (index: number) => void;
  emptyLabel: string;
}) {
  const lats = pins.map((p) => p.lat);
  const lngs = pins.map((p) => p.lng);
  const minLat = Math.min(...lats, 0);
  const maxLat = Math.max(...lats, 1);
  const minLng = Math.min(...lngs, 0);
  const maxLng = Math.max(...lngs, 1);
  const dLat = Math.max(0.01, maxLat - minLat);
  const dLng = Math.max(0.01, maxLng - minLng);

  return (
    <LinearGradient colors={['#122033', '#0a1628', '#1a1040']} style={styles.atlas}>
      {pins.length === 0 ? (
        <Text style={styles.atlasEmpty}>{emptyLabel}</Text>
      ) : (
        pins.map((pin, index) => {
          const left = ((pin.lng - minLng) / dLng) * 82 + 6;
          const top = ((maxLat - pin.lat) / dLat) * 78 + 8;
          return (
            <Pressable
              key={String(pin.id)}
              onPress={() => onOpen(index)}
              style={[styles.atlasDot, { left: `${left}%`, top: `${top}%` }]}
            >
              <StoryMapPinBubble hasThumbnail={!!pin.thumbnail} />
            </Pressable>
          );
        })
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pinWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pinPulse: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(34,211,238,0.55)',
  },
  pin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinEmoji: { fontSize: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    backgroundColor: STORY_MAP_C.raised,
    borderWidth: 1,
    borderColor: STORY_MAP_C.borderSoft,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(251,191,36,0.4)',
    backgroundColor: '#5b21b6',
  },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  author: { color: STORY_MAP_C.text, fontSize: 15, fontWeight: '800' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  loc: { flex: 1, color: STORY_MAP_C.cyanSoft, fontSize: 13, fontWeight: '700' },
  time: { color: STORY_MAP_C.quiet, fontSize: 11, marginTop: 4 },
  atlas: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 280,
  },
  atlasEmpty: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 24,
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  atlasDot: { position: 'absolute' },
});
