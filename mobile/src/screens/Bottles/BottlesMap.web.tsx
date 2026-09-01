import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottleMarker, BottleLocation, BottlesPalette } from '@/lib/bottles';

export default function BottlesMap({
  C,
  markers,
  pickMode,
  onPressMarker,
  emptyLabel,
}: {
  C: BottlesPalette;
  markers: BottleMarker[];
  pickMode?: boolean;
  pickPreview?: BottleLocation | null;
  flyTarget?: { lat: number; lng: number; zoom?: number } | null;
  onPressMarker: (marker: BottleMarker) => void;
  onPickLocation?: (lat: number, lng: number) => void;
  emptyLabel: string;
}) {
  const lats = markers.map((m) => m.lat);
  const lngs = markers.map((m) => m.lng);
  const minLat = Math.min(...lats, 0);
  const maxLat = Math.max(...lats, 1);
  const minLng = Math.min(...lngs, 0);
  const maxLng = Math.max(...lngs, 1);
  const dLat = Math.max(0.01, maxLat - minLat);
  const dLng = Math.max(0.01, maxLng - minLng);

  return (
    <LinearGradient colors={[C.card, C.cream, C.card2]} style={[styles.atlas, { borderColor: C.line }]}>
      {markers.length === 0 ? (
        <Text style={[styles.empty, { color: C.text2 }]}>{emptyLabel}</Text>
      ) : (
        markers.map((marker) => {
          const left = ((marker.lng - minLng) / dLng) * 82 + 6;
          const top = ((maxLat - marker.lat) / dLat) * 78 + 8;
          return (
            <Pressable
              key={marker.id}
              onPress={() => onPressMarker(marker)}
              style={[styles.dot, { left: `${left}%`, top: `${top}%`, backgroundColor: marker.color }]}
            >
              <Text style={styles.emoji}>{marker.emoji}</Text>
            </Pressable>
          );
        })
      )}
      {pickMode ? (
        <Text style={[styles.pickHint, { color: C.text }]}>Map pick is available on the phone app.</Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  atlas: { height: 280, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  empty: { textAlign: 'center', marginTop: 120, paddingHorizontal: 20, fontSize: 13 },
  dot: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  emoji: { fontSize: 14 },
  pickHint: { position: 'absolute', bottom: 12, alignSelf: 'center', fontSize: 12, fontWeight: '700' },
});
