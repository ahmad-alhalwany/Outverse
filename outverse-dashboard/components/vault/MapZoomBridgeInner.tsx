'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function MapZoomBridgeInner({ onMap }: { onMap: (map: ReturnType<typeof useMap>) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}
