import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { BottleMarker, BottleLocation, BottlesPalette } from '@/lib/bottles';

const DEFAULT_REGION = {
  latitude: 25,
  longitude: 30,
  latitudeDelta: 40,
  longitudeDelta: 40,
};

export default function BottlesMap({
  C,
  markers,
  pickMode,
  pickPreview,
  flyTarget,
  onPressMarker,
  onPickLocation,
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
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    if (flyTarget) {
      const delta = flyTarget.zoom && flyTarget.zoom >= 12 ? 0.18 : 8;
      mapRef.current?.animateToRegion(
        {
          latitude: flyTarget.lat,
          longitude: flyTarget.lng,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        400,
      );
      return;
    }
    if (!markers.length) return;
    if (markers.length === 1) {
      mapRef.current?.animateToRegion(
        {
          latitude: markers[0].lat,
          longitude: markers[0].lng,
          latitudeDelta: 8,
          longitudeDelta: 8,
        },
        400,
      );
      return;
    }
    mapRef.current?.fitToCoordinates(
      markers.map((m) => ({ latitude: m.lat, longitude: m.lng })),
      { edgePadding: { top: 48, right: 36, bottom: 48, left: 36 }, animated: true },
    );
  }, [markers, flyTarget]);

  return (
    <View style={[styles.frame, { borderColor: C.line }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        userInterfaceStyle="dark"
        onPress={(event) => {
          if (!pickMode || !onPickLocation) return;
          const { latitude, longitude } = event.nativeEvent.coordinate;
          onPickLocation(latitude, longitude);
        }}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={{ latitude: marker.lat, longitude: marker.lng }}
            onPress={() => onPressMarker(marker)}
            tracksViewChanges={false}
          >
            <View style={[styles.pin, { backgroundColor: marker.color }]}>
              <Text style={styles.pinEmoji}>{marker.emoji}</Text>
            </View>
          </Marker>
        ))}
        {pickPreview ? (
          <Marker coordinate={{ latitude: pickPreview.lat, longitude: pickPreview.lng }}>
            <View style={[styles.pin, { backgroundColor: C.brownDk }]}>
              <Text style={styles.pinEmoji}>📍</Text>
            </View>
          </Marker>
        ) : null}
      </MapView>
      {markers.length === 0 && !pickMode ? (
        <View style={styles.empty} pointerEvents="none">
          <Text style={[styles.emptyText, { color: C.text2 }]}>{emptyLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 280, borderRadius: 20, overflow: 'hidden', borderWidth: 1 },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  pinEmoji: { fontSize: 16 },
  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
});
